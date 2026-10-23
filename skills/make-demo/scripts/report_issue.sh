#!/usr/bin/env bash
# Report a problem with the make-demo skill itself to its GitHub repo.
#
#   report_issue.sh --title "encode.sh: GIF palette fails on 4K input" --body-file /tmp/issue.md
#        prints the full issue (your body + environment) and any similar existing issues; files nothing
#   report_issue.sh --title "..." --body-file /tmp/issue.md --submit
#        files it with `gh issue create` (label: agent-reported), or prints a prefilled URL if gh
#        isn't installed or signed in
#
# Issues are public. Run without --submit first, show the user the preview, and only submit once
# they've agreed. The body must not contain secrets, private data or the user's app code.
set -euo pipefail

REPO="${MAKE_DEMO_REPO:-daven-c/make-demo}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
title="" body_file="" submit=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --title) title="$2"; shift 2 ;;
    --body-file) body_file="$2"; shift 2 ;;
    --submit) submit=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$title" && -f "$body_file" ]] || {
  echo 'usage: report_issue.sh --title "..." --body-file FILE [--submit]' >&2
  exit 2
}

ver() { "$@" 2>/dev/null | head -1 || true; }
skill_version="$(grep -o '"version": *"[^"]*"' "$here/../../../.claude-plugin/plugin.json" 2>/dev/null | head -1 | grep -o '[0-9][^"]*' || true)"
skill_commit="$(git -C "$here" rev-parse --short HEAD 2>/dev/null || true)"
chrome="$(ver "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version)"
[[ -n "$chrome" ]] || chrome="$(ver google-chrome --version)"
playwright="$(node -p 'require("playwright/package.json").version' 2>/dev/null || true)"

body="$(cat "$body_file")

<details><summary>Environment</summary>

| | |
|---|---|
| make-demo | ${skill_version:-unknown}${skill_commit:+ ($skill_commit)} |
| OS | $(uname -sr) $(uname -m) |
| Node | $(ver node --version) |
| Playwright | ${playwright:-not found from this directory} |
| ffmpeg | $(ver ffmpeg -version | awk '{print $3}') |
| Chrome | ${chrome:-not found} |

</details>

<sub>Filed by an agent running the make-demo skill, with the user's approval.</sub>"

if [[ -z "$submit" ]]; then
  printf '%s\n\n--- %s\n\n%s\n' "== preview (not filed) ==" "$title" "$body"
  if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
    echo
    echo "== possibly related issues (open and closed) =="
    gh issue list --repo "$REPO" --state all --limit 5 --search "$title" \
      --json number,state,title,url --template '{{range .}}#{{.number}} [{{.state}}] {{.title}}  {{.url}}{{"\n"}}{{end}}' || true
  fi
  echo
  echo "Re-run with --submit to file this on $REPO."
  exit 0
fi

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  # the label may not exist on a fork; fall back to filing without it
  gh issue create --repo "$REPO" --title "$title" --body "$body" --label agent-reported 2>/dev/null \
    || gh issue create --repo "$REPO" --title "$title" --body "$body"
else
  enc() { node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"; }
  echo "gh isn't available or signed in. Open this link to file the issue (body is prefilled):"
  echo "https://github.com/$REPO/issues/new?labels=agent-reported&title=$(enc "$title")&body=$(enc "$body")"
fi
