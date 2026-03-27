# Security Policy

## Table of contents

- [Supported Versions](#supported-versions)
- [Reporting a Vulnerability](#reporting-a-vulnerability)
  - [How to Report](#how-to-report)
  - [Response Timeline](#response-timeline)
  - [Disclosure Policy](#disclosure-policy)
- [Security considerations for integrators](#security-considerations-for-integrators)
- [Security review (bundle code)](#security-review-bundle-code)
  - [1. API endpoint `/api/icon-selector/icons/svg` (IconSvgController)](#1-api-endpoint-apiicon-selectoriconssvg-iconsvgcontroller)
  - [2. Twig function `nowo_icon_selector_asset_path(filename)`](#2-twig-function-nowo_icon_selector_asset_pathfilename)
  - [3. Form choice loader (IconChoiceLoader)](#3-form-choice-loader-iconchoiceloader)
  - [4. IconifyCollectionLoader](#4-iconifycollectionloader)
  - [5. Response and Content-Type](#5-response-and-content-type)
  - [Summary](#summary)
- [Preferred Languages](#preferred-languages)
- [Contact](#contact)
- [Release security checklist (12.4.1)](#release-security-checklist-1241)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Icon Selector Bundle seriously. If you believe you have found a security vulnerability, please report it as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please send an email to: **hectorfranco@nowo.tech**

Include the following information in your report:

- Type of issue (e.g. XSS, injection, path traversal)
- Full paths of source file(s) related to the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Varies depending on complexity

### Disclosure Policy

- We will confirm receipt of your vulnerability report
- We will work with you to understand and validate the issue
- We will develop and release a fix as quickly as possible
- We will publicly acknowledge your responsible disclosure (if desired)

## Security considerations for integrators

This bundle provides a form type and an API endpoint that returns the list of configured icon identifiers (no user data). It does not handle authentication or authorization. If you consider the icon list sensitive, ensure the icons API route is only accessible in appropriate environments (e.g. restrict by firewall or role). The API returns static configuration-derived data; ensure your application does not expose it to untrusted users if that would be a concern.

---

## Security review (bundle code)

The following describes the security measures implemented in the bundle and remaining recommendations for integrators.

### 1. API endpoint `/api/icon-selector/icons/svg` (IconSvgController)

- **Input:** Icon IDs come from the request (GET query `ids` or POST JSON `ids`). They are trimmed and filtered.
- **Implemented:**
  - **Whitelist:** Only icon IDs that appear in the configured icon sets (`IconListProvider::getIcons()`) are passed to the renderer. Requests for unknown or disallowed IDs are ignored (omitted from the response).
  - **SVG sanitization:** Before returning, every SVG string is passed through `SvgSanitizer`, which removes `<script>...</script>` tags and event-handler attributes (e.g. `onload`, `onerror`, `onclick`). This reduces XSS risk when the frontend injects the SVG into the DOM via `innerHTML`.
  - **DoS mitigation:** Requests are limited to `MAX_IDS = 500` icon IDs per call.
- **Output:** JSON mapping icon ID → sanitized SVG markup. Unknown or invalid IDs do not appear in the response.
- **Recommendations for integrators:**
  - Restrict the route (firewall or role) if the icon set is considered internal.
  - Consider rate limiting or throttling this endpoint if it is publicly accessible.

### 2. Twig function `nowo_icon_selector_asset_path(filename)`

- **Behaviour:** Builds the asset path `bundles/nowoiconselector/` + filename. Used in templates with fixed names (e.g. `nowo_icon_selector_asset_path('icon-selector.js')`).
- **Implemented:**
  - **Path traversal protection:** The filename must not contain `..`. If it does, or if it is empty or contains invalid characters, the function returns a safe default path (`bundles/nowoiconselector/icon-selector.js`) so that no user-controlled path is used.
  - **Safe character set:** Only filenames matching `[a-zA-Z0-9._/-]+` are accepted; any other input falls back to the default path.
- **Recommendation:** Use this function only with literal or controlled values (e.g. `'icon-selector.js'`, `'css/theme.css'`). Do not pass unfiltered user or request input.

### 3. Form choice loader (IconChoiceLoader)

- **Behaviour:** Accepts submitted icon IDs that match `prefix:name` and, when a renderer is available, verifies existence via `renderIcon($id)`. No file system or path is built from user input.
- **Risk:** Same as (1): the renderer must safely handle any string; invalid IDs throw and are treated as invalid choice. No additional server-side risk identified.

### 4. IconifyCollectionLoader

- **Behaviour:** Calls `https://api.iconify.design/collection` with a `prefix` from configuration (or set name). Prefix is sanitized for cache key; it is sent only as a query parameter to Iconify.
- **Risk:** No SSRF from this bundle (URL is fixed; prefix is not used as host). Ensure `icon_sets` and related config are not user-controllable.

### 5. Response and Content-Type

- The SVG endpoint returns `JsonResponse` (application/json). Browsers will not interpret the response as HTML, so the main XSS vector is the frontend’s use of the JSON payload (innerHTML with SVG), which is mitigated by server-side SVG sanitization.

### Summary

| Area              | Status | Notes |
|-------------------|--------|--------|
| Auth / authz      | Not in bundle | Restrict API routes (firewall/role) if needed. |
| Icon ID input     | Implemented | Whitelist against configured icons (IconListProvider). |
| SVG output → DOM  | Implemented | SvgSanitizer strips script tags and event attributes. |
| assetPath         | Implemented | Path traversal and invalid chars rejected; safe default used. |
| Iconify API       | No SSRF | Keep config (e.g. icon_sets) non-user-controlled. |
| DoS               | MAX_IDS=500 | Consider rate limiting on public endpoints. |

## Preferred Languages

We prefer all communications to be in English or Spanish.

## Contact

- **Maintainer**: [Héctor Franco Aceituno](https://github.com/HecFranco)
- **Organization**: [nowo-tech](https://github.com/nowo-tech)

## Release security checklist (12.4.1)

Before tagging a release, confirm:

| Item | Notes |
|------|--------|
| **SECURITY.md** | This document is current and linked from the README where applicable. |
| **`.gitignore` and `.env`** | `.env` and local env files are ignored; no committed secrets. |
| **No secrets in repo** | No API keys, passwords, or tokens in tracked files. |
| **Recipe / Flex** | Default recipe or installer templates do not ship production secrets. |
| **Input / output** | Inputs validated; outputs escaped in Twig/templates where user-controlled. |
| **Dependencies** | `composer audit` run; issues triaged. |
| **Logging** | Logs do not print secrets, tokens, or session identifiers unnecessarily. |
| **Cryptography** | If used: keys from secure config; never hardcoded. |
| **Permissions / exposure** | Routes and admin features documented; roles configured for production. |
| **Limits / DoS** | Timeouts, size limits, rate limits where applicable. |

Record confirmation in the release PR or tag notes.

