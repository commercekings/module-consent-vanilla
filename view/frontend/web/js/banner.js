/** Magento entry point for the shared Vanilla banner. Load the provider before starting the source. */
define([
    'jquery',
    'underscore',
    'CommerceKings_Consent/js/consent/provider',
    'vanilla-cookieconsent',
    'CommerceKings_ConsentVanilla/js/banner-core',
    'mage/cookies'
], function ($, _, provider, CookieConsent, createBanner) {
    'use strict';

    return createBanner(CookieConsent, $.mage.cookies.defaults, _.escape);
});
