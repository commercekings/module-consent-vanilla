# Changelog

## Unreleased (0.2)

- Share browser logic between the existing Magento entry points and the optional Hyvä adapter; keep the public AMD API and PHP source contracts.

## Unreleased (0.1)

- Declares `"provide": {"commercekings/consent-source": "0.1.0"}`: it is the consent banner that the bridge and
  Google tags require.
- Show the configured privacy policy in both the first notice and preferences, with an explicit translated label and escaped link markup.
- Apply Magento's configured cookie path and domain to the Vanilla banner while retaining Consent's configured lifetime.

- Decode banner cookies through Magento's JSON serializer; malformed, scalar and invalid UTF-8 cookie values cannot grant consent.

- Reject malformed cookie types and choices without a valid reference/time before granting consent.

- Self-hosted Vanilla CookieConsent 3.1.0 adapter, cookie readers and generic English banner texts.
- Prepare Composer metadata, Magento dependency bounds and source/distribution packaging for the first public release.
- Adapt unit tests to PHPUnit 12 while retaining older data-provider annotations.
- Sequence ConsentDefaults before Vanilla and align setup documentation with the required Composer dependency.
- Add PHP syntax/metadata/archive CI checks and explicit compatibility notes.

No public release has been tagged or published yet.
