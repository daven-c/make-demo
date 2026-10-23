# Security policy

## Reporting a vulnerability

Please **don't open a public issue**. Report it privately through [GitHub's private vulnerability reporting](https://github.com/daven-c/make-demo/security/advisories/new) instead.

Include what's affected (a script, the skill's instructions, CI), how to reproduce it, and its impact. You'll get a reply within a week. Fixes are released as soon as practical, and reporters are credited unless they prefer not to be.

## Scope

The skill runs scripts on the user's machine and drives a browser against their app, so reports about these are especially welcome:

- a script executing or exfiltrating something unintended
- instructions in `SKILL.md` that could lead an agent to leak private data, such as an issue report or published demo containing secrets
- CI workflows that expose tokens to untrusted pull requests

Only the latest version on `main` is supported.
