const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const underscore = require(path.join(process.env.MAGENTO_ROOT || process.cwd(), 'lib/web/underscore.js'));
const {browser, load} = require('../../../module-consent/Test/JavaScript/harness.cjs');

function bannerConfig(settings) {
    const b = browser({'commercekings-consent-banner': settings});
    let config;
    load(b, 'module-consent-vanilla/view/frontend/web/js/banner.js', {
        jquery: {mage: {cookies: {defaults: {path: '/default-shop/', domain: '.default.test'}}}},
        underscore,
        'CommerceKings_Consent/js/consent/provider': {},
        'vanilla-cookieconsent': {run: value => { config = value; }},
        'mage/cookies': {}
    });
    b.events.DOMContentLoaded.forEach(callback => callback());
    return config;
}

const cookieConfig = settings => bannerConfig(settings).cookie;

test('banner forwards configured lifetime, path and domain to Vanilla CookieConsent', () => {
    const cookie = cookieConfig({cookie: 'shop_consent', expiresAfterDays: 45, cookiePath: '/shop/', cookieDomain: '.example.test'});
    assert.equal(cookie.name, 'shop_consent');
    assert.equal(cookie.expiresAfterDays, 45);
    assert.equal(cookie.path, '/shop/');
    assert.equal(cookie.domain, '.example.test');
});

test('banner keeps a configured root path and current host domain', () => {
    const cookie = cookieConfig({expiresAfterDays: 60, cookiePath: '/', cookieDomain: 'shop.example.test'});
    assert.equal(cookie.expiresAfterDays, 60);
    assert.equal(cookie.path, '/');
    assert.equal(cookie.domain, 'shop.example.test');
});

test('older cached banner configuration inherits Magento cookie scope', () => {
    const cookie = cookieConfig({expiresAfterDays: 90});
    assert.equal(cookie.expiresAfterDays, 90);
    assert.equal(cookie.path, '/default-shop/');
    assert.equal(cookie.domain, '.default.test');
});

test('configured privacy policy is linked in both the initial notice and preferences', () => {
    const config = bannerConfig({
        privacyUrl: 'https://shop.example.test/privacy-policy',
        texts: {privacy_link: 'Privacy policy', banner_description: 'Notice.', prefs_intro: 'Preferences.'}
    });
    const translation = config.language.translations.shop;
    const link = ' <a href="https://shop.example.test/privacy-policy" class="cc-link">Privacy policy</a>';
    assert.equal(translation.consentModal.description, 'Notice.' + link);
    assert.equal(translation.preferencesModal.sections[0].description, 'Preferences.' + link);
});

test('an empty policy setting leaves both descriptions unchanged', () => {
    const config = bannerConfig({
        privacyUrl: '', texts: {privacy_link: 'Privacy policy', banner_description: 'Notice.', prefs_intro: 'Preferences.'}
    });
    assert.equal(config.language.translations.shop.consentModal.description, 'Notice.');
    assert.equal(config.language.translations.shop.preferencesModal.sections[0].description, 'Preferences.');
});

test('policy URL attributes and translated link text are escaped with Magento\'s Underscore library', () => {
    const config = bannerConfig({
        privacyUrl: 'https://shop.example.test/privacy?locale=en&label="policy"',
        texts: {privacy_link: 'Privacy & "cookies" <policy>'}
    });
    const link = ' <a href="https://shop.example.test/privacy?locale=en&amp;label=&quot;policy&quot;" class="cc-link">Privacy &amp; &quot;cookies&quot; &lt;policy&gt;</a>';
    assert.equal(config.language.translations.shop.consentModal.description, link);
    assert.equal(config.language.translations.shop.preferencesModal.sections[0].description, link);
});
