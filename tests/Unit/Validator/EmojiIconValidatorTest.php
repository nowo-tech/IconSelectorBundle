<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Unit\Validator;

use Nowo\IconSelectorBundle\Emoji\EmojiCatalog;
use Nowo\IconSelectorBundle\Validator\Constraints\EmojiIcon;
use Nowo\IconSelectorBundle\Validator\Constraints\EmojiIconValidator;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use stdClass;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Exception\UnexpectedValueException;
use Symfony\Component\Validator\Test\ConstraintValidatorTestCase;

/**
 * @extends ConstraintValidatorTestCase<EmojiIconValidator>
 */
#[CoversClass(EmojiIconValidator::class)]
#[CoversClass(EmojiIcon::class)]
final class EmojiIconValidatorTest extends ConstraintValidatorTestCase
{
    protected function createValidator(): EmojiIconValidator
    {
        return new EmojiIconValidator(new EmojiCatalog());
    }

    /**
     * @return iterable<string, array{string|null}>
     */
    public static function validValues(): iterable
    {
        yield 'null' => [null];
        yield 'empty' => [''];
        yield 'icon id' => ['tabler:home'];
        yield 'emoji' => ['emoji:🚀'];
        yield 'ZWJ sequence' => ['emoji:🧑‍💻'];
        yield 'skin tone' => ['emoji:👍🏿'];
        yield 'flag' => ['emoji:🇯🇵'];
        yield 'keycap' => ["emoji:#\u{FE0F}\u{20E3}"];
    }

    #[DataProvider('validValues')]
    public function testValid(?string $value): void
    {
        $this->validator->validate($value, new EmojiIcon());

        $this->assertNoViolation();
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function invalidValues(): iterable
    {
        yield 'no grapheme' => ['emoji:'];
        yield 'text' => ['emoji:rocket'];
        yield 'two emoji' => ['emoji:🚀🚀'];
        yield 'bidi' => ["emoji:\u{202E}🚀"];
        yield 'invisible' => ["emoji:🚀\u{2060}"];
        yield 'markup' => ['emoji:<script>'];
    }

    #[DataProvider('invalidValues')]
    public function testInvalid(string $value): void
    {
        $this->validator->validate($value, new EmojiIcon(message: 'bad'));

        $this->buildViolation('bad')
            ->setCode(EmojiIcon::INVALID_EMOJI_ERROR)
            ->assertRaised();
    }

    public function testEmojiOnlyRejectsIconIds(): void
    {
        $this->validator->validate('tabler:home', new EmojiIcon(emojiOnly: true, notEmojiMessage: 'only'));

        $this->buildViolation('only')
            ->setCode(EmojiIcon::NOT_EMOJI_ERROR)
            ->assertRaised();
    }

    public function testRejectsNonStringValues(): void
    {
        $this->expectException(UnexpectedValueException::class);
        $this->validator->validate(new stdClass(), new EmojiIcon());
    }

    public function testRejectsForeignConstraints(): void
    {
        $this->expectException(UnexpectedTypeException::class);
        $this->validator->validate('emoji:🚀', new NotBlank());
    }

    public function testConstraintDefaults(): void
    {
        $constraint = new EmojiIcon();

        self::assertFalse($constraint->emojiOnly);
        self::assertSame('emoji.invalid', $constraint->message);
        self::assertSame(EmojiIconValidator::class, $constraint->validatedBy());
        self::assertSame('INVALID_EMOJI_ERROR', EmojiIcon::getErrorName(EmojiIcon::INVALID_EMOJI_ERROR));
    }
}
