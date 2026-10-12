<?php
declare(strict_types=1);

namespace CommerceKings\ConsentVanilla\Model;

use CommerceKings\Consent\Api\CookieFormatInterface;
use CommerceKings\Consent\Api\Data\SourceChoice;
use CommerceKings\Consent\Api\SourceConfigInterface;
use CommerceKings\Consent\Api\SourceInterface;
use CommerceKings\Consent\Model\CategoryMapper;
use Magento\Framework\Stdlib\CookieManagerInterface;

/**
 * Consent source: a vanilla-cookieconsent banner. A site module supplies categories in di.xml,
 * or CategoryMapper uses the required ConsentDefaults preset;
 * this module supplies cookie readers:
 *  (cookie name, revision and cookie lifetime are the shop's admin settings, Consent)
 *  - categories: key => [label, description, required, sort_order, purposes => [purpose codes this
 *    category grants]];
 *  - formats: cookie readers per library version (Consent's CookieFormatInterface), newest first.
 * A purpose is agreed to when a category that grants it is accepted in the cookie. The choice is
 * identified by the cookie's consentId + last save time; a cookie saved for another revision is no choice.
 */
class Source implements SourceInterface
{
    public const CODE = 'vanilla-cookieconsent';

    public function __construct(
        private readonly CookieManagerInterface $cookieManager,
        private readonly CategoryMapper $categoryMapper,
        private readonly SourceConfigInterface $config,
        private readonly array $categories = [],
        /** @var array<string, CookieFormatInterface> readers, one per cookie layout */
        private readonly array $formats = []
    ) {
    }

    public function getCode(): string
    {
        return self::CODE;
    }

    public function getVersion(): string
    {
        return $this->newestFirst() ? $this->newestFirst()[0]->getVersion() : '';
    }

    public function getCategories(): array
    {
        // not memoized: labels are translated in the current locale (store emulation can switch it mid-request)
        return $this->categoryMapper->normalize($this->categories, '/[^a-z0-9_]/i');
    }

    public function getChoice(): ?SourceChoice
    {
        $value = $this->cookieManager->getCookie($this->config->getCookieName());
        $cookie = is_string($value) ? json_decode($value, true) : null;
        $format = is_array($cookie) ? $this->formatFor($cookie) : null;
        if (!$format || $format->revision($cookie) !== $this->config->getRevision()) {
            return null;
        }
        $reference = $format->reference($cookie);
        $time = $format->consentTime($cookie);
        if ($reference === '' || $time === '') {
            return null;
        }
        return new SourceChoice(
            $reference,
            $time,
            $format->revision($cookie),
            $this->categoryMapper->acceptedPurposes($this->getCategories(), $format->acceptedCategories($cookie)),
            $format->expiresAt($cookie)
        );
    }

    public function getClientConfig(): array
    {
        return [
            'cookie' => $this->config->getCookieName(),
            'revision' => (int)$this->config->getRevision(),
            'categories' => $this->categoryMapper->purposeMap($this->getCategories()),
        ];
    }

    private function formatFor(array $cookie): ?CookieFormatInterface
    {
        foreach ($this->newestFirst() as $format) {
            if ($format->matches($cookie)) {
                return $format;
            }
        }
        return null;
    }

    /** @return CookieFormatInterface[] */
    private function newestFirst(): array
    {
        $formats = array_values($this->formats);
        usort($formats, fn ($a, $b) => version_compare($b->getVersion(), $a->getVersion()));
        return $formats;
    }
}
