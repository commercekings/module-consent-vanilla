/**
 * Hyvä entry point of the Vanilla banner: registers this source's adapter with Consent's Hyvä provider
 * (CommerceKings_Consent/js/consent/hyva.js), then starts the banner and keeps Hyvä's cookie groups in sync.
 */
(function () {
    'use strict';

    var ADAPTER = 'CommerceKings_ConsentVanilla/js/adapter',
        core = window.CommerceKingsConsent = window.CommerceKingsConsent || {},
        vanilla = window.CommerceKingsConsentVanilla,
        banner = readConfig('commercekings-consent-banner'),
        library, adapter;

    function readConfig(id) {
        var node = document.getElementById(id);
        try {
            return node ? JSON.parse(node.textContent) : null;
        } catch (error) {
            return null;
        }
    }

    function escapeHtml(value) {
        var escaped = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '`': '&#x60;'};
        return String(value).replace(/[&<>"'`]/g, function (character) { return escaped[character]; });
    }

    if (!banner || !vanilla || typeof vanilla.createAdapter !== 'function'
        || typeof vanilla.createBanner !== 'function'
    ) {
        return;
    }
    core.adapters = core.adapters || {};
    // Called by the provider at startup: no library asset -> no adapter, so no provider and no consent.
    core.adapters[ADAPTER] = function () {
        library = window.CookieConsent;
        if (!library) {
            return null;
        }
        adapter = vanilla.createAdapter(function (callback) { callback(library); });
        return adapter;
    };

    window.addEventListener('ck-consent:source', function (event) {
        var provider = event.detail.provider,
            source = event.detail.source,
            groups, necessary;

        if (source.adapter !== ADAPTER || !adapter) {
            return;
        }
        // Preserve existing cookie declarations. Only the preference and retry hint are added as necessary.
        window.cookie_consent_config = window.cookie_consent_config || {};
        necessary = window.cookie_consent_config.necessary = window.cookie_consent_config.necessary || [];
        [source.cookie, 'ck_consent_seen'].forEach(function (name) {
            if (name && necessary.indexOf(name) === -1) {
                necessary.push(name);
            }
        });
        groups = window.cookie_consent_groups = window.cookie_consent_groups || {};

        function syncGroups() {
            var keys = new Set(Object.keys(window.cookie_consent_config).concat(Object.keys(groups))),
                required = new Set(['necessary']),
                changed = false;
            (banner.categories || []).forEach(function (category) {
                keys.add(category.key);
                if (category.required) {
                    required.add(category.key);
                }
            });
            keys.forEach(function (category) {
                var purposes = Object.keys(source.categories || {}).filter(function (purpose) {
                        return source.categories[purpose] === category;
                    }),
                    allowed = required.has(category) || (adapter.hasChoice() && (purposes.length
                        ? purposes.every(function (purpose) { return provider.hasConsent(purpose); })
                        : library.validConsent() && library.acceptedCategory(category)));
                if (groups[category] !== allowed) {
                    groups[category] = allowed;
                    changed = true;
                }
            });
            if (changed) {
                window.dispatchEvent(new CustomEvent('user-allowed-save-cookie'));
            }
        }

        (source.purposes || []).forEach(function (purpose) { provider.onChange(purpose, syncGroups); });
        window.addEventListener('cc:onFirstConsent', syncGroups);
        window.addEventListener('cc:onConsent', syncGroups);
        window.addEventListener('cc:onChange', syncGroups);
        syncGroups();
        vanilla.createBanner(library, {path: source.cookiePath || '/', domain: source.cookieDomain || ''}, escapeHtml);
    });
}());
