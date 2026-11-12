<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Kernel;

use Nowo\IconSelectorBundle\NowoIconSelectorBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Bundle\TwigBundle\TwigBundle;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Kernel;
use Symfony\Component\Routing\Loader\Configurator\RoutingConfigurator;
use Symfony\UX\Icons\UXIconsBundle;

use function dirname;
use function getmypid;
use function sys_get_temp_dir;

/**
 * Host-like kernel for the kept-alive worker test: the bundle routes are imported and the form factory and Twig
 * are exposed through public aliases so the test can fetch them once and keep them, as a worker does.
 */
final class WorkerKeptAliveKernel extends Kernel
{
    use MicroKernelTrait;

    public function registerBundles(): iterable
    {
        yield new FrameworkBundle();
        yield new TwigBundle();
        yield new UXIconsBundle();
        yield new NowoIconSelectorBundle();
    }

    public function getProjectDir(): string
    {
        return dirname(__DIR__, 2);
    }

    public function getCacheDir(): string
    {
        return sys_get_temp_dir() . '/nowo-icon-selector-bundle-worker/' . getmypid() . '/' . $this->environment;
    }

    public function getLogDir(): string
    {
        return sys_get_temp_dir() . '/nowo-icon-selector-bundle-worker/' . getmypid() . '/log';
    }

    private function configureContainer(ContainerConfigurator $container): void
    {
        $container->extension('framework', [
            'secret'                => 'test-secret',
            'test'                  => true,
            'http_method_override'  => false,
            'handle_all_throwables' => true,
            'php_errors'            => ['log' => true],
            'router'                => ['utf8' => true],
            'property_info'         => ['enabled' => false],
            'assets'                => ['enabled' => false],
        ]);
        $container->services()
            ->alias('test.form.factory', 'form.factory')->public()
            ->alias('test.twig', 'twig')->public();
    }

    private function configureRoutes(RoutingConfigurator $routes): void
    {
        $routes->import('@NowoIconSelectorBundle/Resources/config/routes.yaml');
    }
}
