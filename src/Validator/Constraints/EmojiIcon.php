<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Validator\Constraints;

use Attribute;
use Symfony\Component\Validator\Constraint;

/**
 * Validates an "emoji:<grapheme>" icon value: exactly one RGI emoji from the bundled catalogue.
 *
 * Values without the "emoji:" prefix (icon ids such as "tabler:home") are left to other constraints unless
 * $emojiOnly is true. Null and '' are valid (use NotBlank to require a value). Requires symfony/validator.
 *
 * @author Héctor Franco Aceituno <hectorfranco@nowo.tech>
 */
#[Attribute(Attribute::TARGET_PROPERTY | Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
final class EmojiIcon extends Constraint
{
    public const INVALID_EMOJI_ERROR = '5f0b8c1e-3d2a-4b7e-9c41-6a2f0d9e7b13';
    public const NOT_EMOJI_ERROR     = 'a7d3e2c9-1b4f-4e8a-8d6c-2f9b0e5a4c71';

    protected const ERROR_NAMES = [
        self::INVALID_EMOJI_ERROR => 'INVALID_EMOJI_ERROR',
        self::NOT_EMOJI_ERROR     => 'NOT_EMOJI_ERROR',
    ];

    public string $message         = 'emoji.invalid';
    public string $notEmojiMessage = 'emoji.not_emoji';
    public bool $emojiOnly         = false;

    /**
     * @param list<string>|null $groups
     */
    public function __construct(
        ?bool $emojiOnly = null,
        ?string $message = null,
        ?string $notEmojiMessage = null,
        ?array $groups = null,
        mixed $payload = null,
    ) {
        parent::__construct(null, $groups, $payload);
        $this->emojiOnly       = $emojiOnly ?? $this->emojiOnly;
        $this->message         = $message ?? $this->message;
        $this->notEmojiMessage = $notEmojiMessage ?? $this->notEmojiMessage;
    }

    public function validatedBy(): string
    {
        return EmojiIconValidator::class;
    }
}
