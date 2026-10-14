const test = require('node:test');
const assert = require('node:assert/strict');
const {browser, load} = require('../../../module-consent/Test/JavaScript/harness.cjs');

function cookieConfig(settings) {
    const b = browser({'commercekings-consent-banner': settings});
    let config;
    load(b, 'module-consent-vanilla/view/frontend/web/js/banner.js', {
        jquery: {mage: {cookies: {defaults: {path: '/default-shop/', domain: '.default.test'}}}},
        'CommerceKings_Consent/js/consent/provider': {},
        'vanilla-cookieconsent': {run: value => { config = value; }},
        'mage/cookies': {}
    });
    b.events.DOMContentLoaded.forEach(callback => callback());
    return config.cookie;
}

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
