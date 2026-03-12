<?php

declare(strict_types=1);

namespace Nowo\IconSelectorBundle\Tests\Controller\Api;

use Nowo\IconSelectorBundle\Controller\Api\IconSvgController;
use Nowo\IconSelectorBundle\Service\IconListProvider;
use Nowo\IconSelectorBundle\Service\SvgSanitizer;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Symfony\Component\HttpFoundation\Request;
use Symfony\UX\Icons\IconRendererInterface;

use const JSON_THROW_ON_ERROR;

/**
 * Unit tests for the batch SVG API endpoint.
 *
 * @covers \Nowo\IconSelectorBundle\Controller\Api\IconSvgController
 */
final class IconSvgControllerTest extends TestCase
{
    /**
     * @param list<string> $allowedIconIds
     */
    private function createController(
        IconRendererInterface $renderer,
        array $allowedIconIds = ['heroicons-outline:home', 'bi:house'],
    ): IconSvgController {
        $provider = $this->createMock(IconListProvider::class);
        $provider->method('getIcons')->willReturn($allowedIconIds);

        return new IconSvgController($renderer, $provider, new SvgSanitizer());
    }

    /** GET with ids param returns a map of id => svg. */
    public function testGetWithIdsReturnsSvgMap(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')
            ->willReturnCallback(static fn (string $name): string => match ($name) {
                'heroicons-outline:home' => '<svg>home</svg>',
                'bi:house'               => '<svg>house</svg>',
                default                  => '<svg></svg>',
            });

        $controller = $this->createController($renderer);
        $request    = new Request(['ids' => 'heroicons-outline:home,bi:house']);
        $response   = $controller->__invoke($request);

        self::assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('heroicons-outline:home', $data);
        self::assertArrayHasKey('bi:house', $data);
        self::assertSame('<svg>home</svg>', $data['heroicons-outline:home']);
        self::assertSame('<svg>house</svg>', $data['bi:house']);
    }

    /** POST with JSON body {"ids": [...]} returns svg map. */
    public function testPostWithJsonBodyReturnsSvgMap(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')->willReturn('<svg></svg>');

        $controller = $this->createController($renderer);
        $request    = new Request([], [], [], [], [], [
            'CONTENT_TYPE'   => 'application/json',
            'REQUEST_METHOD' => 'POST',
        ], '{"ids":["bi:house"]}');
        $request->headers->set('Content-Type', 'application/json');
        $response = $controller->__invoke($request);

        self::assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('bi:house', $data);
    }

    /** Empty ids returns empty object. */
    public function testEmptyIdsReturnsEmptyObject(): void
    {
        $renderer   = $this->createMock(IconRendererInterface::class);
        $controller = $this->createController($renderer);
        $request    = new Request();
        $response   = $controller->__invoke($request);

        self::assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame([], $data);
    }

    /** POST without application/json content type uses GET path and returns empty when no query ids. */
    public function testPostWithNonJsonContentTypeUsesGetPath(): void
    {
        $renderer   = $this->createMock(IconRendererInterface::class);
        $controller = $this->createController($renderer);
        $request    = new Request([], [], [], [], [], [
            'CONTENT_TYPE'   => 'text/plain',
            'REQUEST_METHOD' => 'POST',
        ], '{"ids":["bi:house"]}');

        $response = $controller->__invoke($request);

        self::assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame([], $data);
    }

    /** POST with body where ids is not an array returns empty object. */
    public function testPostWithIdsNotArrayReturnsEmptyObject(): void
    {
        $renderer   = $this->createMock(IconRendererInterface::class);
        $controller = $this->createController($renderer);
        $request    = new Request([], [], [], [], [], [
            'CONTENT_TYPE'   => 'application/json',
            'REQUEST_METHOD' => 'POST',
        ], '{"ids":"single"}');
        $request->headers->set('Content-Type', 'application/json');

        $response = $controller->__invoke($request);

        self::assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame([], $data);
    }

    /** When renderer throws for an icon, that id gets empty string in the response. */
    public function testRendererThrowsReturnsEmptyStringForThatIcon(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')
            ->willReturnCallback(static function (string $id): string {
                if ($id === 'bi:house') {
                    throw new RuntimeException('Unknown icon');
                }

                return '<svg>ok</svg>';
            });

        $controller = $this->createController($renderer);
        $request    = new Request(['ids' => 'heroicons-outline:home,bi:house']);
        $response   = $controller->__invoke($request);

        self::assertSame(200, $response->getStatusCode());
        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('<svg>ok</svg>', $data['heroicons-outline:home']);
        self::assertSame('', $data['bi:house']);
    }

    /** Empty string in ids list is skipped (not passed to renderer). */
    public function testEmptyIdInListIsSkipped(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')->with('bi:house')->willReturn('<svg>house</svg>');

        $controller = $this->createController($renderer);
        $request    = new Request(['ids' => 'bi:house,,heroicons-outline:home']);
        $response   = $controller->__invoke($request);

        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertCount(2, $data);
        self::assertArrayHasKey('bi:house', $data);
        self::assertArrayHasKey('heroicons-outline:home', $data);
    }

    /** IDs not in the configured icon list are not rendered and omitted from the response. */
    public function testIdsNotInAllowedListAreOmitted(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->expects(self::once())->method('renderIcon')->with('heroicons-outline:home')->willReturn('<svg>home</svg>');

        $controller = $this->createController($renderer, ['heroicons-outline:home']);
        $request    = new Request(['ids' => 'heroicons-outline:home,bi:house,unknown:icon']);
        $response   = $controller->__invoke($request);

        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        self::assertArrayHasKey('heroicons-outline:home', $data);
        self::assertArrayNotHasKey('bi:house', $data);
        self::assertArrayNotHasKey('unknown:icon', $data);
    }

    /** SVG output is sanitized (script tags and event attributes removed). */
    public function testSvgOutputIsSanitized(): void
    {
        $renderer = $this->createMock(IconRendererInterface::class);
        $renderer->method('renderIcon')
            ->with('heroicons-outline:home')
            ->willReturn('<svg onload="alert(1)"><script>evil()</script><path d=""/></svg>');

        $controller = $this->createController($renderer);
        $request    = new Request(['ids' => 'heroicons-outline:home']);
        $response   = $controller->__invoke($request);

        $data = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $svg  = $data['heroicons-outline:home'] ?? '';
        self::assertStringNotContainsString('script', $svg);
        self::assertStringNotContainsString('onload', $svg);
        self::assertStringContainsString('<path', $svg);
    }
}
