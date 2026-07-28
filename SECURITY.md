# Security policy

## Supported versions

The latest published minor version receives security fixes. While the SDK is pre-1.0, that means
the newest `0.x` release.

## Reporting a vulnerability

Report privately through GitHub:
<https://github.com/affic-com-br/affic-node/security/advisories/new>

Please do not open a public issue, and do not include a real API key in the report.

Include what you can: affected version, a description of the impact, and steps to reproduce. You
can expect an acknowledgement within a few business days and an assessment of severity and fix
timeline after that. We will credit you in the advisory unless you prefer otherwise.

## If your integration token leaks

The token can write activities for your entire program. If one is exposed — committed, logged,
pasted into an issue, or shipped to a browser:

1. Revoke and reissue it in the company area, immediately.
2. Review recent activities in the affiliate area for entries you did not create.
3. Only then work out how it escaped.

## Scope

This policy covers the `@affic/sdk` package in this repository. Vulnerabilities in the Affic API
itself, or in your program's configuration, should go to Affic support rather than here.
