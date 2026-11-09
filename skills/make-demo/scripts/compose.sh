#!/usr/bin/env bash
# Restyle a clean recording with Remotion.
#   compose.sh <demo-out-dir> <out.mp4> [preset=device] [fps=60] [theme=auto]   (themes: auto, paper, studio, dusk)
# <demo-out-dir> must hold raw.mp4 + timeline.json from a DEMO_CLEAN=1 recording.
# Installs the Remotion project's dependencies on first use (npm). Set REMOTION_CHROME to render with an
# installed Chrome instead of letting Remotion download its own headless shell.
set -euo pipefail
in="${1:?usage: compose.sh <demo-out-dir> <out.mp4> [preset] [fps]}"; out="${2:?missing out.mp4}"
preset="${3:-device}"; fps="${4:-60}"; theme="${5:-auto}"
here="$(cd "$(dirname "$0")/../remotion" && pwd)"
in="$(cd "$in" && pwd)"; out="$(cd "$(dirname "$out")" && pwd)/$(basename "$out")"
[ -f "$in/raw.mp4" ] && [ -f "$in/timeline.json" ] || { echo "need raw.mp4 and timeline.json in $in (record with DEMO_CLEAN=1)" >&2; exit 1; }
cd "$here"
[ -d node_modules ] || npm install --no-audit --no-fund
mkdir -p public && cp "$in/raw.mp4" public/raw.mp4
node -e '
const fs = require("fs");
const [tl, preset, fps, theme] = process.argv.slice(1);
fs.writeFileSync("public/props.json", JSON.stringify({ timeline: JSON.parse(fs.readFileSync(tl, "utf8")), videoFile: "raw.mp4", preset, fps: Number(fps), theme }));
' "$in/timeline.json" "$preset" "$fps" "$theme"
chrome=()
[ -n "${REMOTION_CHROME:-}" ] && chrome=(--browser-executable "$REMOTION_CHROME")
npx remotion render src/index.ts Demo "$out" --props=public/props.json "${chrome[@]}"
echo "composed $out"
