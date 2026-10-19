const test = require('node:test');
const assert = require('node:assert/strict');
const {browser, load} = require('../../../module-consent/Test/JavaScript/harness.cjs');

/**
 * The Vanilla source adapter (adapter-core.js) over a scripted CookieConsent library: accept() and revoke() save the
 * mapped category through the library and keep every other choice; both wait for a banner that is still starting
 * (300 ms, ten more tries) and then give up without saving anything. hasConsent() and hasChoice() fail closed.
 */
function fixture({config = {cookie: 'cc_cookie', revision: 2, categories: {analytics: 'analytics',
    cart_reminder: 'personalization'}}, text = undefined, cookie = undefined} = {}) {
    const b = browser({'commercekings-consent-config': config});
    if (text !== undefined) {
        b.document.getElementById = id => id === 'commercekings-consent-config' ? {textContent: text} : null;
    }
    if (cookie !== undefined) {
        b.cookies.set('cc_cookie', encodeURIComponent(typeof cookie === 'string' ? cookie : JSON.stringify(cookie)));
    }
    const timers = [];
    b.context.setTimeout = (callback, delay) => { timers.push({callback, delay}); return timers.length; };
    const saves = [];
    const library = {
        configured: null, // the run() configuration's categories: null until the banner has started
        accepted: [],
        valid: false,
        getConfig: key => (key === 'categories' ? library.configured : undefined),
        getUserPreferences: () => ({acceptedCategories: library.accepted.slice()}),
        validConsent: () => library.valid,
        acceptedCategory: name => library.accepted.includes(name),
        acceptCategory: categories => { saves.push(categories.slice()); library.accepted = categories.slice(); }
    };
    let loads = 0;
    const createAdapter = load(b, 'module-consent-vanilla/view/frontend/web/js/adapter-core.js');
    const adapter = createAdapter(callback => { loads++; callback(library); });
    /** runs the timers due now (each retry schedules the next) */
    const tick = () => {
        const due = timers.splice(0);
        due.forEach(timer => { assert.equal(timer.delay, 300); timer.callback(); });
        return due.length;
    };
    return {b, adapter, library, saves, timers, tick, loads: () => loads};
}

test('accept saves the mapped category and keeps the other accepted ones', () => {
    const f = fixture();
    f.library.configured = {necessary: {}, analytics: {}, personalization: {}};
    f.library.accepted = ['necessary', 'analytics'];
    f.adapter.accept('cart_reminder');
    assert.deepEqual(f.saves, [['necessary', 'analytics', 'personalization']]);
    f.adapter.accept('cart_reminder');
    assert.equal(f.saves.length, 1, 'already accepted: nothing saved again');
});

test('accept of a purpose without a category does not even load the library', () => {
    const f = fixture();
    f.adapter.accept('marketing');
    assert.equal(f.loads(), 0);
    assert.deepEqual(f.saves, []);
});

test('accept waits for the banner to start, then saves', () => {
    const f = fixture();
    f.adapter.accept('cart_reminder');
    assert.deepEqual(f.saves, [], 'no categories configured yet');
    f.tick();
    f.tick();
    f.library.configured = {necessary: {}, personalization: {}};
    f.library.accepted = ['necessary'];
    f.tick();
    assert.deepEqual(f.saves, [['necessary', 'personalization']]);
    assert.equal(f.timers.length, 0, 'no more tries');
});

test('accept gives up after ten more tries without saving anything', () => {
    const f = fixture();
    f.adapter.accept('cart_reminder');
    let tries = 0;
    while (f.tick()) { tries++; }
    assert.equal(tries, 10);
    assert.deepEqual(f.saves, []);
});

test('accept for a category the banner does not have saves nothing', () => {
    const f = fixture();
    f.library.configured = {necessary: {}, analytics: {}};
    f.adapter.accept('cart_reminder');
    while (f.tick()) { /* every try finds no "personalization" */ }
    assert.deepEqual(f.saves, []);
});

test('revoke switches only the mapped category off', () => {
    const f = fixture();
    f.library.valid = true;
    f.library.accepted = ['necessary', 'analytics', 'personalization'];
    f.adapter.revoke('cart_reminder');
    assert.deepEqual(f.saves, [['necessary', 'analytics']]);
    f.adapter.revoke('cart_reminder');
    assert.equal(f.saves.length, 1, 'already off: nothing saved again');
});

test('a withdrawal from an email link while the banner is starting: retried until it can switch the category off', () => {
    // the withdrawal page revokes before the banner has read its cookie: no valid consent yet
    const f = fixture();
    f.adapter.revoke('cart_reminder');
    assert.deepEqual(f.saves, []);
    f.tick();
    f.library.valid = true;
    f.library.accepted = ['necessary', 'analytics', 'personalization'];
    f.tick();
    assert.deepEqual(f.saves, [['necessary', 'analytics']], 'the category switched off, analytics kept');
    assert.equal(f.timers.length, 0);
});

test('revoke gives up after ten more tries when the banner never has a choice', () => {
    const f = fixture();
    f.adapter.revoke('cart_reminder');
    let tries = 0;
    while (f.tick()) { tries++; }
    assert.equal(tries, 10);
    assert.deepEqual(f.saves, [], 'nothing to switch off: no choice was saved');
});

test('consent and choice fail closed: broken configuration, broken cookie, an old revision', () => {
    const full = {revision: 2, categories: ['necessary', 'analytics', 'personalization']};
    assert.equal(fixture({cookie: full}).adapter.hasConsent('cart_reminder'), true, 'control: a valid choice');
    for (const f of [fixture({text: '{"cookie": "cc_cookie"', cookie: full}), fixture({text: '', cookie: full}),
        fixture({cookie: '{not json'}), fixture({cookie: {revision: 1, categories: full.categories}}),
        fixture({cookie: {revision: 2}}), fixture()]) {
        assert.equal(f.adapter.hasConsent('cart_reminder'), false);
        assert.equal(f.adapter.hasConsent('analytics'), false);
        assert.equal(f.adapter.hasChoice(), false);
    }
    assert.equal(fixture({cookie: full}).adapter.hasConsent('marketing'), false, 'a purpose without a category');
});
