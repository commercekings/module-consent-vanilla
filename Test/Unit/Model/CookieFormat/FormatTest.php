<?php
declare(strict_types=1);

namespace CommerceKings\ConsentVanilla\Test\Unit\Model\CookieFormat;

use CommerceKings\ConsentVanilla\Model\CookieFormat\V3;
use PHPUnit\Framework\TestCase;

class FormatTest extends TestCase
{
    /** a real cookie written by vanilla-cookieconsent 3.1.0 on a test shop */
    private const V3_COOKIE = ['categories' => ['necessary', 'analytics', 'external', 'personalization'], 'revision' => 1, 'data' => null,
        'consentTimestamp' => '2026-10-10T16:31:49.815Z', 'consentId' => 'e46d5ba8-c515-476c-a831-010d94be35fd',
        'services' => ['necessary' => [], 'analytics' => []], 'languageCode' => 'shop', 'lastConsentTimestamp' => '2026-10-10T16:31:49.815Z',
        'expirationTime' => 1807631509815];

    public function testV3ReadsCategoriesTimeReferenceRevisionAndExpiry(): void
    {
        $v3 = new V3();
        $this->assertSame('3.1.0', $v3->getVersion());
        $this->assertTrue($v3->matches(self::V3_COOKIE));
        $this->assertSame(['necessary', 'analytics', 'external', 'personalization'], $v3->acceptedCategories(self::V3_COOKIE));
        $this->assertSame('2026-10-10 16:31:49', $v3->consentTime(self::V3_COOKIE));
        $this->assertSame('e46d5ba8-c515-476c-a831-010d94be35fd', $v3->reference(self::V3_COOKIE));
        $this->assertSame('1', $v3->revision(self::V3_COOKIE));
        $this->assertSame('2027-04-13 15:51:49', $v3->expiresAt(self::V3_COOKIE));
        $this->assertSame('', $v3->expiresAt(['expirationTime' => 'x'] + self::V3_COOKIE));
        $this->assertSame('0', $v3->revision(['revision' => null] + self::V3_COOKIE));
    }

    public function testV3DoesNotClaimOtherShapes(): void
    {
        $this->assertFalse((new V3())->matches(['level' => ['necessary'], 'revision' => 0])); // v2
        $this->assertFalse((new V3())->matches(['categories' => 'necessary']));
    }

    public function testV3IsWrittenForTheBundledLibrary(): void
    {
        // upgrading view/frontend/web/js/lib/cookieconsent.umd.js without a matching reader fails here
        $head = (string)file_get_contents(dirname(__DIR__, 4) . '/view/frontend/web/js/lib/cookieconsent.umd.js', false, null, 0, 200);
        $this->assertMatchesRegularExpression('/CookieConsent\s+(\d+\.\d+\.\d+)/', $head);
        preg_match('/CookieConsent\s+(\d+\.\d+\.\d+)/', $head, $m);
        $this->assertSame($m[1], (new V3())->getVersion());
    }
}
