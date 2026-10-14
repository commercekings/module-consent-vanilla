<?php
declare(strict_types=1);

namespace CommerceKings\ConsentVanilla\ViewModel;

use CommerceKings\Consent\Api\BannerSettingsInterface;
use CommerceKings\Consent\Api\BannerConfigInterface;
use CommerceKings\Consent\Api\SourceConfigInterface;
use CommerceKings\ConsentVanilla\Model\Source;
use Magento\Framework\Session\Config\ConfigInterface as SessionConfigInterface;
use Magento\Framework\View\Element\Block\ArgumentInterface;

/**
 * #commercekings-consent-banner: everything js/banner.js shows and does. The source (cookie name,
 * revision) comes from Consent settings, categories from the site di.xml. The texts are English here and
 * translated with Magento i18n, the privacy page is Consent's banner setting. Shown when this is the
 * chosen source - no setting of its own.
 */
class Banner implements ArgumentInterface, BannerConfigInterface
{
    public function __construct(
        private readonly SourceConfigInterface $sourceConfig,
        private readonly BannerSettingsInterface $bannerSettings,
        private readonly Source $source,
        private readonly SessionConfigInterface $sessionConfig
    ) {
    }

    /** Show only the chosen source, and only with at least one optional category. */
    public function isEnabled(): bool
    {
        // only when the visitor has something to choose: "Strictly necessary" alone needs no consent, so no banner
        return $this->sourceConfig->getSourceCode() === Source::CODE
            && array_filter($this->source->getCategories(), fn (array $category) => empty($category['required'])) !== [];
    }

    public function getFooterLinkText(): string
    {
        return $this->texts()['footer_link'];
    }

    public function getConfigJson(): string
    {
        $categories = [];
        foreach ($this->source->getCategories() as $key => $category) {
            $categories[] = [
                'key' => $key,
                'title' => $category['label'],
                'description' => $category['description'],
                'required' => $category['required'],
            ];
        }
        return (string)json_encode([
            'cookie' => $this->sourceConfig->getCookieName(),
            'revision' => (int)$this->sourceConfig->getRevision(),
            'expiresAfterDays' => $this->sourceConfig->getCookieLifetimeDays(),
            'cookiePath' => $this->sessionConfig->getCookiePath(),
            'cookieDomain' => $this->sessionConfig->getCookieDomain(),
            'privacyUrl' => $this->bannerSettings->getPrivacyUrl(),
            'texts' => $this->texts(),
            'categories' => $categories,
        ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /** @return array<string, string> the banner's texts, translated */
    private function texts(): array
    {
        return [
            'banner_title' => (string)__('We use cookies'),
            'banner_description' => (string)__('Choose whether to allow optional cookies and the data uses described in Settings. Necessary cookies remain active. You can reject optional uses and change your choice at any time.'),
            'banner_accept' => (string)__('Accept'),
            'banner_reject' => (string)__('Reject'),
            'banner_settings' => (string)__('Settings'),
            'privacy_link' => (string)__('Learn more'),
            'prefs_title' => (string)__('Cookie settings'),
            'prefs_intro' => (string)__('Choose which optional cookies and data uses you allow. Your choice applies to this browser and you can withdraw it at any time.'),
            'prefs_accept' => (string)__('Accept all'),
            'prefs_reject' => (string)__('Reject all'),
            'prefs_save' => (string)__('Save my choice'),
            'prefs_close' => (string)__('Close'),
            'always_on' => (string)__('Always on'),
            'footer_link' => (string)__('Cookie settings'),
        ];
    }
}
