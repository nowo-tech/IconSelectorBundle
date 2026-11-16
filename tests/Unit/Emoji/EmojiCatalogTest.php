<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Emoji;

use Nowo\IconSelectorBundle\Emoji\EmojiCatalog;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

use function str_repeat;

#[CoversClass(EmojiCatalog::class)]
final class EmojiCatalogTest extends TestCase
{
    /**
     * @return iterable<string, array{string}>
     */
    public static function validEmoji(): iterable
    {
        yield 'single code point' => ['🚀'];
        yield 'VS16 presentation' => ["\u{2764}\u{FE0F}"];
        yield 'minimally-qualified ZWJ' => ["\u{1F441}\u{FE0F}\u{200D}\u{1F5E8}"];
        yield 'skin tone' => ['👋🏽'];
        yield 'ZWJ family' => ['👨‍👩‍👧‍👦'];
        yield 'ZWJ with tones' => ['👩🏻‍❤️‍💋‍👨🏼'];
        yield 'flag' => ['🇪🇸'];
        yield 'subdivision flag (tags)' => ['🏴󠁧󠁢󠁥󠁮󠁧󠁿'];
        yield 'keycap' => ["1\u{FE0F}\u{20E3}"];
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function invalidEmoji(): iterable
    {
        yield 'empty' => [''];
        yield 'text' => ['rocket'];
        yield 'ascii digit' => ['1'];
        yield 'two emoji' => ['🚀🚀'];
        yield 'emoji plus text' => ['🚀a'];
        yield 'lone skin tone component' => ['🏻'];
        yield 'lone regional indicator' => ['🇪'];
        yield 'unqualified keycap' => ["1\u{20E3}"];
        yield 'unqualified ZWJ' => ["\u{1F441}\u{200D}\u{1F5E8}"];
        yield 'control char' => ["\u{0007}🚀"];
        yield 'bidi override' => ["\u{202E}🚀"];
        yield 'zero width space' => ["🚀\u{200B}"];
        yield 'trailing ZWJ' => ["🚀\u{200D}"];
        yield 'html' => ['<b>🚀</b>'];
        yield 'oversized' => [str_repeat('🚀', 20)];
        yield 'invalid utf-8' => ["\xF0\x9F\x9A"];
    }

    #[DataProvider('validEmoji')]
    public function testAcceptsRgiEmoji(string $emoji): void
    {
        $catalog = new EmojiCatalog();

        self::assertTrue($catalog->isValid($emoji));
        self::assertNotNull($catalog->getName($emoji));
    }

    #[DataProvider('invalidEmoji')]
    public function testRejectsAnythingElse(string $emoji): void
    {
        $catalog = new EmojiCatalog();

        self::assertFalse($catalog->isValid($emoji));
        self::assertNull($catalog->getName($emoji));
    }

    public function testNamesAndVersionComeFromTheBundledData(): void
    {
        $catalog = new EmojiCatalog();

        self::assertSame('rocket', $catalog->getName('🚀'));
        self::assertSame('waving hand: medium skin tone', $catalog->getName('👋🏽'));
        self::assertMatchesRegularExpression('/^\d+\.\d+$/', $catalog->getVersion());
    }

    public function testUnreadableDataYieldsAnEmptyCatalog(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'emoji');
        self::assertIsString($file);
        file_put_contents($file, '<?php return "nope";');
        try {
            $catalog = new EmojiCatalog($file);
            self::assertFalse($catalog->isValid('🚀'));
            self::assertSame('', $catalog->getVersion());
        } finally {
            unlink($file);
        }
    }
}
