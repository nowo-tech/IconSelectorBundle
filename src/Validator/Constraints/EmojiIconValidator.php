<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Validator\Constraints;

use Nowo\IconSelectorBundle\Emoji\EmojiCatalogInterface;
use Nowo\IconSelectorBundle\Emoji\IconValue;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;

use function is_string;

/**
 * Validator for {@see EmojiIcon}. Stateless: the catalogue is immutable.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
final class EmojiIconValidator extends ConstraintValidator
{
    public function __construct(
        private readonly EmojiCatalogInterface $catalog,
    ) {
    }

    public function validate(mixed $value, Constraint $constraint): void
    {
        if (!$constraint instanceof EmojiIcon) {
            throw new UnexpectedTypeException($constraint, EmojiIcon::class);
        }
        if ($value === null || $value === '') {
            return;
        }
        if (!is_string($value)) {
            throw new UnexpectedValueException($value, 'string');
        }

        if (!IconValue::isEmoji($value)) {
            if ($constraint->emojiOnly) {
                $this->context->buildViolation($constraint->notEmojiMessage)
                    ->setTranslationDomain('NowoIconSelectorBundle')
                    ->setCode(EmojiIcon::NOT_EMOJI_ERROR)
                    ->addViolation();
            }

            return;
        }

        $emoji = IconValue::emojiOf($value);
        if ($emoji === null || !$this->catalog->isValid($emoji)) {
            $this->context->buildViolation($constraint->message)
                ->setTranslationDomain('NowoIconSelectorBundle')
                ->setCode(EmojiIcon::INVALID_EMOJI_ERROR)
                ->addViolation();
        }
    }
}
