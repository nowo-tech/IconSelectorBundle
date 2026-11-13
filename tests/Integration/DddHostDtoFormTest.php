<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Integration;

use Nowo\IconSelectorBundle\Form\IconSelectorType;
use Nowo\IconSelectorBundle\Service\IconCatalogInterface;
use Nowo\IconSelectorBundle\Service\SvgSanitizer;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Form\Extension\Core\CoreExtension;
use Symfony\Component\Form\Extension\Core\Type\FormType;
use Symfony\Component\Form\FormFactoryBuilder;

use function in_array;

/**
 * REQ-ARCH-001 (DDD host): the form type binds a plain request DTO (no entity, no bundle base class) and reads its
 * choices through a host implementation of IconCatalogInterface.
 */
final class DddHostDtoFormTest extends TestCase
{
    public function testSubmitsIntoAPlainDtoUsingAHostCatalogue(): void
    {
        $catalogue = new class implements IconCatalogInterface {
            public function getIcons(): array
            {
                return ['host:rocket', 'host:anchor'];
            }

            public function getIconsForSets(array $sets): array
            {
                return $this->getIcons();
            }

            public function getIconsBySet(): array
            {
                return ['host' => $this->getIcons()];
            }

            public function isValidIcon(string $iconId): bool
            {
                return in_array($iconId, $this->getIcons(), true);
            }
        };

        $factory = (new FormFactoryBuilder())
            ->addExtension(new CoreExtension())
            ->addType(new IconSelectorType($catalogue, ['host'], '/api/icon-selector/icons', null, new SvgSanitizer()))
            ->getFormFactory();

        $dto = new class {
            public ?string $icon = null;
        };

        $form = $factory->createBuilder(FormType::class, $dto, ['data_class' => $dto::class])
            ->add('icon', IconSelectorType::class)
            ->getForm();
        $form->submit(['icon' => 'host:rocket']);

        self::assertTrue($form->isSynchronized());
        self::assertSame('host:rocket', $dto->icon);
    }
}
