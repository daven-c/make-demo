---
name: make-demo
description: Make a product demo of an app the user is building, in up to four formats - an MP4 video, an inline README/portfolio GIF, an interactive click-through HTML walkthrough, and clean screenshots of every page and main feature - by scripting the real app with Playwright. Use when the user asks for a demo, walkthrough, screen recording, README GIF, product tour, app screenshots, or a demo for a portfolio site, resume, or launch.
argument-hint: "[style directive, e.g. quick cuts, clean transitions, no zoom]"
---

# Making demos

A good demo is recorded from the **real app**, driven by a **script** (so it can be re-recorded when the UI changes), and **checked frame by frame** before it ships. One Playwright pass produces everything:

| Format | File | Where it works | Notes |
|---|---|---|---|
| **MP4** | `demo.mp4` | Portfolio sites, LinkedIn, Slack, GitHub *attachments* | Best quality per MB (a 48 s 720p demo ≈ 2 MB). GitHub READMEs do **not** play an MP4 from a repo path, only from an uploaded `user-attachments` URL. |
| **GIF** | `demo.gif` | Inline in READMEs, issues and PRs from a repo path | Large (≈10 MB for 45 s at 800 px/10 fps). Keep it under 10 MB and link the MP4 under it. |
| **Interactive** | `tour.html` | Anywhere a link works: portfolio, Artifact, GitHub Pages | A single self-contained page. The viewer clicks highlighted hotspots to step through real screenshots with captions. It's skimmable, accessible, and light. |
| **Screenshots** | `screenshots/*.png` | Docs, app store and launch listings, portfolio galleries, PR descriptions | Full-resolution (2x) stills of every page and main feature, in light and dark, with no cursor, caption or zoom. |

The bundled scripts live next to this file in `scripts/`. In the commands below, `$SKILL_DIR` means this skill's base directory (the folder holding this `SKILL.md`); substitute the real path.

## Style directive
Directive from the user (may be empty): `$ARGUMENTS`

The user may pass a free-form style directive with the command (`/make-demo quick changing, clean transitions with no zoom`) or say one in the request. It overrides the defaults in this file wherever they conflict. Translate it into the template's CONFIG and into how you write `STEPS`, and repeat back how you read it in one line before recording. Common phrases:

| Directive | CONFIG | In `STEPS` |
|---|---|---|
| quick, snappy, fast-paced | `pace: 0.6` | 3–4 beats, 20–30 s total, short captions |
| relaxed, slow, calm | `pace: 1.3` | |
| no zoom, static camera | `zoom: false` | don't call `zoom()`; `zoomOut()` is a no-op anyway |
| clean, minimal, subtle | `ripples: false` | one caption per beat, at most one zoom per beat |
| no title cards, straight in | `intro: null`, `outro: null` | |
| no captions | | leave `caption` off every step |
| short, loop, GIF-friendly | `pace: 0.7`, `intro: null` | under 20 s, ending on a frame that loops back to the start |

`pace` scales cursor glides, zooms, typing, title-card holds and every `wait()`, so write `wait()` values for the default pace and let `pace` do the rest. For anything the table doesn't cover, pick the closest CONFIG change or step pattern. If a directive conflicts with a hard rule (truthful captions, safe content), the rule wins; tell the user.

## Workflow

### 1. Decide the formats and the content
- Ask which formats the user wants if it's unclear. The default is MP4 + GIF for the README, the tour for the portfolio, and screenshots of every page. If they only want screenshots, skip the story and run `DEMO_ONLY=screenshots`.
- **Content must be safe to publish.** A demo is public redistribution. Never show research-only datasets (e.g. MSR-VTT or other YouTube-sourced data), private user data, real customer records, or secrets. Use openly licensed media (e.g. Blender Foundation open movies, CC BY) or synthetic data, and credit it in the demo's docs as the license requires.
- **Ask before downloading** media or tools: state each file, its source, and its size.
- Load the demo content into an **isolated data dir or instance** (for example a `DATA_DIR=.../demo` environment variable), never the user's real library. Gitignore it.

### 2. Plan the story (30–60 s)
3–5 beats, each showing one capability, ending on proof (benchmarks, results, scale). Pick inputs that **produce impressive, correct results**: run candidate queries or actions first and look at the outputs (render a contact sheet of the results) before scripting them. Drop anything that's only "kind of right".

The screenshot list is wider than the story: it should cover **every page** and **each main feature in its most telling state**. Find the pages from the router (route files, `<Route>`s, `pages/`/`app/` dirs, nav links) and the features from the nav, README and main components. Show features with real content (a dialog open, a form filled, results loaded), not empty states, unless the empty state is the point.

### 3. Script the recording
Copy `scripts/record_demo.template.mjs` into the project (e.g. `frontend/scripts/record-demo.mjs`), add `playwright` as an exact-pinned dev dependency, and fill in `STEPS`. The template already handles:
- **Launch-video motion.** Everything animates inside the page at the display's frame rate: an arrow cursor that glides along a gentle eased arc, a ripple on each click, captions that slide and cross-fade, and intro/outro title cards (`CONFIG.intro` / `CONFIG.outro`).
- **A camera.** `zoom(locator, level?)` eases the view in towards an element, and the target drifts towards the centre; `zoomOut()` pulls back. Zoom in for typing and small controls, and zoom out to reveal results. It scales `CONFIG.camera` (default `body`) with a CSS transform; if the app has `position: fixed` headers that misbehave while zoomed, point it at the app root (e.g. `#root`).
- **Sharp 60 fps capture.** Frames come from the DevTools screencast at 2x device scale and are assembled into a constant-rate `raw.mp4`. Playwright's own `recordVideo` is 25 fps and blurry, so it isn't used. Recording starts after the page loads, so there's no blank flash to trim.
- **Real mouse clicks at the element's centre.** `locator.click()` refuses when an overlay (a play icon, a tooltip) covers the target, while a real mouse click hits the overlay and bubbles like a user's would.
- **Typing at a human pace**, with uneven per-key delays.
- **Capturing tour steps**: a screenshot plus the hotspot box at every `click()` and `snap()` → `demo-out/tour/steps.json`.
- **Clean output**: tour screenshots hide the overlays, and those frames are dropped from the video.
- **Screenshots** in a separate pass: each `SHOTS` entry (`{ name, path?, run?, fullPage? }`) loads in a fresh tab with no overlays, `run` reaches the state to show, and a 2x PNG is saved per color scheme in `CONFIG.shotSchemes` → `demo-out/screenshots/NN-name-scheme.png`. Animations are frozen and the caret is hidden. Set `DEMO_ONLY=screenshots` (or `video`) to re-run one pass.

Things the template can't decide for you:
- **H.264/AAC media needs `channel: "chrome"`** (the installed Google Chrome). Playwright's bundled Chromium has no proprietary codecs, so videos would sit frozen.
- **Warm the caches first** (thumbnails, first queries, model load) with a `warmUp()` that hits the API; otherwise the first seconds show spinners or empty cards.
- **Pace it like a launch video** (unless the style directive says otherwise). Zoom in on the action, keep each beat to one idea, let results sit for 1–2 s, and end on the outro card. Too many zooms make viewers seasick; use about one per beat.
- **Wait on UI state, not just sleeps**: wait for the results text or for images to be `complete`, then add a short sleep so viewers can read.
- **Captions make claims, so keep them true.** Only state numbers that are measured and on screen or in the repo.

### 4. Record and verify (don't skip this)
```bash
DEMO_URL=http://localhost:5173 node scripts/record-demo.mjs        # → demo-out/raw.mp4 + demo-out/tour/
bash "$SKILL_DIR"/scripts/contact_sheet.sh demo-out/raw.mp4   # → demo-out/sheet.png
```
Read the contact sheet image and check every beat. Also open each screenshot in `demo-out/screenshots/` and check it shows the intended state (loaded data, not a spinner; the dialog fully open; nothing private) in both color schemes. These failures actually happened and were invisible until frames were inspected:
- **Motion**: sample one glide or zoom at 10–15 fps (`ffmpeg -ss T -t 1.5 -i raw.mp4 -vf fps=10,scale=640:-1,tile=4x4 -frames:v 1 m.png`) to check that it eases rather than jumping.
- **Media that doesn't play**: the same timestamp across consecutive frames. This was an app bug, an effect calling `play()` before a portal-mounted `<video>` existed.
- **Empty or black cards** from cold caches, or thumbnails taken at t=1 s (title cards are black).
- **A "jump to match" landing on the wrong shot** because of range padding.
- **A dialog caught mid fade-in** on the frame you care about.

Fix real app bugs in the app, not by working around them in the script. Then re-record and re-check.

### 5. Encode
```bash
bash "$SKILL_DIR"/scripts/encode.sh demo-out/raw.mp4 docs/    # → docs/demo.mp4, docs/demo.gif
```
- MP4: H.264 at 60 fps, 1920 px wide (`MP4_WIDTH`), `crf 24`, `yuv420p`, `+faststart`. GIF: 800 px at 15 fps. The script prints sizes and warns if the GIF is over 10 MB; if it is, shorten the demo or pass a smaller width/fps (`WIDTH=720 FPS=10`).
- Don't commit `demo-out/` (the 2x master is large); gitignore it. Copy the screenshots you want to keep into `docs/screenshots/`; if PNGs are too large for the repo, convert with `sips -s format jpeg` (macOS) or `ffmpeg -i in.png -q:v 3 out.jpg`.
- For a **portfolio card or autoplay preview**, `TRIM=3` also writes `demo-trimmed.mp4` without audio that starts past the title card.

### 6. Build the interactive tour
```bash
node "$SKILL_DIR"/scripts/build_tour.mjs demo-out/tour docs/tour.html --title "MyApp tour"
```
This produces one HTML file with the screenshots inlined as JPEG data URIs (typically 0.5–2 MB). It has a pulsing hotspot on each click target, captions, arrow-key/space navigation, progress dots, and light/dark theme support. Open it and click through it before publishing. To share it as a hosted page, publish it with the Artifact tool or put it on GitHub Pages.

### 7. Publish
- **README:** put the GIF right under the title, then a `<sub>` line with links to the MP4 and the how-it's-made doc, plus media credits. A screenshot gallery (a table of thumbnails linking to `docs/screenshots/`) works well further down.
- **`docs/DEMO.md`:** credits and licenses for the media, plus the exact commands to reproduce the recording: download, transcode, index, run, record, encode.
- **Portfolio site:** use the trimmed MP4 and a poster frame that tells the story (an input with its results, not an empty screen). Deploying a personal site is outward-facing: commit, preview locally, and **confirm before pushing**.

## Reporting problems with this skill
If something in **the skill itself** is wrong, report it so it can be fixed for everyone. Examples: a bundled script crashes or produces bad output, an instruction here is wrong or out of date, or a pitfall is missing from this file. Bugs in the user's own app, or in their environment (no ffmpeg, a port already in use), are not skill bugs.

1. **Write a minimal reproduction** in a temporary file: what you ran (script and arguments), what you expected, what happened (the exact error or a description of the bad frames), and the smallest fix you can see. Leave out secrets, private data, the user's app code, file paths that reveal names, and anything from their screen.
2. **Preview it**: `bash "$SKILL_DIR"/scripts/report_issue.sh --title "<script>: <symptom>" --body-file <file>`. This adds the environment (versions of the skill, OS, Node, Playwright, ffmpeg and Chrome) and lists similar existing issues. If one already covers it, tell the user and link it instead of filing a duplicate.
3. **Ask the user before filing.** Issues on GitHub are public and filed under their account. Show them the title and body, and say that it will be public.
4. **Only after they agree**, re-run with `--submit`. Without `gh`, the script prints a prefilled link for the user to open instead.

Don't let a report block the user's task. Work around the problem first and report it at a natural pause.

## Shell pitfalls (zsh is the default on macOS)
- **Quote `?` in ffmpeg maps** (`-map '0:a:0?'`), or zsh treats it as a glob and fails with "no matches found".
- **No implicit word splitting**: `set -- $var` and unquoted `$cfg` don't split in zsh. Pass arguments explicitly, or run the bundled bash scripts.
- **Kill background dev servers by port** (`kill $(lsof -tiTCP:PORT -sTCP:LISTEN)`). `pkill -f "vite --port N"` can miss the node child, leaving the port taken.
- A Vite proxy target set from an env var must be read in `vite.config` (`process.env.X`); `VITE_*` variables only reach client code.
- **Transcode media to web-safe MP4** (`-c:v h264_videotoolbox` on macOS or `libx264`, `-pix_fmt yuv420p -movflags +faststart`). Browsers can't reliably play `.mkv`, and seeking needs `faststart`.
