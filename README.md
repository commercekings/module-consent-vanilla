# Cookie banner<a href="https://commercekings.net"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/commercekings/module-consent-vanilla/main/.github/commercekings-dark.svg"><img align="right" width="152" src="https://raw.githubusercontent.com/commercekings/module-consent-vanilla/main/.github/commercekings-light.svg" alt="Built by CommerceKings. Ready to sell more? Talk to us"></picture></a>

Works with Magento 2.4.4+ · Luma and Hyvä · PHP 8.1–8.5

[![License](https://badgen.net/github/license/commercekings/module-consent-vanilla)](LICENSE) [![Release](https://badgen.net/github/release/commercekings/module-consent-vanilla)](https://github.com/commercekings/module-consent-vanilla/releases) [![Checks](https://github.com/commercekings/module-consent-vanilla/actions/workflows/checks.yml/badge.svg?branch=main)](https://github.com/commercekings/module-consent-vanilla/actions/workflows/checks.yml)

**A fast, clean cookie banner that records real, provable consent.**

- **Luma and Hyvä, detected automatically** – nothing to configure per theme.
- **Only what you use.** Categories appear only when a feature needs them.
- **Ready for your policy.** Privacy policy link and a "Cookie settings" link built in.
- **Yours to style.** Translatable texts and CSS variables for your theme.

Built on the bundled [vanilla-cookieconsent](https://github.com/orestbida/cookieconsent) 3.1.0; it is the consent
**source** for **Consent**.

## Installation

```sh
composer require commercekings/module-consent-vanilla:^0.1
bin/magento setup:upgrade
```

It brings **Consent** and the default categories, and provides `commercekings/consent-source` – the banner the
notification bridge and Google tags require.

## Settings

1. Select **Cookie banner (vanilla-cookieconsent)** in **Stores > Configuration > CommerceKings > Consent > Source**.
2. Set the *Privacy policy page* there – the banner links it.
3. Flush the full page cache.

Besides the footer link, any element with class `ck-cookie-settings` reopens the preferences.

## Customization

- **Texts**: English in code, translated with Magento's `i18n/<locale>.csv`.
- **Categories**: the defaults, or your own complete `categories` on `CommerceKings\ConsentVanilla\Model\Source` in
  your site module's `di.xml` – then raise *Source revision*. List each purpose in one category; listed in several, it
  stays in the first.
- **Styling**: the library's CSS variables (`#cc-main { --cc-... }`) in your theme.

The banner starts no analytics and loads no external content itself; feature modules do that once consent is given.

## More

[How it works](docs/how-it-works.md) – the library and its upgrades, the source, the banner, a site `di.xml` example ·
[Compatibility](COMPATIBILITY.md) · [Changes](CHANGELOG.md)

## Disclaimer

These modules help you ask for, record and respect your shoppers' choices – they don't make your store compliant on
their own. You are responsible for your store's privacy: what you collect, the wording you show, your privacy policy
and whether your setup meets the laws that apply to you (e.g. GDPR, ePrivacy, email marketing rules). Get legal advice
if you are unsure.

---

**Need it installed, set up or customized?** **[Get in touch →](https://commercekings.net)**
