const test = require('node:test');
const assert = require('node:assert/strict');
const {fixture} = require('./hyva-harness.cjs');

test('native startup uses the existing source config and escapes the privacy link', () => {
    const f = fixture();
    assert.equal(f.config().cookie.name, 'cc_cookie');
    assert.equal(f.config().cookie.expiresAfterDays, 30);
    assert.equal(f.config().cookie.path, '/shop/');
    assert.match(f.config().language.translations.shop.consentModal.description, /lang=en&amp;label=&quot;policy&quot;/);
    assert.match(f.config().language.translations.shop.consentModal.description, /Privacy &amp; &quot;cookies&quot;/);
    assert.equal(f.b.context.define, undefined, 'does not install an AMD loader');
    assert.equal(f.b.context.jQuery, undefined);
});

test('startup waits for parsed configuration and publishes the provider once', () => {
    const f = fixture({loading: true});
    assert.equal(f.provider(), undefined);
    const announced = [];
    f.b.context.addEventListener('ck-consent:ready', event => announced.push(event.detail.provider));
    f.b.document.readyState = 'interactive';
    f.dispatch('DOMContentLoaded');
    assert.equal(announced[0], f.provider());
    f.run();
    assert.equal(announced.length, 1, 'a duplicate asset must not create a second synchronization queue');
});

test('no selected banner or another source leaves the storefront state alone', () => {
    for (const options of [{noBanner: true}, {source: {adapter: ''}}, {source: {adapter: 'Other/js/adapter'}}]) {
        const f = fixture(options);
        assert.equal(f.provider(), undefined);
        assert.equal(f.config(), undefined);
        assert.equal(f.requests.length, 0);
        assert.equal(f.b.context.cookie_consent_groups.analytics, true);
    }
});

test('a missing library asset leaves the provider unavailable and sends no grant', () => {
    const f = fixture({loading: true});
    delete f.b.context.CookieConsent;
    f.b.document.readyState = 'interactive';
    assert.doesNotThrow(() => f.dispatch('DOMContentLoaded'));
    assert.equal(f.provider(), undefined);
    assert.equal(f.requests.length, 0);
    assert.equal(f.config(), undefined);
});

test('Hyva groups fail closed and preserve existing cookie declarations', () => {
    const f = fixture();
    assert.equal(f.b.context.cookie_consent_groups.analytics, false);
    assert.equal(f.b.context.cookie_consent_groups.unknown, false);
    assert.equal(f.b.context.cookie_consent_groups.necessary, true);
    assert.deepEqual(Array.from(f.b.context.cookie_consent_config.necessary), ['form_key', 'cc_cookie', 'ck_consent_seen']);
    assert.deepEqual(f.b.context.cookie_consent_config.analytics, ['_ga']);
});

test('unrecorded analytics follows the saved source without requesting its recording', () => {
    const f = fixture();
    f.choose(['analytics']);
    assert.equal(f.requests.some(request => new URLSearchParams(request.body).get('purpose') === 'analytics'), false);
    assert.equal(f.provider().hasConsent('analytics'), true);
    assert.equal(f.b.context.cookie_consent_groups.analytics, true);
    f.choose([]);
    assert.equal(f.provider().hasConsent('analytics'), false);
    assert.equal(f.b.context.cookie_consent_groups.analytics, false);
});

test('a recorded purpose and its Hyva group wait for the server acknowledgement', async () => {
    const f = fixture();
    f.choose(['personalization']);
    const request = f.requests[0];
    assert.equal(request.url, 'https://shop.example.test/shop/ckconsent/grant');
    assert.equal(request.method, 'POST');
    assert.equal(request.credentials, 'same-origin');
    assert.equal(request.headers['X-Requested-With'], 'XMLHttpRequest');
    assert.equal(new URLSearchParams(request.body).get('form_key'), 'native-form-key');
    assert.equal(new URLSearchParams(request.body).get('purpose'), 'cart_reminder');
    assert.equal(f.provider().hasConsent('cart_reminder'), false);
    assert.equal(f.b.context.cookie_consent_groups.personalization, false);
    request.complete(); await f.flush();
    assert.equal(f.provider().hasConsent('cart_reminder'), true);
    assert.equal(f.b.context.cookie_consent_groups.personalization, true);
});

test('a fresh cached page gets its missing form key through Hyvas native helper', () => {
    const f = fixture();
    f.b.cookies.delete('form_key');
    f.choose(['personalization']);
    assert.equal(new URLSearchParams(f.requests[0].body).get('form_key'), 'generated-native-form-key');
    assert.equal(f.b.cookies.get('form_key'), 'generated-native-form-key');
});

test('concurrent recorded grants are serialized to retain one browser identity', async () => {
    const f = fixture({source: {recorded: ['analytics', 'cart_reminder']}});
    f.choose(['analytics', 'personalization']);
    assert.equal(f.requests.length, 1);
    f.requests[0].complete(); await f.flush();
    assert.equal(f.requests.length, 2);
    f.requests[1].complete(); await f.flush();
    assert.equal(f.provider().hasConsent('analytics'), true);
    assert.equal(f.provider().hasConsent('cart_reminder'), true);
});

test('a stale grant response cannot restore a choice already rejected', async () => {
    const f = fixture();
    f.choose(['personalization']);
    f.choose([]);
    f.requests[0].complete(); await f.flush();
    assert.equal(f.provider().hasConsent('cart_reminder'), false);
    assert.equal(f.b.context.cookie_consent_groups.personalization, false);
    assert.ok(f.requests[1].url.endsWith('/withdraw'));
    f.requests[1].complete({withdrawn: 1}); await f.flush();
    assert.equal(f.seen().cart_reminder, undefined);
});

test('HTTP failure, malformed JSON, network failure and refused grants all fail closed', async () => {
    for (const fail of [r => r.complete({}, 503), r => r.malformed(), r => r.fail(new Error('offline')), r => r.complete({granted: false})]) {
        const f = fixture();
        f.choose(['personalization']); fail(f.requests[0]); await f.flush();
        assert.equal(f.provider().hasConsent('cart_reminder'), false);
        assert.equal(f.b.context.cookie_consent_groups.personalization, false);
        assert.equal(f.seen().cart_reminder, 2, 'not acknowledged: a later page keeps it off and asks again');
        assert.equal(f.timers.size, 0);
    }
});

test('a timed out grant releases the queue so the pending withdrawal still runs', async () => {
    const f = fixture();
    f.choose(['personalization']);
    f.choose([]);
    [...f.timers.values()].find(timer => timer.delay === 10000).callback();
    await f.flush();
    assert.equal(f.requests.length, 2);
    assert.ok(f.requests[1].url.endsWith('/withdraw'));
    f.requests[1].complete({withdrawn: 1}); await f.flush();
    assert.equal(f.seen().cart_reminder, undefined);
});

test('failed withdrawal retains its hint, retries online and beacons on navigation', async () => {
    const f = fixture();
    f.choose(['personalization']); f.requests[0].complete(); await f.flush();
    f.choose([]); f.requests[1].fail(new Error('offline')); await f.flush();
    assert.equal(f.provider().hasConsent('cart_reminder'), false);
    assert.equal(f.seen().cart_reminder, 1);
    f.dispatch('pagehide');
    assert.equal(f.beacons[0].url, 'https://shop.example.test/shop/ckconsent/withdraw');
    assert.equal(f.beacons[0].purpose, 'cart_reminder');
    f.dispatch('online');
    f.requests[2].complete({withdrawn: 0}); await f.flush();
    assert.equal(f.seen().cart_reminder, undefined);
});

test('navigation retries a historical withdrawal even after recording that purpose is disabled', async () => {
    const f = fixture({cookie: {revision: 2, categories: ['necessary']}, seen: {analytics: 1}});
    assert.equal(f.requests.length, 1);
    assert.ok(f.requests[0].url.endsWith('/withdraw'));
    assert.equal(new URLSearchParams(f.requests[0].body).get('purpose'), 'analytics');
    f.requests[0].complete({withdrawn: 1}); await f.flush();
    assert.equal(f.seen().analytics, undefined);
    assert.equal(f.provider().hasConsent('analytics'), false);
});

test('"Reject all" reaches the server even when no category is always on', async () => {
    // a site's own categories without "necessary": the saved choice then accepts nothing at all
    const banner = {categories: [{key: 'analytics', required: false}, {key: 'personalization', required: false}]};
    const f = fixture({banner});
    f.choose(['personalization']); f.requests[0].complete(); await f.flush();
    f.choose([]);
    assert.ok(f.requests[1].url.endsWith('/ckconsent/withdraw'), 'the withdrawal is sent');
    assert.equal(new URLSearchParams(f.requests[1].body).get('purpose'), 'cart_reminder');
    f.requests[1].complete({withdrawn: 1}); await f.flush();
    assert.equal(f.seen().cart_reminder, undefined);

    // ...and a page loaded later still sends a withdrawal that did not get through
    const later = fixture({banner, cookie: {revision: 2, categories: []}, seen: {cart_reminder: 1}});
    assert.ok(later.requests[0].url.endsWith('/withdraw'));
    assert.equal(new URLSearchParams(later.requests[0].body).get('purpose'), 'cart_reminder');
});

test('an old revision does not grant either a purpose or a Hyva cookie group', () => {
    const f = fixture({cookie: {revision: 1, categories: ['necessary', 'analytics', 'personalization']}});
    assert.equal(f.provider().hasConsent('analytics'), false);
    assert.equal(f.b.context.cookie_consent_groups.analytics, false);
    assert.equal(f.b.context.cookie_consent_groups.personalization, false);
});

test('a valid returning choice and the ready event support features loaded after startup', () => {
    const f = fixture({cookie: {revision: 2, categories: ['necessary', 'analytics']}});
    assert.equal(f.provider().hasConsent('analytics'), true);
    assert.equal(f.b.context.cookie_consent_groups.analytics, true);
    assert.equal(f.requests.length, 0);
});

test('confirmed email withdrawal changes only its mapped category and preserves analytics', () => {
    const f = fixture({cookie: {revision: 2, categories: ['necessary', 'analytics', 'personalization']},
        withdrawal: {'*': {'CommerceKings_Consent/js/withdrawal-banner': {purpose: 'cart_reminder'}}}});
    assert.equal(f.provider().hasConsent('cart_reminder'), false);
    assert.equal(f.provider().hasConsent('analytics'), true);
    assert.equal(f.b.context.cookie_consent_groups.personalization, false);
    assert.equal(f.b.context.cookie_consent_groups.analytics, true);
    assert.ok(f.requests[0].url.endsWith('/withdraw'));
});

test('GET confirmation and protected newer consent produce no browser preference change', () => {
    const f = fixture({cookie: {revision: 2, categories: ['necessary', 'analytics', 'personalization']}, withdrawal: {}});
    assert.equal(f.provider().hasConsent('cart_reminder'), true);
    assert.equal(f.requests.length, 0);
});

test('a group mapped to multiple purposes waits until all recorded purposes are acknowledged', async () => {
    const f = fixture({source: {categories: {analytics: 'personalization', cart_reminder: 'personalization'},
        recorded: ['analytics', 'cart_reminder']}});
    f.choose(['personalization']);
    f.requests[0].complete(); await f.flush();
    assert.equal(f.b.context.cookie_consent_groups.personalization, false);
    f.requests[1].complete(); await f.flush();
    assert.equal(f.b.context.cookie_consent_groups.personalization, true);
});

const accepted = {revision: 2, categories: ['necessary', 'analytics', 'personalization'], consentId: 'source-choice',
    consentTimestamp: '2026-10-18T10:00:00.000Z', lastConsentTimestamp: '2026-10-18T10:00:00.000Z'};

test('opening Cookie settings asks the server and switches off a category withdrawn on another device', async () => {
    const f = fixture({cookie: accepted, seen: {cart_reminder: 1}});
    f.config().onModalShow({modalName: 'consentModal'});
    assert.equal(f.requests.length, 0, 'only the preferences ask');
    f.config().onModalShow({modalName: 'preferencesModal'});
    const check = f.requests.at(-1);
    assert.equal(check.url, 'https://shop.example.test/shop/ckconsent/status');
    assert.equal(check.method, undefined, 'GET');
    assert.equal(check.cache, 'no-store');
    check.complete({withdrawn: ['cart_reminder']});
    await f.flush();
    await f.flush();
    const cookie = JSON.parse(decodeURIComponent(f.b.cookies.get('cc_cookie')));
    assert.deepEqual(cookie.categories, ['necessary', 'analytics'], 'only the withdrawn purpose category is switched off');
    assert.equal(f.requests.at(-1).url, 'https://shop.example.test/shop/ckconsent/withdraw');
});

test('a failed check leaves the banner as it is', async () => {
    const f = fixture({cookie: accepted});
    f.config().onModalShow({modalName: 'preferencesModal'});
    f.requests.at(-1).complete({}, 500);
    await f.flush();
    await f.flush();
    const cookie = JSON.parse(decodeURIComponent(f.b.cookies.get('cc_cookie')));
    assert.equal(cookie.categories.includes('personalization'), true);
});
