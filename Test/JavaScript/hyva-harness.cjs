const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {browser, modules} = require('../../../module-consent/Test/JavaScript/harness.cjs');

function fixture(options = {}) {
    const source = {
        adapter: 'CommerceKings_ConsentVanilla/js/adapter', cookie: 'cc_cookie', revision: 2,
        categories: {analytics: 'analytics', cart_reminder: 'personalization'},
        purposes: ['analytics', 'cart_reminder'], recorded: ['cart_reminder'],
        cookieLifetimeDays: 30, cookiePath: '/shop/', cookieDomain: '', ...options.source
    };
    const banner = {
        cookie: source.cookie, revision: source.revision, expiresAfterDays: 30,
        cookiePath: source.cookiePath, cookieDomain: '',
        privacyUrl: 'https://shop.example.test/privacy?lang=en&label="policy"',
        texts: {privacy_link: 'Privacy & "cookies"'},
        categories: [
            {key: 'necessary', required: true}, {key: 'analytics', required: false},
            {key: 'personalization', required: false}
        ], ...options.banner
    };
    const configs = {'commercekings-consent-config': source, 'commercekings-consent-banner': banner};
    if (options.noBanner) delete configs['commercekings-consent-banner'];
    if (options.withdrawal) configs['commercekings-consent-withdrawal'] = options.withdrawal;
    const b = browser(configs);
    const requests = [], beacons = [], timers = new Map();
    let sequence = 0, runConfig, preferences = [], first = true;
    b.document.readyState = options.loading ? 'loading' : 'complete';
    b.context.BASE_URL = 'https://shop.example.test/shop/';
    b.context.URLSearchParams = URLSearchParams;
    b.context.AbortController = AbortController;
    b.context.FormData = FormData;
    b.context.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
    const dispatch = (type, detail) => (b.events[type] || []).forEach(callback => callback({type, detail}));
    b.context.dispatchEvent = event => { dispatch(event.type, event.detail); return true; };
    b.context.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, {callback, delay}); return id; };
    b.context.clearTimeout = id => timers.delete(id);
    b.context.hyva = {
        getCookie: name => b.cookies.get(name) || null,
        getFormKey() {
            if (!b.cookies.has('form_key')) b.cookies.set('form_key', 'generated-native-form-key');
            return b.cookies.get('form_key');
        }
    };
    b.cookies.set('form_key', 'native-form-key');
    if (options.cookie) b.cookies.set(source.cookie, encodeURIComponent(JSON.stringify(options.cookie)));
    if (options.seen) b.cookies.set('ck_consent_seen', encodeURIComponent(JSON.stringify(options.seen)));
    b.context.cookie_consent_config = {necessary: ['form_key'], analytics: ['_ga'], unknown: ['_unknown']};
    b.context.cookie_consent_groups = {necessary: true, analytics: true, unknown: true};
    b.context.navigator.sendBeacon = (url, data) => { beacons.push({url, purpose: data.get('purpose')}); return true; };
    b.context.fetch = (url, request) => new Promise((resolve, reject) => {
        requests.push({url, ...request, complete(body = {granted: true}, status = 200) {
            resolve({ok: status >= 200 && status < 300, json: () => Promise.resolve(body)});
        }, fail: reject, malformed() { resolve({ok: true, json: () => Promise.reject(new SyntaxError('Invalid JSON'))}); }});
        request.signal.addEventListener('abort', () => reject(new Error('Request timed out.')));
    });
    function saved() {
        try { return JSON.parse(decodeURIComponent(b.cookies.get(source.cookie) || 'null')); } catch { return null; }
    }
    const library = b.context.CookieConsent = {
        run(config) {
            runConfig = config;
            const cookie = saved();
            preferences = cookie?.revision === source.revision ? cookie.categories || [] : [];
            first = !preferences.length;
            if (!first) dispatch('cc:onConsent', {cookie});
        },
        getConfig: key => key === 'categories' ? runConfig?.categories : runConfig,
        getUserPreferences: () => ({acceptedCategories: preferences.slice()}),
        validConsent: () => preferences.length > 0,
        acceptedCategory: name => preferences.includes(name),
        showPreferences() {},
        acceptCategory(accepted) {
            const previous = preferences.slice();
            preferences = [...new Set((banner.categories || []).filter(c => c.required).map(c => c.key).concat(accepted))];
            const cookie = {revision: source.revision, categories: preferences, consentId: 'source-choice',
                consentTimestamp: new Date().toISOString(), lastConsentTimestamp: new Date().toISOString()};
            b.cookies.set(source.cookie, encodeURIComponent(JSON.stringify(cookie)));
            const changedCategories = [...new Set(previous.concat(preferences))]
                .filter(key => previous.includes(key) !== preferences.includes(key));
            dispatch(first ? 'cc:onFirstConsent' : 'cc:onChange', {cookie, changedCategories});
            first = false;
        }
    };
    // Page order: this banner registers its adapter before Consent's Hyvä provider starts.
    const scripts = [
        'module-consent/view/frontend/web/js/consent/provider-core.js',
        'module-consent-vanilla/view/frontend/web/js/adapter-core.js',
        'module-consent-vanilla/view/frontend/web/js/banner-core.js',
        'module-consent-vanilla/view/frontend/web/js/hyva.js',
        'module-consent/view/frontend/web/js/consent/hyva.js'
    ];
    const run = () => scripts.forEach(file => vm.runInContext(fs.readFileSync(path.join(modules, file), 'utf8'), b.context, {filename: file}));
    run();
    const flush = () => new Promise(resolve => setImmediate(resolve));
    return {b, source, banner, requests, beacons, timers, library, dispatch, run, flush,
        provider: () => b.context.CommerceKingsConsent.provider,
        config: () => runConfig,
        choose: categories => library.acceptCategory(categories),
        seen: () => JSON.parse(decodeURIComponent(b.cookies.get('ck_consent_seen') || '{}'))};
}

module.exports = {fixture};
