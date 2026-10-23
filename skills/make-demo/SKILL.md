---
name: make-demo
description: Make a product demo of an app the user is building, in up to three formats - an MP4 video, an inline README/portfolio GIF, and an interactive click-through HTML walkthrough - by scripting the real app with Playwright. Use when the user asks for a demo, walkthrough, screen recording, README GIF, product tour, or a demo for a portfolio site, resume, or launch.
---

# Making demos

A good demo is recorded from the **real app**, driven by a **script** (so it can be re-recorded when the UI changes), and **checked frame by frame** before it ships. One Playwright pass produces everything:

| Format | File | Where it works | Notes |
|---|---|---|---|
| **MP4** | `demo.mp4` | Portfolio sites, LinkedIn, Slack, GitHub *attachments* | Best quality per MB (a 48 s 720p demo ≈ 2 MB). GitHub READMEs do **not** play an MP4 from a repo path, only from an uploaded `user-attachments` URL. |
| **GIF** | `demo.gif` | Inline in READMEs, issues and PRs from a repo path | Large (≈10 MB for 45 s at 800 px/10 fps). Keep it under 10 MB and link the MP4 under it. |
| **Interactive** | `tour.html` | Anywhere a link works: portfolio, Artifact, GitHub Pages | A single self-contained page. The viewer clicks highlighted hotspots to step through real screenshots with captions. It's skimmable, accessible, and light. |

The bundled scripts live next to this file in `scripts/`. In the commands below, `$SKILL_DIR` means this skill's base directory (the folder holding this `SKILL.md`); substitute the real path.

## Workflow

### 1. Decide the formats and the content
- Ask which formats the user wants if it's unclear. The default is all three: MP4 + GIF for the README, the tour for the portfolio.
- **Content must be safe to publish.** A demo is public redistribution. Never show research-only datasets (e.g. MSR-VTT or other YouTube-sourced data), private user data, real customer records, or secrets. Use openly licensed media (e.g. Blender Foundation open movies, CC BY) or synthetic data, and credit it in the demo's docs as the license requires.
- **Ask before downloading** media or tools: state each file, its source, and its size.
- Load the demo content into an **isolated data dir or instance** (for example a `DATA_DIR=.../demo` environment variable), never the user's real library. Gitignore it.

### 2. Plan the story (30–60 s)
3–5 beats, each showing one capability, ending on proof (benchmarks, results, scale). Pick inputs that **produce impressive, correct results**: run candidate queries or actions first and look at the outputs (render a contact sheet of the results) before scripting them. Drop anything that's only "kind of right".

### 3. Script the recording
Copy `scripts/record_demo.template.mjs` into the project (e.g. `frontend/scripts/record-demo.mjs`), add `playwright` as an exact-pinned dev dependency, and fill in `STEPS`. The template already handles:
- **A visible cursor and caption bar.** Playwright recordings don't show the pointer; the template injects a fake cursor plus captions.
- **Real mouse clicks at the element's centre.** `locator.click()` refuses when an overlay (a play icon, a tooltip) covers the target, while a real mouse click hits the overlay and bubbles like a user's would.
- **Smooth `glide()` movement** and typing at a human pace (`pressSequentially` with a delay).
- **Capturing tour steps**: a screenshot plus the hotspot box at every `click()` and `snap()` → `demo-out/tour/steps.json`.
- **Writing a stable output name**, and removing the partial `page@*.webm` if a run fails.

Things the template can't decide for you:
- **H.264/AAC media needs `channel: "chrome"`** (the installed Google Chrome). Playwright's bundled Chromium has no proprietary codecs, so videos would sit frozen.
- **Warm the caches first** (thumbnails, first queries, model load) with a `warmUp()` that hits the API; otherwise the first seconds show spinners or empty cards.
- **Wait on UI state, not just sleeps**: wait for the results text or for images to be `complete`, then add a short sleep so viewers can read.
- **Captions make claims, so keep them true.** Only state numbers that are measured and on screen or in the repo.

### 4. Record and verify (don't skip this)
```bash
DEMO_URL=http://localhost:5173 node scripts/record-demo.mjs        # → demo-out/demo.webm + demo-out/tour/
bash "$SKILL_DIR"/scripts/contact_sheet.sh demo-out/demo.webm   # → demo-out/sheet.png
```
Read the contact sheet image and check every beat. These failures actually happened and were invisible until frames were inspected:
- **Media that doesn't play**: the same timestamp across consecutive frames. This was an app bug, an effect calling `play()` before a portal-mounted `<video>` existed.
- **Empty or black cards** from cold caches, or thumbnails taken at t=1 s (title cards are black).
- **A "jump to match" landing on the wrong shot** because of range padding.
- **A dialog caught mid fade-in** on the frame you care about.

Fix real app bugs in the app, not by working around them in the script. Then re-record and re-check.

### 5. Encode
```bash
bash "$SKILL_DIR"/scripts/encode.sh demo-out/demo.webm docs/    # → docs/demo.mp4, docs/demo.gif
```
- MP4: H.264 `crf 26`, `yuv420p`, `+faststart`. The script prints sizes and warns if the GIF is over 10 MB; if it is, shorten the demo or pass a smaller width/fps (`WIDTH=720 FPS=8`).
- The first ~1 s of every Playwright recording is a blank/white page load. The recorder writes `recording.json` with the moment the app was ready, and `encode.sh` trims to it automatically (`START=0` keeps it).
- Don't commit the raw `.webm`; gitignore it.
- For a **portfolio card or autoplay preview**, trim the idle intro (`-ss 3`) and drop audio (`-an`) so it starts on action.

### 6. Build the interactive tour
```bash
node "$SKILL_DIR"/scripts/build_tour.mjs demo-out/tour docs/tour.html --title "MyApp tour"
```
This produces one HTML file with the screenshots inlined as JPEG data URIs (typically 0.5–2 MB). It has a pulsing hotspot on each click target, captions, arrow-key/space navigation, progress dots, and light/dark theme support. Open it and click through it before publishing. To share it as a hosted page, publish it with the Artifact tool or put it on GitHub Pages.

### 7. Publish
- **README:** put the GIF right under the title, then a `<sub>` line with links to the MP4 and the how-it's-made doc, plus media credits.
- **`docs/DEMO.md`:** credits and licenses for the media, plus the exact commands to reproduce the recording: download, transcode, index, run, record, encode.
- **Portfolio site:** use the trimmed MP4 and a poster frame that tells the story (an input with its results, not an empty screen). Deploying a personal site is outward-facing: commit, preview locally, and **confirm before pushing**.

## Shell pitfalls (zsh is the default on macOS)
- **Quote `?` in ffmpeg maps** (`-map '0:a:0?'`), or zsh treats it as a glob and fails with "no matches found".
- **No implicit word splitting**: `set -- $var` and unquoted `$cfg` don't split in zsh. Pass arguments explicitly, or run the bundled bash scripts.
- **Kill background dev servers by port** (`kill $(lsof -tiTCP:PORT -sTCP:LISTEN)`). `pkill -f "vite --port N"` can miss the node child, leaving the port taken.
- A Vite proxy target set from an env var must be read in `vite.config` (`process.env.X`); `VITE_*` variables only reach client code.
- **Transcode media to web-safe MP4** (`-c:v h264_videotoolbox` on macOS or `libx264`, `-pix_fmt yuv420p -movflags +faststart`). Browsers can't reliably play `.mkv`, and seeking needs `faststart`.
