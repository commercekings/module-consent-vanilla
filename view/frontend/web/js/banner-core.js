/** Shared browser implementation used by the Magento and Hyvä entry points. */
(function (root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        root.CommerceKingsConsentVanilla = root.CommerceKingsConsentVanilla || {};
        root.CommerceKingsConsentVanilla.createBanner = factory();
    }
}(window, function () {
    'use strict';

    return function (CookieConsent, cookieDefaults, escapeHtml) {
        var element = document.getElementById('commercekings-consent-banner'),
            settings = element ? JSON.parse(element.textContent || '{}') : null,
            started = false;

        function text(key) {
            return (settings.texts || {})[key] || '';
        }

        function categories() {
            return settings.categories || [];
        }

        function bindSettingsLinks() {
            document.documentElement.classList.add('ck-consent-on');
            document.querySelectorAll('.ck-cookie-settings').forEach(function (link) {
                link.addEventListener('click', function (event) {
                    event.preventDefault();
                    CookieConsent.showPreferences();
                });
            });
        }

        function privacyLink() {
            return settings.privacyUrl && text('privacy_link')
                ? ' <a href="' + escapeHtml(settings.privacyUrl) + '" class="cc-link">' + escapeHtml(text('privacy_link')) + '</a>'
                : '';
        }

        function categoryConfig() {
            var config = {};
            categories().forEach(function (category) {
                config[category.key] = category.required ? {enabled: true, readOnly: true} : {};
            });
            return config;
        }

        function start() {
            if (!settings) {
                return;
            }
            if (started) {
                return;
            }
            started = true;

            CookieConsent.run({
                revision: settings.revision || 0,
                cookie: {
                    name: settings.cookie || 'cc_cookie',
                    expiresAfterDays: settings.expiresAfterDays,
                    path: settings.cookiePath || cookieDefaults.path,
                    domain: settings.cookieDomain || cookieDefaults.domain
                },
                guiOptions: {
                    consentModal: {layout: 'bar inline', position: 'bottom', equalWeightButtons: true, flipButtons: false},
                    preferencesModal: {layout: 'box', equalWeightButtons: true, flipButtons: false}
                },
                categories: categoryConfig(),
                // Consent asks the server whether a "yes" shown there was withdrawn on another device.
                onModalShow: function (event) {
                    if (event && event.modalName === 'preferencesModal' && typeof window.CustomEvent === 'function') {
                        window.dispatchEvent(new window.CustomEvent('ck-consent:preferences'));
                    }
                },
                language: {
                    default: 'shop',
                    translations: {
                        shop: {
                            consentModal: {
                                title: text('banner_title'),
                                description: text('banner_description') + privacyLink(),
                                acceptAllBtn: text('banner_accept'),
                                acceptNecessaryBtn: text('banner_reject'),
                                showPreferencesBtn: text('banner_settings')
                            },
                            preferencesModal: {
                                title: text('prefs_title'),
                                acceptAllBtn: text('prefs_accept'),
                                acceptNecessaryBtn: text('prefs_reject'),
                                savePreferencesBtn: text('prefs_save'),
                                closeIconLabel: text('prefs_close'),
                                sections: [{description: text('prefs_intro') + privacyLink()}].concat(categories().map(function (category) {
                                    return {
                                        title: category.title + (category.required
                                            ? ' <span class="pm__badge">' + text('always_on') + '</span>' : ''),
                                        description: category.description,
                                        linkedCategory: category.key
                                    };
                                }))
                            }
                        }
                    }
                }
            });

            bindSettingsLinks();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }

        return start;
    };
}));
