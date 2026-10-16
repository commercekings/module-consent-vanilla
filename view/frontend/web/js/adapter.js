/** Magento entry point for the shared Vanilla source adapter. */
define(['CommerceKings_ConsentVanilla/js/adapter-core'], function (createAdapter) {
    'use strict';

    return createAdapter(function (callback) {
        require(['vanilla-cookieconsent'], callback);
    });
});
