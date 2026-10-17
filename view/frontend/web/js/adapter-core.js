/** Shared browser implementation used by the Magento and Hyvä entry points. */
(function (root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        root.CommerceKingsConsentVanilla = root.CommerceKingsConsentVanilla || {};
        root.CommerceKingsConsentVanilla.createAdapter = factory();
    }
}(window, function () {
    'use strict';

    return function (loadLibrary) {
        var listeners = {},
            settings = null;

        function config() {
            var element;
            if (settings === null) {
                element = document.getElementById('commercekings-consent-config');
                try {
                    settings = JSON.parse(element ? element.textContent : '{}');
                } catch (e) {
                    settings = {};
                }
            }
            return settings;
        }

        function category(purpose) {
            return (config().categories || {})[purpose];
        }

        // accepted categories of a cookie saved for the configured revision, else none
        function categoriesIn(cookie) {
            if (!cookie || String(parseInt(cookie.revision, 10) || 0) !== String(config().revision || 0)) {
                return [];
            }
            return cookie.categories || [];
        }

        function notify(purpose, isOn) {
            (listeners[purpose] || []).forEach(function (callback) {
                callback(isOn);
            });
        }

        window.addEventListener('cc:onFirstConsent', function (event) {
            var accepted = categoriesIn((event.detail || {}).cookie);
            Object.keys(listeners).forEach(function (purpose) {
                notify(purpose, accepted.indexOf(category(purpose)) !== -1);
            });
        });

        window.addEventListener('cc:onChange', function (event) {
            var detail = event.detail || {},
                accepted = categoriesIn(detail.cookie),
                changed = detail.changedCategories || [];
            Object.keys(listeners).forEach(function (purpose) {
                if (changed.indexOf(category(purpose)) !== -1) {
                    notify(purpose, accepted.indexOf(category(purpose)) !== -1);
                }
            });
        });

        // the banner cookie, if it is one saved for the configured revision
        function currentCookie() {
            var name = config().cookie,
                match = name && document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)')),
                cookie;
            try {
                cookie = match ? JSON.parse(decodeURIComponent(match[1])) : null;
            } catch (e) {
                return null;
            }
            // a saved choice even with nothing accepted ("Reject all" where no category is always on): the server
            // must hear that withdrawal too
            return cookie && Array.isArray(cookie.categories)
                && String(parseInt(cookie.revision, 10) || 0) === String(config().revision || 0) ? cookie : null;
        }

        return {
            hasChoice: function () {
                return !!currentCookie();
            },

            hasConsent: function (purpose) {
                return categoriesIn(currentCookie()).indexOf(category(purpose)) !== -1;
            },

            onChange: function (purpose, callback) {
                (listeners[purpose] = listeners[purpose] || []).push(callback);
            },

            accept: function (purpose) {
                var name = category(purpose);
                if (!name) {
                    return;
                }
                loadLibrary(function (CookieConsent) {
                    (function attempt(left) {
                        // getConfig exposes the run() configuration even before the first choice.
                        var categories = CookieConsent.getConfig('categories') || {},
                            keep;
                        if (!categories[name]) {
                            if (left > 0) {
                                setTimeout(function () { attempt(left - 1); }, 300);
                            }
                            return;
                        }
                        keep = CookieConsent.getUserPreferences().acceptedCategories.slice();
                        if (keep.indexOf(name) === -1) {
                            keep.push(name);
                            CookieConsent.acceptCategory(keep);
                        }
                    }(10));
                });
            },

            revoke: function (purpose) {
                // the library ships with this module (RequireJS "vanilla-cookieconsent")
                loadLibrary(function (CookieConsent) {
                    (function attempt(left) {
                        // the banner may still be starting on this page
                        if (!CookieConsent.validConsent()) {
                            if (left > 0) {
                                setTimeout(function () {
                                    attempt(left - 1);
                                }, 300);
                            }
                            return;
                        }
                        if (CookieConsent.acceptedCategory(category(purpose))) {
                            CookieConsent.acceptCategory(
                                CookieConsent.getUserPreferences().acceptedCategories.filter(function (name) {
                                    return name !== category(purpose);
                                })
                            );
                        }
                    }(10));
                });
            }
        };
    };
}));
