<?php
declare(strict_types=1);

namespace CommerceKings\ConsentVanilla\Test\Unit\ViewModel;

use CommerceKings\Consent\Api\BannerSettingsInterface;
use CommerceKings\Consent\Api\SourceConfigInterface;
use CommerceKings\Consent\Model\CategoryMapper;
use CommerceKings\Consent\Model\PurposePool;
use CommerceKings\ConsentVanilla\Model\Source;
use CommerceKings\ConsentVanilla\ViewModel\Banner;
use Magento\Framework\Stdlib\CookieManagerInterface;
use PHPUnit\Framework\TestCase;

class BannerTest extends TestCase
{
    private const CATEGORIES = [
        'stats' => ['label' => 'Stats', 'sort_order' => 20, 'google_analytics' => true, 'cookies' => ['^_ga', '^_gid']],
        'necessary' => ['label' => 'Necessary', 'description' => 'd', 'required' => true, 'sort_order' => 10],
        'bad key!' => ['label' => 'x', 'sort_order' => 30],
    ];

    private function banner(
        string $chosen = 'vanilla-cookieconsent',
        string $privacy = 'https://shop.test/privacy',
        array $categories = self::CATEGORIES
    ): Banner {
        $sourceConfig = $this->createMock(SourceConfigInterface::class);
        $sourceConfig->method('getSourceCode')->willReturn($chosen);
        $sourceConfig->method('getRevision')->willReturn('3');
        $sourceConfig->method('getCookieName')->willReturn('ck_cookie_consent');
        $sourceConfig->method('getCookieLifetimeDays')->willReturn(90);
        $settings = $this->createMock(BannerSettingsInterface::class);
        $settings->method('getPrivacyUrl')->willReturn($privacy);
        $source = new Source($this->createMock(CookieManagerInterface::class), new CategoryMapper(new PurposePool([])), $sourceConfig, $categories);
        return new Banner($sourceConfig, $settings, $source);
    }

    public function testBannerShowsTheSourceDefinedInCode(): void
    {
        $banner = $this->banner();
        $json = json_decode($banner->getConfigJson(), true);
        $this->assertSame('Cookie settings', $banner->getFooterLinkText());
        $this->assertSame('ck_cookie_consent', $json['cookie'], "the shop's cookie name (admin)");
        $this->assertSame(3, $json['revision'], "the shop's revision (admin)");
        $this->assertSame(90, $json['expiresAfterDays'], "the shop's cookie lifetime (admin)");
        $this->assertSame('https://shop.test/privacy', $json['privacyUrl'], "Consent's banner setting");
        $this->assertArrayNotHasKey('analyticsCategory', $json, 'features are independent of the banner');
        $this->assertSame('We use cookies', $json['texts']['banner_title'], 'English source text, translated by Magento i18n');
        $this->assertSame([
            ['key' => 'necessary', 'title' => 'Necessary', 'description' => 'd', 'required' => true],
            ['key' => 'stats', 'title' => 'Stats', 'description' => '', 'required' => false],
            ['key' => 'badkey', 'title' => 'x', 'description' => '', 'required' => false],
        ], $json['categories'], 'sort_order; bad keys cleaned');
    }

    public function testCannotBreakOutOfTheScriptElement(): void
    {
        $this->assertStringNotContainsString('<', $this->banner('vanilla-cookieconsent', 'https://x.test/</script>')->getConfigJson());
    }

    public function testShownExactlyWhenItIsTheChosenSource(): void
    {
        $this->assertTrue($this->banner()->isEnabled());
        $this->assertFalse($this->banner('other-banner')->isEnabled());
        $this->assertFalse($this->banner('')->isEnabled());
    }

    public function testUnconfiguredAdapterDoesNotShowAnEmptyBanner(): void
    {
        $banner = $this->banner('vanilla-cookieconsent', '', []);
        $this->assertFalse($banner->isEnabled());
        $this->assertSame([], json_decode($banner->getConfigJson(), true)['categories']);
    }

    public function testNoBannerWhenOnlyStrictlyNecessaryIsLeft(): void
    {
        $this->assertFalse($this->banner('vanilla-cookieconsent', 'https://shop.test/privacy', [
            'necessary' => ['label' => 'Necessary', 'required' => true],
        ])->isEnabled());
    }
}
