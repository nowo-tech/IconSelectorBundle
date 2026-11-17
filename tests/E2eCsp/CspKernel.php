<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\E2eCsp;

use Nowo\IconSelectorBundle\Form\IconSelectorType;
use Nowo\IconSelectorBundle\NowoIconSelectorBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Bundle\TwigBundle\TwigBundle;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\Kernel;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Routing\Loader\Configurator\RoutingConfigurator;
use Symfony\UX\Icons\UXIconsBundle;
use Twig\Environment;

use function base64_encode;
use function dirname;
use function is_string;
use function random_bytes;
use function sprintf;
use function sys_get_temp_dir;

/**
 * Minimal host app for the strict-CSP browser test (tests/E2eCsp/playwright).
 *
 * The kernel environment is the icon source under test: "bundle" (source: bundle) or "local" (source: ux_icons_local,
 * icons from tests/Fixtures/ux-icons through ux_icons.icon_dir). Every route lives under /<environment>/ so one
 * `php -S` process serves both. Each HTML response carries a nonce-only Content-Security-Policy; the nonce is a
 * request attribute (no state on the kernel or on services). UX Icons on-demand Iconify fetching is disabled, so
 * neither the browser nor the server talks to a third party.
 */
final class CspKernel extends Kernel implements EventSubscriberInterface
{
    use MicroKernelTrait;

    public const ENVIRONMENTS = ['bundle', 'local'];

    private const NONCE_ATTRIBUTE = '_e2e_csp_nonce';

    public function registerBundles(): iterable
    {
        yield new FrameworkBundle();
        yield new TwigBundle();
        yield new UXIconsBundle();
        yield new NowoIconSelectorBundle();
    }

    public function getProjectDir(): string
    {
        return __DIR__;
    }

    public function getCacheDir(): string
    {
        return sys_get_temp_dir() . '/nowo-icon-selector-e2e-csp/cache/' . $this->environment;
    }

    public function getLogDir(): string
    {
        return sys_get_temp_dir() . '/nowo-icon-selector-e2e-csp/log';
    }

    /**
     * @return array<string, string>
     */
    public static function getSubscribedEvents(): array
    {
        return [KernelEvents::RESPONSE => 'onResponse'];
    }

    /**
     * Sends the nonce-only policy Beacon uses on signed-in pages.
     */
    public function onResponse(ResponseEvent $event): void
    {
        $nonce = $event->getRequest()->attributes->get(self::NONCE_ATTRIBUTE);
        if (!is_string($nonce)) {
            $nonce = base64_encode(random_bytes(18));
        }
        $event->getResponse()->headers->set('Content-Security-Policy', sprintf(
            "default-src 'self'; style-src 'self' 'nonce-%1\$s'; script-src 'self' 'nonce-%1\$s'; connect-src 'self'",
            $nonce,
        ));
    }

    /**
     * Form page with the three widget modes; a POST shows the submitted values.
     */
    public function formAction(Request $request): Response
    {
        $nonce = base64_encode(random_bytes(18));
        $request->attributes->set(self::NONCE_ATTRIBUTE, $nonce);

        /** @var FormFactoryInterface $formFactory */
        $formFactory = $this->getContainer()->get('e2e.form_factory');
        /** @var Environment $twig */
        $twig = $this->getContainer()->get('e2e.twig');

        $form = $formFactory->createNamedBuilder('icons')
            ->add('direct', IconSelectorType::class, ['mode' => IconSelectorType::MODE_DIRECT, 'required' => false])
            ->add('search', IconSelectorType::class, ['mode' => IconSelectorType::MODE_SEARCH, 'required' => false])
            ->add('tom', IconSelectorType::class, ['mode' => IconSelectorType::MODE_TOM_SELECT, 'required' => false, 'data' => 'tabler:home'])
            ->getForm();
        $form->handleRequest($request);

        $saved = null;
        if ($form->isSubmitted()) {
            $saved = $form->isValid() ? $form->getData() : ['invalid' => (string) $form->getErrors(true)];
        }

        return new Response($twig->render('form.html.twig', [
            'form'   => $form->createView(),
            'nonce'  => $nonce,
            'source' => $this->environment,
            'saved'  => $saved,
        ]));
    }

    private function configureContainer(ContainerConfigurator $container): void
    {
        $container->extension('framework', [
            'secret'                => 'e2e-csp',
            'http_method_override'  => false,
            'handle_all_throwables' => true,
            'php_errors'            => ['log' => true],
            'router'                => ['utf8' => true],
            'property_info'         => ['enabled' => false],
            'csrf_protection'       => false,
            'form'                  => ['csrf_protection' => false],
            'assets'                => ['enabled' => true],
        ]);
        $container->extension('twig', ['default_path' => __DIR__ . '/templates']);
        $container->extension('ux_icons', [
            'icon_dir' => dirname(__DIR__) . '/Fixtures/ux-icons',
            'iconify'  => ['enabled' => false],
        ]);
        $container->extension('nowo_icon_selector', [
            'icon_sets'      => ['tabler'],
            'source'         => $this->environment === 'local' ? 'ux_icons_local' : 'bundle',
            'icons_api_path' => '/' . $this->environment . '/api/icon-selector/icons',
        ]);
        $services = $container->services();
        $services->alias('e2e.form_factory', 'form.factory')->public();
        $services->alias('e2e.twig', 'twig')->public();
    }

    private function configureRoutes(RoutingConfigurator $routes): void
    {
        $routes->import('@NowoIconSelectorBundle/Resources/config/routes.yaml')->prefix('/' . $this->environment);
        $routes->add('e2e_form', '/' . $this->environment . '/form')->controller([$this, 'formAction'])->methods(['GET', 'POST']);
    }
}
