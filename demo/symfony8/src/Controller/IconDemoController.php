<?php

declare(strict_types=1);

namespace App\Controller;

use Nowo\IconSelectorBundle\Form\IconSelectorType;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Demo controller: separate pages per icon selector type (grid, search, tom_select, heroicons).
 * Each page has one form with one field; on submit we redirect with the selected icon in the URL (PRG) and show a flash message.
 * All routes are under /{_locale}/ for language switching via URL.
 */
class IconDemoController extends AbstractController
{
    private const LOCALE_REQUIREMENT = ['_locale' => 'en|es'];

    public function __construct(
        private readonly IconListProvider $iconListProvider,
        private readonly TranslatorInterface $translator
    ) {
    }

    /**
     * Redirect root to default locale.
     */
    #[Route(path: '/', name: 'app_root', methods: ['GET'])]
    public function root(): RedirectResponse
    {
        return $this->redirectToRoute('app_home', ['_locale' => 'en']);
    }

    /**
     * Home: links to each demo page.
     */
    #[Route(path: '/{_locale}/', name: 'app_home', requirements: self::LOCALE_REQUIREMENT, defaults: ['_locale' => 'en'], methods: ['GET'])]
    public function home(Request $request): Response
    {
        $request->setLocale($request->attributes->get('_locale', 'en'));

        return $this->render('icon_demo/home.html.twig');
    }

    /**
     * Demo page: icon selector in direct (grid) mode.
     */
    #[Route(path: '/{_locale}/demo/grid', name: 'app_demo_grid', requirements: self::LOCALE_REQUIREMENT, defaults: ['_locale' => 'en'], methods: ['GET', 'POST'])]
    public function grid(Request $request): Response
    {
        $request->setLocale($request->attributes->get('_locale', 'en'));
        $locale  = $request->getLocale();
        $field   = 'icon_direct';
        $data    = [$field => $request->query->getString('icon', '')];
        $icons   = $this->iconListProvider->getIcons();

        $form = $this->createFormBuilder($data, ['translation_domain' => 'messages'])
            ->add($field, IconSelectorType::class, [
                'mode'                      => IconSelectorType::MODE_DIRECT,
                'label'                     => 'demo.label_icon_grid',
                'icons'                     => $icons,
                'translation_domain'        => 'messages',
                'choice_translation_domain' => false,
            ])
            ->getForm();

        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $selected = $form->get($field)->getData();
            $this->addFlash('success', $this->translator->trans('demo.saved_success', ['%icon%' => $selected], 'messages'));
        }

        return $this->render('icon_demo/show.html.twig', [
            'form'        => $form,
            'demo_slug'   => 'grid',
            'saved_value' => $data[$field],
        ]);
    }

    /**
     * Demo page: icon selector in search mode.
     */
    #[Route(path: '/{_locale}/demo/search', name: 'app_demo_search', requirements: self::LOCALE_REQUIREMENT, defaults: ['_locale' => 'en'], methods: ['GET', 'POST'])]
    public function search(Request $request): Response
    {
        $request->setLocale($request->attributes->get('_locale', 'en'));
        $locale  = $request->getLocale();
        $field   = 'icon_search';
        $data    = [$field => $request->query->getString('icon', '')];
        $icons   = $this->iconListProvider->getIcons();

        $form = $this->createFormBuilder($data, ['translation_domain' => 'messages'])
            ->add($field, IconSelectorType::class, [
                'mode'                      => IconSelectorType::MODE_SEARCH,
                'label'                     => 'demo.label_icon_search',
                'icons'                     => $icons,
                'translation_domain'        => 'messages',
                'choice_translation_domain' => false,
            ])
            ->getForm();

        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $selected = $form->get($field)->getData();
            $this->addFlash('success', $this->translator->trans('demo.saved_success', ['%icon%' => $selected], 'messages'));
        }

        return $this->render('icon_demo/show.html.twig', [
            'form'        => $form,
            'demo_slug'   => 'search',
            'saved_value' => $data[$field],
        ]);
    }

    /**
     * Demo page: icon selector in Tom Select (dropdown) mode.
     */
    #[Route(path: '/{_locale}/demo/tom-select', name: 'app_demo_tom_select', requirements: self::LOCALE_REQUIREMENT, defaults: ['_locale' => 'en'], methods: ['GET', 'POST'])]
    public function tomSelect(Request $request): Response
    {
        $request->setLocale($request->attributes->get('_locale', 'en'));
        $locale  = $request->getLocale();
        $field   = 'icon_tom_select';
        $data    = [$field => $request->query->getString('icon', '')];
        $icons   = $this->iconListProvider->getIcons();
        $choices = $this->iconsToChoices($icons);

        $form = $this->createFormBuilder($data, ['translation_domain' => 'messages'])
            ->add($field, IconSelectorType::class, [
                'mode'                      => IconSelectorType::MODE_TOM_SELECT,
                'label'                     => 'demo.label_icon_tom_select',
                'icons'                     => $icons,
                'choices'                   => $choices,
                'translation_domain'        => 'messages',
                'choice_translation_domain' => false,
            ])
            ->getForm();

        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $selected = $form->get($field)->getData();
            $this->addFlash('success', $this->translator->trans('demo.saved_success', ['%icon%' => $selected], 'messages'));
        }

        return $this->render('icon_demo/show.html.twig', [
            'form'        => $form,
            'demo_slug'   => 'tom_select',
            'saved_value' => $data[$field],
        ]);
    }

    /**
     * Demo page: icon selector (Tom Select) limited to Heroicons set.
     */
    #[Route(path: '/{_locale}/demo/heroicons', name: 'app_demo_heroicons', requirements: self::LOCALE_REQUIREMENT, defaults: ['_locale' => 'en'], methods: ['GET', 'POST'])]
    public function heroicons(Request $request): Response
    {
        $request->setLocale($request->attributes->get('_locale', 'en'));
        $locale    = $request->getLocale();
        $field     = 'icon_heroicons';
        $data      = [$field => $request->query->getString('icon', '')];
        $heroicons = $this->iconListProvider->getIconsForSets(['heroicons']);
        $choices   = $this->iconsToChoices($heroicons);

        $form = $this->createFormBuilder($data, ['translation_domain' => 'messages'])
            ->add($field, IconSelectorType::class, [
                'mode'                      => IconSelectorType::MODE_TOM_SELECT,
                'label'                     => 'demo.label_icon_heroicons',
                'icon_sets'                 => ['heroicons'],
                'choices'                   => $choices,
                'translation_domain'        => 'messages',
                'choice_translation_domain' => false,
            ])
            ->getForm();

        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $selected = $form->get($field)->getData();
            $this->addFlash('success', $this->translator->trans('demo.saved_success', ['%icon%' => $selected], 'messages'));
        }

        return $this->render('icon_demo/show.html.twig', [
            'form'        => $form,
            'demo_slug'   => 'heroicons',
            'saved_value' => $data[$field],
        ]);
    }

    /**
     * @param list<string> $icons
     *
     * @return array<string, string> Map of icon ID to label (for ChoiceType, key = value submitted)
     */
    private function iconsToChoices(array $icons): array
    {
        $choices = [];
        foreach ($icons as $id) {
            $parts         = explode(':', $id);
            $label         = $parts !== [] ? end($parts) : $id;
            $choices[$id]  = $label;
        }

        return $choices;
    }
}
