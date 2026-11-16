<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Emoji;

use Nowo\IconSelectorBundle\Emoji\IconValue;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

use function str_repeat;

#[CoversClass(IconValue::class)]
final class IconValueTest extends TestCase
{
    public function testDetectsEmojiValues(): void
    {
        self::assertTrue(IconValue::isEmoji('emoji:🚀'));
        self::assertFalse(IconValue::isEmoji('tabler:home'));
        self::assertFalse(IconValue::isEmoji(null));
        self::assertFalse(IconValue::isEmoji('Emoji:🚀'));
    }

    public function testExtractsTheGrapheme(): void
    {
        self::assertSame('🚀', IconValue::emojiOf('emoji:🚀'));
        self::assertNull(IconValue::emojiOf('emoji:'));
        self::assertNull(IconValue::emojiOf('tabler:home'));
        self::assertNull(IconValue::emojiOf(null));
        self::assertNull(IconValue::emojiOf('emoji:' . str_repeat('a', IconValue::MAX_EMOJI_BYTES + 1)));
    }

    public function testBuildsTheStoredValue(): void
    {
        self::assertSame('emoji:🚀', IconValue::fromEmoji('🚀'));
    }
}
