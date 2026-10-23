#!/usr/bin/env bash
# Encode the recorder's master video into a web MP4 and a README GIF.
#
#   encode.sh <raw.mp4> <out-dir>             -> <out-dir>/demo.mp4, <out-dir>/demo.gif
#   WIDTH=720 FPS=10 encode.sh raw.mp4 docs/  smaller GIF
#   MP4_WIDTH=1280 encode.sh raw.mp4 docs/    smaller MP4 (default 1920 px, keeps the source fps)
#   TRIM=3 encode.sh raw.mp4 site/            also demo-trimmed.mp4: no audio, skips 3 more seconds
#                                             (e.g. past the title card, for autoplaying card previews)
#   START=2.5 encode.sh raw.mp4 docs/         cut seconds from the start of every output
#
# MP4: H.264 at the source frame rate (60 fps from the recorder), lanczos-downscaled from the 2x capture.
# GIF: palette generated from the video itself, 128 colours, Bayer dither. Over 10 MB it warns:
# GitHub and most viewers handle large GIFs badly. Shorten the demo or lower WIDTH/FPS.
set -euo pipefail

in="${1:?usage: encode.sh <input video> <out dir>}"
out="${2:?usage: encode.sh <input video> <out dir>}"
WIDTH="${WIDTH:-800}"
FPS="${FPS:-15}"
MP4_WIDTH="${MP4_WIDTH:-1920}"
CRF="${CRF:-24}"
START="${START:-0}"
mp4_scale="scale='min(${MP4_WIDTH},iw)':-2:flags=lanczos"
mkdir -p "$out"

ffmpeg -nostdin -loglevel error -y -ss "$START" -i "$in" \
  -vf "$mp4_scale" -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -movflags +faststart \
  "$out/demo.mp4"

ffmpeg -nostdin -loglevel error -y -ss "$START" -i "$in" \
  -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$out/demo.gif"

if [[ -n "${TRIM:-}" ]]; then
  ffmpeg -nostdin -loglevel error -y -ss "$(awk -v a="$START" -v b="$TRIM" 'BEGIN { print a + b }')" -i "$in" \
    -vf "$mp4_scale" -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -an -movflags +faststart \
    "$out/demo-trimmed.mp4"
fi

size_mb() { awk -v b="$(wc -c < "$1")" 'BEGIN { printf "%.1f", b / 1e6 }'; }
dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/demo.mp4")"
fps="$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$out/demo.mp4")"
printf 'demo.mp4          %6s MB  (%.1f s, %s fps)\n' "$(size_mb "$out/demo.mp4")" "$dur" "$fps"
printf 'demo.gif          %6s MB  (%s px, %s fps)\n' "$(size_mb "$out/demo.gif")" "$WIDTH" "$FPS"
if [[ -n "${TRIM:-}" ]]; then
  printf 'demo-trimmed.mp4  %6s MB\n' "$(size_mb "$out/demo-trimmed.mp4")"
fi

gif_bytes="$(wc -c < "$out/demo.gif")"
if (( gif_bytes > 10000000 )); then
  echo "warning: demo.gif is over 10 MB; try WIDTH=720 FPS=10, or shorten the demo" >&2
fi
