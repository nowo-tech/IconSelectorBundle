<?php

declare(strict_types=1);

namespace App\Form;

use Nowo\FormKitBundle\Attribute\FormKitConfig;
use Nowo\FormKitBundle\Form\FormOptionsTrait;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\SubmitType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

/**
 * REQ-DEMO-015: a FormKit form (profile `demo`); the bundle's IconSelectorType is added through FormKit's
 * addIconSelector(). One field (its name and options come from the controller) plus an optional submit button.
 *
 * @extends AbstractType<array<string, mixed>>
 */
#[FormKitConfig('demo')]
final class IconDemoType extends AbstractType
{
    use FormOptionsTrait;

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $this->addIconSelector($builder, $options['field_name'], [
            ...$options['icon_options'],
            'help'                      => false,
            'translation_domain'        => 'messages',
            'choice_translation_domain' => false,
        ]);

        if ($options['with_submit']) {
            $this->addWithDefaults($builder, 'submit', SubmitType::class, [
                'label'              => 'demo.submit',
                'translation_domain' => 'messages',
                'attr'               => ['class' => 'nowo-ui-btn nowo-ui-btn--primary'],
            ]);
        }
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'translation_domain' => 'messages',
            'field_name'         => 'icon',
            'icon_options'       => [],
            'with_submit'        => true,
        ]);
        $resolver->setAllowedTypes('field_name', 'string');
        $resolver->setAllowedTypes('icon_options', 'array');
        $resolver->setAllowedTypes('with_submit', 'bool');
    }
}
