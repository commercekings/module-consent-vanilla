# CommerceKings_ConsentVanilla

**Development status:** first-release feature scope frozen; polishing and verification remain before publication.

A cookie banner for Magento 2, built on the bundled
[vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) 3.1.0. It is the consent **source** for
`CommerceKings_Consent`: the visitor's choice in the banner is what features get consent from.

```sh
composer require commercekings/module-consent-vanilla:^0.1
bin/magento setup:upgrade
```

It brings `commercekings/module-consent` and the default categories (`commercekings/module-consent-defaults`).

## Setup

1. Select **Cookie banner (vanilla-cookieconsent)** in **Stores > Configuration > CommerceKings > Consent > Source**.
2. Set the *Privacy policy page* there – the banner links it.
3. Flush the full page cache.

The banner shows only while at least one optional category is in use. A "Cookie settings" link is added to the
footer links; any element with class `ck-cookie-settings` reopens the preferences.

## Customization

- **Texts**: English in code, translated with Magento's `i18n/<locale>.csv`.
- **Categories**: the defaults, or your own complete `categories` on `CommerceKings\ConsentVanilla\Model\Source` in
  your site module's `di.xml` – then raise *Source revision*.
- **Styling**: the library's CSS variables (`#cc-main { --cc-... }`) in your theme.

The banner starts no analytics and loads no external content itself; feature modules do that once consent is given.

## More

[How it works](docs/how-it-works.md) – the library and its upgrades, the source, the banner, a site `di.xml` example ·
[Compatibility](COMPATIBILITY.md) · [Changes](CHANGELOG.md)
