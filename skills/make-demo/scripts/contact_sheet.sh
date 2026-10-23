#!/usr/bin/env bash
# Tile frames from a recording into one image so every beat can be checked at a glance.
#
#   contact_sheet.sh <video> [every-N-seconds] [out.png]
#
# By default frames are spaced to give ~16 tiles, read left-to-right, top-to-bottom. Timestamps
# are drawn when ffmpeg has the drawtext filter (needs libfreetype); otherwise tile k is at
# k * N seconds. Look for: unchanged playback time across tiles (media not playing), empty or
# black cards (cold caches), dialogs caught mid-animation, wrong content at a "jump to" target.
# For a closer look at one stretch: ffmpeg -ss 10 -t 4 -i in.webm -vf fps=2,scale=480:-1,tile=4x2 ...
set -euo pipefail

in="${1:?usage: contact_sheet.sh <video> [every-N-seconds] [out.png]}"
dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")"
every="${2:-$(awk -v d="$dur" 'BEGIN { e = d / 16; if (e < 0.5) e = 0.5; printf "%.2f", e }')}"
out="${3:-$(dirname "$in")/sheet.png}"

n="$(awk -v d="$dur" -v e="$every" 'BEGIN { n = int(d / e) + 1; print (n < 1 ? 1 : n) }')"
cols=4
rows=$(( (n + cols - 1) / cols ))

label=""
if ffmpeg -hide_banner -filters 2>/dev/null | grep -q ' drawtext '; then
  label=",drawtext=text='%{pts\\:hms}':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6"
fi

ffmpeg -nostdin -loglevel error -y -i "$in" \
  -vf "fps=1/${every},scale=480:-1${label},tile=${cols}x${rows}" -frames:v 1 "$out"

echo "$out  (${n} frames, one every ${every}s$([[ -z $label ]] && echo ', no timestamps: ffmpeg lacks drawtext'))"
