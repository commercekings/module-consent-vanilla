/** Offline Chromium check: real CookieConsent and production scripts, mocked Magento HTTP responses. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const assets = {
    '/static/library.js': ['module-consent-vanilla/view/frontend/web/js/lib/cookieconsent.umd.js', 'text/javascript'],
    '/static/provider.js': ['module-consent/view/frontend/web/js/consent/provider-core.js', 'text/javascript'],
    '/static/adapter.js': ['module-consent-vanilla/view/frontend/web/js/adapter-core.js', 'text/javascript'],
    '/static/banner.js': ['module-consent-vanilla/view/frontend/web/js/banner-core.js', 'text/javascript'],
    '/static/hyva-banner.js': ['module-consent-vanilla/view/frontend/web/js/hyva.js', 'text/javascript'],
    '/static/hyva.js': ['module-consent/view/frontend/web/js/consent/hyva.js', 'text/javascript'],
    '/static/banner.css': ['module-consent-vanilla/view/frontend/web/css/lib/cookieconsent.css', 'text/css']
};
const requests = [];
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-hyva-browser-'));
let origin;

const scenario = `
(async function () {
    const checks = [];
    const assert = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
    const wait = async predicate => {
        for (let count = 0; count < 200; count++) {
            if (predicate()) return;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error('Timed out waiting for browser state.');
    };
    window.addEventListener('securitypolicyviolation', event => { window.cspFailure = event.violatedDirective; });
    try {
        await wait(() => window.CommerceKingsConsent?.provider && CookieConsent.getConfig('categories')?.analytics);
        const provider = window.CommerceKingsConsent.provider;
        const stage = new URL(location.href).searchParams.get('revision');
        if (stage === '3') {
            assert(!provider.hasConsent('analytics'), 'Old revision refuses analytics');
            assert(!window.cookie_consent_groups.analytics, 'Old revision refuses Hyva cookie group');
            await wait(() => document.documentElement.classList.contains('show--consent'));
            assert(true, 'Revision change reopens the real banner');
            const reject = [...document.querySelectorAll('#cc-main .cm__btn')].find(button => button.textContent === 'Reject');
            assert(!!reject, 'Real reject button is available');
            reject.click();
            await wait(() => !document.documentElement.classList.contains('show--consent'));
            assert(CookieConsent.acceptedCategory('necessary'), 'Reject keeps the required category');
            assert(!CookieConsent.acceptedCategory('analytics'), 'Reject keeps optional categories off');
            CookieConsent.showPreferences();
            await wait(() => document.documentElement.classList.contains('show--preferences'));
            assert(true, 'Settings reopen real preferences');
            assert(!window.cspFailure, 'No CSP violation in the revision flow');
            const prior = JSON.parse(sessionStorage.getItem('ck-review-checks') || '[]');
            document.getElementById('proof').textContent = JSON.stringify({ok: true, checks: prior.concat(checks)});
            return;
        }
        assert(typeof window.require === 'undefined' && typeof window.jQuery === 'undefined', 'No RequireJS or jQuery');
        assert(!provider.hasConsent('analytics') && !provider.hasConsent('cart_reminder'), 'Initial optional purposes denied');
        CookieConsent.acceptCategory(['analytics', 'personalization']);
        assert(provider.hasConsent('analytics'), 'Unrecorded analytics follows the real choice');
        assert(!provider.hasConsent('cart_reminder'), 'Recorded purpose waits for HTTP acknowledgement');
        assert(!window.cookie_consent_groups.personalization, 'Hyva group waits for HTTP acknowledgement');
        await wait(() => provider.hasConsent('cart_reminder'));
        assert(window.cookie_consent_groups.personalization, 'Hyva group opens after acknowledgement');
        const cookie = JSON.parse(decodeURIComponent(hyva.getCookie('cc_cookie')));
        assert(cookie.revision === 2 && typeof cookie.consentId === 'string' && cookie.lastConsentTimestamp,
            'Real banner retains the existing source cookie format');
        provider.revoke('cart_reminder');
        assert(!provider.hasConsent('cart_reminder'), 'Revoke stops the purpose immediately');
        assert(provider.hasConsent('analytics'), 'Revoke preserves the unrelated analytics choice');
        await wait(() => !JSON.parse(decodeURIComponent(hyva.getCookie('ck_consent_seen') || '{}')).cart_reminder);
        assert(!window.cookie_consent_groups.personalization, 'Withdrawal closes the Hyva group');
        assert(!window.cspFailure, 'No CSP violation in the grant/withdrawal flow');
        sessionStorage.setItem('ck-review-checks', JSON.stringify(checks));
        location.href = '/?revision=3';
    } catch (error) {
        document.getElementById('proof').textContent = JSON.stringify({ok: false, error: error.message, checks});
    }
}());`;

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, origin);
    if (assets[url.pathname]) {
        const [file, type] = assets[url.pathname];
        response.writeHead(200, {'Content-Type': type}); response.end(fs.readFileSync(path.join(root, file))); return;
    }
    if (url.pathname === '/fixture.js') {
        response.writeHead(200, {'Content-Type': 'text/javascript'});
        response.end(`window.BASE_URL = ${JSON.stringify(origin + '/')};
window.hyva = {getCookie: function (name) {
    const part = document.cookie.split('; ').find(value => value.startsWith(name + '='));
    return part ? part.slice(name.length + 1) : null;
}, getFormKey: function () { return this.getCookie('form_key'); }};
window.cookie_consent_config = {necessary: ['form_key'], analytics: ['_ga']};
window.cookie_consent_groups = {necessary: true, analytics: false};`); return;
    }
    if (url.pathname === '/scenario.js') {
        response.writeHead(200, {'Content-Type': 'text/javascript'}); response.end(scenario); return;
    }
    if (url.pathname.startsWith('/ckconsent/')) {
        let body = ''; for await (const chunk of request) body += chunk;
        requests.push({path: url.pathname, method: request.method, body: Object.fromEntries(new URLSearchParams(body)),
            ajax: request.headers['x-requested-with'], cookie: request.headers.cookie || ''});
        setTimeout(() => {
            response.writeHead(200, {'Content-Type': 'application/json', 'Set-Cookie': 'review_identity=issued; Path=/; HttpOnly; SameSite=Lax'});
            response.end(JSON.stringify(url.pathname.endsWith('/grant') ? {granted: true} : {withdrawn: 1}));
        }, 50); return;
    }
    const revision = url.searchParams.get('revision') === '3' ? 3 : 2;
    const source = {adapter: 'CommerceKings_ConsentVanilla/js/adapter', cookie: 'cc_cookie', revision,
        purposes: ['analytics', 'cart_reminder'], recorded: ['cart_reminder'],
        categories: {analytics: 'analytics', cart_reminder: 'personalization'}, cookieLifetimeDays: 30,
        cookiePath: '/', cookieDomain: ''};
    const banner = {cookie: 'cc_cookie', revision, expiresAfterDays: 30, cookiePath: '/', cookieDomain: '',
        texts: {banner_title: 'We use cookies', banner_description: 'Optional purposes.', banner_accept: 'Accept',
            banner_reject: 'Reject', banner_settings: 'Settings', prefs_title: 'Cookie settings', prefs_accept: 'Accept all',
            prefs_reject: 'Reject all', prefs_save: 'Save', prefs_close: 'Close', always_on: 'Always on'},
        categories: [{key: 'necessary', required: true, title: 'Necessary', description: 'Essential'},
            {key: 'analytics', required: false, title: 'Analytics', description: 'Statistics'},
            {key: 'personalization', required: false, title: 'Personalization', description: 'Reminders'}]};
    response.writeHead(200, {'Content-Type': 'text/html', 'Set-Cookie': 'form_key=browser-form-key; Path=/; SameSite=Lax',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'"});
    response.end(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/static/banner.css">
<script type="application/json" id="commercekings-consent-config">${JSON.stringify(source)}</script>
<script type="application/json" id="commercekings-consent-banner">${JSON.stringify(banner)}</script>
${['/fixture.js', ...Object.keys(assets).filter(key => key.endsWith('.js')), '/scenario.js']
    .map(file => '<script defer src="' + file + '"></script>').join('\n')}
</head><body><button class="ck-cookie-settings">Cookie settings</button><pre id="proof">pending</pre></body></html>`);
});

(async () => {
    let child;
    try {
        await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        origin = 'http://127.0.0.1:' + server.address().port;
        const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
        const installed = fs.existsSync(cache) ? fs.readdirSync(cache).filter(name => name.startsWith('chromium_headless_shell-')).sort().reverse() : [];
        const binary = process.env.CHROMIUM_BINARY || (installed.length && path.join(cache, installed[0], 'chrome-headless-shell-mac-arm64/chrome-headless-shell'));
        assert.ok(binary && fs.existsSync(binary), 'Set CHROMIUM_BINARY to an installed Chromium headless executable.');
        const args = ['--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
            '--disable-component-update', '--disable-sync', '--disable-blink-features=AutomationControlled',
            '--user-data-dir=' + profile, '--dump-dom', '--virtual-time-budget=20000', origin];
        child = spawn(binary, args, {stdio: ['ignore', 'pipe', 'pipe']});
        let stdout = '', stderr = '';
        child.stdout.on('data', data => { stdout += data; });
        child.stderr.on('data', data => { stderr += data; });
        const timer = setTimeout(() => child.kill('SIGTERM'), 30000);
        const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
        clearTimeout(timer);
        assert.equal(code, 0, stderr);
        const proof = stdout.match(/<pre id="proof">([\s\S]*?)<\/pre>/)?.[1]
            .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        assert.ok(proof && proof !== 'pending', 'Browser did not finish: ' + stderr);
        const result = JSON.parse(proof);
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.ok(requests.some(request => request.path === '/ckconsent/grant'));
        assert.ok(requests.some(request => request.path === '/ckconsent/withdraw'));
        assert.ok(requests.some(request => request.path === '/ckconsent/withdraw' && request.cookie.includes('review_identity=issued')),
            'later requests retain the browser identity issued by the first acknowledgement');
        for (const request of requests) {
            assert.equal(request.method, 'POST');
            assert.equal(request.body.form_key, 'browser-form-key');
            assert.equal(request.ajax, 'XMLHttpRequest');
            assert.equal(request.body.purpose, 'cart_reminder');
        }
        process.stdout.write(JSON.stringify({...result, httpRequests: requests.length}, null, 2) + '\n');
    } finally {
        child?.kill('SIGTERM');
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(profile, {recursive: true, force: true});
    }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
