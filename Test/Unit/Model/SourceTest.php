<?php
declare(strict_types=1);

namespace CommerceKings\ConsentVanilla\Test\Unit\Model;

use CommerceKings\Consent\Api\CookieFormatInterface;
use CommerceKings\Consent\Api\SourceConfigInterface;
use CommerceKings\Consent\Model\CategoryMapper;
use CommerceKings\Consent\Model\PurposePool;
use CommerceKings\ConsentVanilla\Model\CookieFormat\V3;
use CommerceKings\ConsentVanilla\Model\Source;
use Magento\Framework\Stdlib\CookieManagerInterface;
use PHPUnit\Framework\TestCase;

class SourceTest extends TestCase
{
    /** as a site module's di.xml defines them */
    private const CATEGORIES = [
        'necessary' => ['label' => 'Necessary', 'required' => true, 'sort_order' => 10],
        'analytics' => ['label' => 'Analytics', 'sort_order' => 20, 'purposes' => ['analytics_purpose' => 'analytics_purpose']],
        'personalization' => ['label' => 'Personalization', 'sort_order' => 40, 'purposes' => ['cart_reminder' => 'cart_reminder', 'not_declared' => 'not_declared']],
        'marketing' => ['label' => 'Marketing', 'sort_order' => 30, 'purposes' => ['cart_reminder' => 'cart_reminder']],
    ];

    private function source(?string $cookie, string $revision = '1', ?array $formats = null): Source
    {
        $manager = $this->createMock(CookieManagerInterface::class);
        $manager->method('getCookie')->with('ck_cookie_consent')->willReturn($cookie);
        $purposes = new PurposePool(['cart_reminder' => ['label' => 'Cart reminder'], 'analytics_purpose' => ['label' => 'Analytics']]);
        $config = $this->createStub(SourceConfigInterface::class);
        $config->method('getRevision')->willReturn($revision);
        $config->method('getCookieName')->willReturn('ck_cookie_consent');
        return new Source($manager, new CategoryMapper($purposes), $config, self::CATEGORIES, $formats ?? ['v3' => new V3()]);
    }

    private static function cookie(array $data): string
    {
        return (string)json_encode($data + [
            'categories' => ['necessary', 'personalization'],
            'revision' => 1,
            'consentId' => '2b8885ca-7706-4557-8a47-b31cc07d2cce',
            'consentTimestamp' => '2026-10-10T08:00:00.000Z',
            'lastConsentTimestamp' => '2026-10-10T09:00:00.000Z',
            'expirationTime' => 1807631509815,
        ]);
    }

    public function testEverythingAboutTheSourceComesFromCode(): void
    {
        $source = $this->source(null);
        $this->assertSame('3.1.0', $source->getVersion(), 'newest cookie format reader');
        $this->assertSame(['necessary', 'analytics', 'marketing', 'personalization'], array_keys($source->getCategories()), 'sort_order');
        $this->assertSame(['cart_reminder'], $source->getCategories()['personalization']['purposes'], 'undeclared purposes dropped');
        $this->assertTrue($source->getCategories()['necessary']['required']);
    }

    public function testChoiceGivesThePurposesOfTheAcceptedCategories(): void
    {
        $choice = $this->source(self::cookie([]))->getChoice();
        $this->assertSame(['cart_reminder'], $choice->purposes);
        $this->assertSame('2b8885ca-7706-4557-8a47-b31cc07d2cce', $choice->reference);
        $this->assertSame('2026-10-10 09:00:00', $choice->givenAt);
        $this->assertSame('2027-04-13 15:51:49', $choice->expiresAt);
        $this->assertSame([], $this->source(self::cookie(['categories' => ['necessary']]))->getChoice()->purposes);
        $this->assertSame(['analytics_purpose', 'cart_reminder'], $this->source(self::cookie(['categories' => ['analytics', 'marketing']]))->getChoice()->purposes, 'any granting category');
    }

    /** @dataProvider noChoice */
    #[\PHPUnit\Framework\Attributes\DataProvider('noChoice')]
    public function testNoTrustworthyChoice(?string $cookie, string $revision): void
    {
        $this->assertNull($this->source($cookie, $revision)->getChoice());
    }

    public static function noChoice(): array
    {
        return [
            'no cookie' => [null, '1'],
            'broken cookie' => ['{broken', '1'],
            'v2 cookie, only the v3 reader registered' => ['{"level":["necessary","personalization"],"revision":0}', '1'],
            'saved for an older revision' => [self::cookie([]), '2'],
        ];
    }

    public function testClientConfigNamesTheCategoryTheAdapterWatchesPerPurpose(): void
    {
        $this->assertSame(
            ['cookie' => 'ck_cookie_consent', 'revision' => 1, 'categories' => ['analytics_purpose' => 'analytics', 'cart_reminder' => 'marketing']],
            $this->source(null)->getClientConfig()
        );
    }

    public function testTheNewestMatchingCookieFormatReadsTheCookie(): void
    {
        $v4 = $this->createStub(CookieFormatInterface::class);
        $v4->method('getVersion')->willReturn('4.0.0');
        $v4->method('matches')->willReturnCallback(fn (array $c) => isset($c['v4']));
        $v4->method('revision')->willReturn('1');
        $v4->method('acceptedCategories')->willReturn(['personalization']);
        $v4->method('reference')->willReturn('from-v4');
        $v4->method('consentTime')->willReturn('2026-10-10 10:00:00');
        $v4->method('expiresAt')->willReturn('');
        $formats = ['v3' => new V3(), 'v4' => $v4];
        $this->assertSame('4.0.0', $this->source(null, '1', $formats)->getVersion());
        $this->assertSame('from-v4', $this->source((string)json_encode(['v4' => true]), '1', $formats)->getChoice()->reference);
        $this->assertSame('2b8885ca-7706-4557-8a47-b31cc07d2cce', $this->source(self::cookie([]), '1', $formats)->getChoice()->reference);
    }
}
