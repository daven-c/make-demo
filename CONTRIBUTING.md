# Contributing to make-demo

Thanks for helping! Bug reports, fixes, new pitfalls for `SKILL.md` and better defaults are all welcome.

## Reporting bugs

- Search [existing issues](https://github.com/daven-c/make-demo/issues?q=is%3Aissue) first.
- Use the **Bug report** form. Include the command you ran, what you expected, and what happened. A contact sheet or a few frames help a lot for video problems.
- Agents running the skill can draft reports with `skills/make-demo/scripts/report_issue.sh`. They are labelled `agent-reported` and filed only with the user's approval.
- Security problems: see [SECURITY.md](SECURITY.md). Don't open a public issue.

## Making changes

1. Fork the repo and create a branch from `main`.
2. Make your change. Keep the scripts dependency-free (Node built-ins, bash, ffmpeg, Playwright) and match the surrounding style. JS uses tabs, and bash must pass `shellcheck`.
3. If you change how a recording looks or moves, re-record the example and check it:
   ```bash
   cd examples/todo-app && npm install
   node serve.mjs & node record-demo.mjs
   bash ../../skills/make-demo/scripts/contact_sheet.sh demo-out/raw.mp4
   ```
   Then look at `demo-out/sheet.png`. If the change is visible, attach it, or a short clip, to the PR.
4. Changes to the template's helpers or CONFIG should be mirrored in `examples/todo-app/record-demo.mjs`, and documented in `SKILL.md`.
5. Open a pull request. CI lints everything and records the example end to end, and both jobs must pass. A maintainer review is required before merging.

## Changing `SKILL.md`

`SKILL.md` is read by AI agents, so every line costs context and is taken literally. Prefer concrete, tested advice ("this failed, here's why, do this"). Avoid general tips.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it.
