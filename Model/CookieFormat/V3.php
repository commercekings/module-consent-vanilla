<?php
declare(strict_types=1);

namespace CommerceKings\ConsentVanilla\Model\CookieFormat;

use CommerceKings\Consent\Model\CookieFormat\AbstractCookieFormat;

/**
 * vanilla-cookieconsent v3 cookie: {"categories": [...], "revision": n, "consentId": "...",
 * "consentTimestamp": "...", "lastConsentTimestamp": "...", "expirationTime": ms, "services": {...}, ...}.
 * consentId stays while the visitor changes their choices; lastConsentTimestamp changes on every save.
 * These are the reader defaults - only the version is its own.
 */
class V3 extends AbstractCookieFormat
{
    /** The bundled library (view/frontend/web/js/lib) - a unit test keeps the two in sync. */
    protected const VERSION = '3.1.0';
}
