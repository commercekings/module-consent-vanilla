# Changelog

## Unreleased

- Decode banner cookies through Magento's JSON serializer; malformed, scalar and invalid UTF-8 cookie values cannot grant consent.

- Reject malformed cookie types and choices without a valid reference/time before granting consent.

- Self-hosted Vanilla CookieConsent 3.1.0 adapter, cookie readers and generic English banner texts.
- Prepare Composer metadata, Magento dependency bounds and source/distribution packaging for the first public release.
- Adapt unit tests to PHPUnit 12 while retaining older data-provider annotations.
- Sequence ConsentDefaults before Vanilla and align setup documentation with the required Composer dependency.
- Add PHP syntax/metadata/archive CI checks and explicit compatibility notes.

No public release has been tagged or published yet.
