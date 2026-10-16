<?php
declare(strict_types=1);

namespace CommerceKings\ConsentVanilla\Test\Unit;

use CommerceKings\ConsentVanilla\ViewModel\Banner;
use Magento\Framework\Escaper;
use Magento\Framework\View\Element\Template;
use PHPUnit\Framework\TestCase;

class HyvaTemplatesTest extends TestCase
{
    private function render(string $template, bool $enabled): string
    {
        $viewModel = $this->createStub(Banner::class);
        $viewModel->method('isEnabled')->willReturn($enabled);
        $viewModel->method('getConfigJson')->willReturn('{"cookie":"cc_cookie","revision":2}');
        $viewModel->method('getFooterLinkText')->willReturn('Cookie <settings>');
        $block = $this->createStub(Template::class);
        $block->method('getData')->willReturn($viewModel);
        $block->method('getViewFileUrl')->willReturnCallback(fn ($asset) => 'https://shop.test/static/' . $asset);
        $escaper = $this->createPartialMock(Escaper::class, ['escapeXssInUrl']);
        $escaper->expects($enabled && $template === 'banner' ? $this->exactly(4) : $this->never())
            ->method('escapeXssInUrl')->willReturnArgument(0);
        ob_start();
        try {
            include dirname(__DIR__, 2) . '/view/frontend/templates/hyva/' . $template . '.phtml';
            return (string)ob_get_contents();
        } finally {
            ob_end_clean();
        }
    }

    public function testAnInactiveSourceRendersNoScriptsOrSettingsButton(): void
    {
        $this->assertSame('', trim($this->render('banner', false)));
        $this->assertSame('', trim($this->render('settings', false)));
    }

    public function testTheActiveSourceUsesOrderedExternalScriptsAndTheExistingConfig(): void
    {
        $html = $this->render('banner', true);
        $this->assertStringContainsString('id="commercekings-consent-banner"', $html);
        $this->assertStringContainsString('{"cookie":"cc_cookie","revision":2}', $html);
        $document = new \DOMDocument();
        @$document->loadHTML($html);
        $urls = [];
        foreach ($document->getElementsByTagName('script') as $script) {
            if ($script->hasAttribute('src')) {
                $this->assertTrue($script->hasAttribute('defer'));
                $this->assertSame('', trim($script->textContent), 'no inline executable script');
                $urls[] = basename($script->getAttribute('src'));
            }
        }
        $this->assertSame(['cookieconsent.umd.js', 'adapter-core.js', 'banner-core.js', 'hyva.js'], $urls);
        $this->assertStringNotContainsString('text/x-magento-init', $html);
    }

    public function testTheSettingsButtonUsesTheSharedTranslatedLabelAndEscapesIt(): void
    {
        $html = $this->render('settings', true);
        $this->assertStringContainsString('ck-cookie-settings', $html);
        $this->assertStringContainsString('Cookie &lt;settings&gt;', $html);
        $this->assertStringNotContainsString('onclick', $html);
    }
}
