<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Integration\Worker;

use Nowo\IconSelectorBundle\Form\IconSelectorType;
use Nowo\IconSelectorBundle\Tests\Kernel\WorkerKeptAliveKernel;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Form\Extension\Core\Type\FormType;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Component\HttpKernel\TerminableInterface;

use function gc_collect_cycles;
use function json_decode;
use function memory_get_usage;
use function sprintf;

use const JSON_THROW_ON_ERROR;

/**
 * REQ-RUNTIME-002: ONE kernel, `services_resetter` / `kernel.reset` never called (FrankenPHP worker, kernel reset
 * false). N iterations alternate two inputs: a host form containing the icon selector is built, submitted and viewed
 * with a different icon list / mode, and the bundle config endpoint is served through `http_kernel` handle() +
 * terminate(). Each view must show only its own icons and memory must stay flat.
 */
final class WorkerKeptAliveKernelTest extends TestCase
{
    private const ITERATIONS = 1200;
    private const WARM_UP    = 100;
    private const MARGIN     = 4 * 1024 * 1024;

    public function testAlternatingFormsAndRequestsInOneKernelLeakNothingAndKeepMemoryFlat(): void
    {
        $kernel = new WorkerKeptAliveKernel('test', false);
        $kernel->boot();

        try {
            $container  = $kernel->getContainer();
            $factory    = $container->get('test.form.factory');
            $httpKernel = $container->get('http_kernel');
            self::assertInstanceOf(FormFactoryInterface::class, $factory);
            self::assertInstanceOf(HttpKernelInterface::class, $httpKernel);
            self::assertInstanceOf(TerminableInterface::class, $httpKernel);

            $inputs = [
                'alpha' => ['icons' => ['mdi:alpha-a', 'mdi:alpha-b'], 'mode' => 'direct', 'submit' => 'mdi:alpha-a', 'other' => 'beta'],
                'beta'  => ['icons' => ['mdi:beta-x'], 'mode' => 'tom_select', 'submit' => 'mdi:beta-x', 'other' => 'alpha'],
            ];

            $baseline = 0;
            for ($i = 0; $i < self::ITERATIONS; ++$i) {
                if ($i === self::WARM_UP) {
                    gc_collect_cycles();
                    $baseline = memory_get_usage();
                }

                $who  = $i % 2 === 0 ? 'alpha' : 'beta';
                $data = $inputs[$who];

                $form = $factory->createNamedBuilder('host', FormType::class)
                    ->add('icon', IconSelectorType::class, ['icons' => $data['icons'], 'mode' => $data['mode']])
                    ->getForm();
                $form->submit(['icon' => $data['submit']]);
                self::assertTrue($form->isSynchronized(), sprintf('iteration %d', $i));
                self::assertSame($data['submit'], $form->get('icon')->getData(), sprintf('iteration %d', $i));

                $vars = $form->createView()['icon']->vars;
                self::assertSame($data['icons'], $vars['icons'], sprintf('iteration %d', $i));
                self::assertSame($data['mode'], $vars['mode'], sprintf('iteration %d', $i));
                self::assertSame($data['mode'], $vars['attr']['data-icon-selector-mode-value'], sprintf('iteration %d', $i));

                $request  = Request::create('/api/icon-selector/config', 'GET');
                $response = $httpKernel->handle($request);
                self::assertSame(200, $response->getStatusCode(), sprintf('iteration %d', $i));
                $config = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
                self::assertArrayHasKey('iconify_base', $config);
                $httpKernel->terminate($request, $response);
            }

            gc_collect_cycles();
            $growth = memory_get_usage() - $baseline;
            self::assertLessThan(self::MARGIN, $growth, sprintf('memory grew by %d bytes over %d iterations', $growth, self::ITERATIONS - self::WARM_UP));
        } finally {
            $kernel->shutdown();
        }
    }
}
