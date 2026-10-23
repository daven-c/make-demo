#!/usr/bin/env bash
# Encode a raw demo recording into a web MP4 and a README GIF.
#
#   encode.sh <input.webm> <out-dir>          -> <out-dir>/demo.mp4, <out-dir>/demo.gif
#   WIDTH=720 FPS=8 encode.sh in.webm docs/   smaller GIF
#   TRIM=3 encode.sh in.webm site/            also demo-trimmed.mp4: no audio, skips 3 more seconds
#                                             (for autoplaying portfolio-card previews)
#   START=0 encode.sh in.webm docs/           keep the page-load flash
#
# START (seconds cut from the beginning of every output) defaults to `readyAt` from the
# recording.json the recorder writes next to the video, which skips the blank page load.
# GIF: palette generated from the video itself, 128 colours, Bayer dither. Over 10 MB it warns:
# GitHub and most viewers handle large GIFs badly. Shorten the demo or lower WIDTH/FPS.
set -euo pipefail

in="${1:?usage: encode.sh <input video> <out dir>}"
out="${2:?usage: encode.sh <input video> <out dir>}"
WIDTH="${WIDTH:-800}"
FPS="${FPS:-10}"
CRF="${CRF:-26}"
meta="$(dirname "$in")/recording.json"
if [[ -z "${START:-}" && -f "$meta" ]]; then
  START="$(grep -o '"readyAt": *[0-9.]*' "$meta" | grep -o '[0-9.]*$' || true)"
fi
START="${START:-0}"
mkdir -p "$out"

ffmpeg -nostdin -loglevel error -y -ss "$START" -i "$in" \
  -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -movflags +faststart \
  "$out/demo.mp4"

ffmpeg -nostdin -loglevel error -y -ss "$START" -i "$in" \
  -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$out/demo.gif"

if [[ -n "${TRIM:-}" ]]; then
  ffmpeg -nostdin -loglevel error -y -ss "$(awk -v a="$START" -v b="$TRIM" 'BEGIN { print a + b }')" -i "$in" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -an -movflags +faststart \
    "$out/demo-trimmed.mp4"
fi

size_mb() { awk -v b="$(wc -c < "$1")" 'BEGIN { printf "%.1f", b / 1e6 }'; }
dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/demo.mp4")"
echo "trimmed ${START}s from the start"
printf 'demo.mp4          %6s MB  (%.1f s)\n' "$(size_mb "$out/demo.mp4")" "$dur"
printf 'demo.gif          %6s MB  (%s px, %s fps)\n' "$(size_mb "$out/demo.gif")" "$WIDTH" "$FPS"
if [[ -n "${TRIM:-}" ]]; then
  printf 'demo-trimmed.mp4  %6s MB\n' "$(size_mb "$out/demo-trimmed.mp4")"
fi

gif_bytes="$(wc -c < "$out/demo.gif")"
if (( gif_bytes > 10000000 )); then
  echo "warning: demo.gif is over 10 MB; try WIDTH=720 FPS=8, or shorten the demo" >&2
fi
