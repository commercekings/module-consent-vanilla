# CommerceKings_ConsentVanilla

**Development status:** first-release feature scope frozen; polishing and verification remain before publication.

Install in a Magento project with `composer require commercekings/module-consent-vanilla:^0.1` after the first
release is published. Then enable its modules:

```sh
bin/magento module:enable CommerceKings_Consent CommerceKings_ConsentDefaults CommerceKings_ConsentVanilla
bin/magento setup:upgrade
bin/magento cache:clean
```

Use the shop's normal DI compilation and static-content deployment process for production.
For development/tests use source checkouts (`--prefer-source`); release archives omit `Test/`.
See [compatibility and verification](COMPATIBILITY.md) and [changes](CHANGELOG.md).

[vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) for Magento 2: a configurable **cookie banner**, the consent **source** for `CommerceKings_Consent`, and the library itself. Requires `CommerceKings_Consent` and `CommerceKings_ConsentDefaults`, both installed by Composer. The adapter registers itself and ships generic English UI texts. The shared preset supplies categories for installed features; a site module can replace them through `di.xml` and translate texts in `i18n/<locale>.csv`.

## The library (bundled)
- `view/frontend/web/js/lib/cookieconsent.umd.js` + `css/lib/cookieconsent.css` (+ LICENSE, README with version and npm shasum), RequireJS module **`vanilla-cookieconsent`**.
- **Version:** each cookie reader states the exact library version it was written for (`CookieFormat\V3`, `VERSION` = `3.1.0`; it extends Consent's `AbstractCookieFormat` with the default paths); admin shows the newest as *Source version*. A unit test fails if the bundled file's version and the reader's disagree.
- **Versioning:** a new library major needs its own cookie reader and an adapter compatibility review. Bundle the library and readers in the same package release; the package version is independent of the library version.
- **Cookie readers per major** implement `CommerceKings\Consent\Api\CookieFormatInterface` (the contract lives in Consent – this module declares no interfaces of its own) and are registered in `di.xml` → `Model\Source` argument `formats`: today `CookieFormat\V3`. After an upgrade keep the old reader – visitors still carry cookies written by the old major; `Source` picks the newest reader whose `matches()` accepts the cookie.
- Upgrade: replace the two files (verify the shasum), bump the reader's version (same cookie layout) or add a reader for the new layout and keep the old one, release a new package version.

- `Model\Source::getChoice()` – the banner cookie as a `SourceChoice`: a purpose is agreed to when its **category** is accepted; the choice is identified by `consentId` (stays while the visitor changes choices) + `lastConsentTimestamp` (changes on every save); `revision` and `expirationTime` from the cookie. A cookie saved for another revision than *Banner revision* is **no choice** – the banner asks again, every consent of the old revision is invalid (CommerceKings_Consent).
- `view/frontend/web/js/adapter.js` (v3) – reads the cookie (ignored when its revision is not the configured one), `hasChoice()`, listens to `cc:onFirstConsent` / `cc:onChange` (fires only when that purpose's category changed), `accept(purpose)` / `revoke(purpose)` through the bundled library, preserving other choices.
- Registered in `Consent\Model\SourcePool` as `vanilla-cookieconsent` (etc/di.xml).

Category normalization and purpose mapping use Consent's shared `Model\CategoryMapper`. This source supplies its category-key restrictions and reads the Vanilla cookie; by default the categories come from `CommerceKings_ConsentDefaults` (installed with this adapter), each shown only while a feature uses it. A site may configure its own `categories` on this source's DI type; a nonempty site definition replaces the preset entirely.

Choose the source in **Stores > Configuration > CommerceKings > Consent**, or set `commercekings_consent/general/source` in your site module's `etc/config.xml`. Installing an adapter does not change the selected source. ConsentDefaults is a required dependency and supplies the starting categories. A nonempty site definition replaces the preset. If the resulting configuration contains only required categories, no banner or preferences link is rendered.

## The banner
`view/frontend/web/js/banner.js`, started on every page (`layout/default.xml`, `templates/banner.phtml` prints `#commercekings-consent-banner`). Nothing in it knows a category by name – category definitions come from the site's `di.xml` through `Model\Source`:

- **Categories** (argument `categories`) in `sort_order`: label, description, `required`, **`purposes`** (the purposes the category grants). Feature modules own cookie cleanup.
- **Texts**: English in code (`ViewModel\Banner`, category labels/descriptions in ConsentDefaults or the site's `di.xml`), translated with Magento i18n per store view locale.
- **Features** use `CommerceKings_Consent/js/consent/provider`. GA lives in the optional `CommerceKings_ConsentGoogleTag` module; iframe behavior belongs to the site. This banner starts no analytics and loads no external content.
- **Cookie settings link:** a "Cookie settings" item in Magento's footer links; any element with class `ck-cookie-settings` (or the library's `data-cc="show-preferencesModal"`) reopens the preferences. `html` gets class `ck-consent-on` while the banner runs. Themes without `footer_links` place their own link.
- Cookie name, revision and cookie lifetime are Consent's admin settings (the shop's decisions - a package upgrade never changes them); banner and source use the same values. The banner shows when vanilla-cookieconsent is the chosen *Source* and the site configuration or shared preset includes an optional category. The privacy page link is Consent's *Privacy / cookie policy page* (`Api\BannerSettingsInterface`).
- Cookie path and domain come from Magento's cookie configuration, matching Consent's browser identity and retry hints.
- Styling: the library's CSS variables (`#cc-main { --cc-... }`) in your theme.

## Example: a site module's di.xml
Declare any feature purpose in its owning module first, then map it in the site module (sequenced after this adapter). Category names are independent of purpose codes:

```xml
<type name="CommerceKings\ConsentVanilla\Model\Source">
    <arguments>
        <argument name="categories" xsi:type="array">
            <item name="necessary" xsi:type="array">
                <item name="label" xsi:type="string">Strictly necessary</item>
                <item name="description" xsi:type="string">Required for this site's essential functionality.</item>
                <item name="required" xsi:type="boolean">true</item>
                <item name="sort_order" xsi:type="number">10</item>
            </item>
            <item name="optional" xsi:type="array">
                <item name="label" xsi:type="string">Optional feature</item>
                <item name="description" xsi:type="string">Describe what the visitor agrees to here.</item>
                <item name="sort_order" xsi:type="number">20</item>
                <item name="purposes" xsi:type="array">
                    <item name="example_feature" xsi:type="string">example_feature</item>
                </item>
            </item>
        </argument>
    </arguments>
</type>
```
Admin (Consent) shows the result read-only: *Source version* and *Source categories*. Raising *Source revision* asks visitors again and invalidates earlier consents. Cookie patterns displayed in admin come from feature purpose metadata; this adapter performs no cookie cleanup.

## Tests
From the Magento root, with the package installed:
```sh
vendor/bin/phpunit --no-configuration --bootstrap vendor/autoload.php vendor/commercekings/module-consent-vanilla/Test/Unit
```
