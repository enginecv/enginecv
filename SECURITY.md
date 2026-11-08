# Security policy

## Reporting a vulnerability

**Do not file a public issue for security vulnerabilities.** Public issues, even ones quickly deleted, are indexed by GitHub's audit log, search, and third-party scrapers — once posted, the disclosure is effectively permanent.

Use **GitHub private vulnerability reporting** instead:

➡️ <https://github.com/enginecv/enginecv/security/advisories/new>

This opens a private channel between you and the maintainers. The advisory stays private until a fix is shipped and we mutually agree on a public disclosure date.

Please include:

- A short description of the vulnerability.
- Steps to reproduce, or a proof of concept.
- The affected app version (visible in the footer of EngineCV).
- Any constraints on disclosure on your side (deadlines, public talk plans, CVE assignment requests, etc.).

## Scope

In scope:

- The EngineCV web app at <https://enginecv.app> and any subdomain it serves.
- Cryptography around encrypted JSON exports / imports (key handling, ciphertext format, parameter choices).
- Anything that could exfiltrate resume data from a user's browser to a third party without an explicit, on-screen action.

Out of scope:

- Reports based purely on missing security headers without a demonstrable exploit.
- Self-XSS that requires the user to paste hostile input into DevTools.
- Denial-of-service that requires more bandwidth than a typical home connection.
- Vulnerabilities in third-party services we link to but do not control (GitHub, hosting provider, DNS provider).

## Response

I acknowledge new advisories within a few days when I can. There is no SLA.

If the report is accepted, the typical flow is:

1. Confirm and reproduce.
2. Develop and ship a fix in the app.
3. Coordinate a disclosure date with you.
4. Publish the advisory and credit you (or note your preference for anonymity).

## Thanks

EngineCV is a small project run by one person. Responsible disclosure is genuinely appreciated.
