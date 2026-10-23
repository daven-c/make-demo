#!/usr/bin/env node
// Build a single-file interactive click-through tour from the recorder's tour output.
//
//   node build_tour.mjs <tour-dir> <out.html> [--title "MyApp tour"] [--link https://github.com/...]
//
// <tour-dir> holds steps.json + step-NN.jpg written by record_demo.template.mjs. Images are inlined
// as data URIs so the HTML works anywhere (Artifact, GitHub Pages, opened from disk). No deps.

import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
	const i = args.indexOf(name);
	if (i === -1) return undefined;
	const [, value] = args.splice(i, 2);
	return value;
};
const title = flag("--title") ?? "Product tour";
const link = flag("--link");
const [tourDir, outFile] = args;
if (!tourDir || !outFile) {
	console.error('usage: build_tour.mjs <tour-dir> <out.html> [--title "..."] [--link URL]');
	process.exit(2);
}

const { size, steps } = JSON.parse(await readFile(path.join(tourDir, "steps.json"), "utf8"));
if (!steps?.length) throw new Error("steps.json has no steps");

const inlined = await Promise.all(
	steps.map(async (s) => ({
		...s,
		src: `data:image/jpeg;base64,${(await readFile(path.join(tourDir, s.image))).toString("base64")}`,
	}))
);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// JSON inside <script>: escape "<" so captions can't close the tag
const data = JSON.stringify(inlined.map(({ src, caption, hotspot }) => ({ src, caption, hotspot }))).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
	:root { --bg: #f6f7f9; --fg: #111827; --muted: #6b7280; --card: #ffffff; --line: #e5e7eb; --accent: #0d9488; }
	@media (prefers-color-scheme: dark) {
		:root { --bg: #0b0f14; --fg: #e5e7eb; --muted: #9ca3af; --card: #111827; --line: #1f2937; --accent: #2dd4bf; }
	}
	* { box-sizing: border-box; }
	body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, sans-serif; }
	main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 40px; }
	header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
	h1 { font-size: 20px; margin: 0; }
	header a { color: var(--accent); text-decoration: none; font-size: 14px; }
	.stage { position: relative; width: 100%; aspect-ratio: ${size.width} / ${size.height}; border-radius: 12px; overflow: hidden;
		border: 1px solid var(--line); background: #000; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
	.stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: opacity .25s; }
	.hotspot { position: absolute; border-radius: 10px; cursor: pointer; border: 2px solid var(--accent);
		box-shadow: 0 0 0 9999px rgba(0,0,0,.28); animation: pulse 1.6s ease-in-out infinite; background: transparent; padding: 0; }
	.hotspot:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
	@keyframes pulse { 0%,100% { outline: 0 solid rgba(45,212,191,.55); } 50% { outline: 10px solid rgba(45,212,191,0); } }
	@media (prefers-reduced-motion: reduce) { .hotspot { animation: none; } .stage img { transition: none; } }
	.bar { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
	.caption { flex: 1; min-height: 2.6em; display: flex; align-items: center; font-size: 16px; }
	button.nav { border: 1px solid var(--line); background: var(--card); color: var(--fg); border-radius: 8px; padding: 8px 14px;
		font: inherit; cursor: pointer; }
	button.nav.primary { background: var(--accent); border-color: var(--accent); color: #04221f; font-weight: 600; }
	button.nav:disabled { opacity: .4; cursor: default; }
	.dots { display: flex; gap: 6px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
	.dots button { width: 9px; height: 9px; border-radius: 50%; border: 0; padding: 0; background: var(--line); cursor: pointer; }
	.dots button[aria-current="step"] { background: var(--accent); }
	.hint { color: var(--muted); font-size: 13px; text-align: center; margin-top: 8px; }
	@media (max-width: 600px) { .bar { flex-wrap: wrap; } .caption { flex-basis: 100%; order: -1; } }
</style>
</head>
<body>
<main>
	<header>
		<h1>${esc(title)}</h1>
		${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">View the project ↗</a>` : ""}
	</header>
	<div class="stage" id="stage"><img id="shot" alt=""></div>
	<div class="bar">
		<button class="nav" id="prev" aria-label="Previous step">←</button>
		<div class="caption" id="caption" aria-live="polite"></div>
		<button class="nav primary" id="next">Next →</button>
	</div>
	<div class="dots" id="dots" role="tablist" aria-label="Tour steps"></div>
	<p class="hint">Click the highlighted area, or use ← → keys</p>
</main>
<script>
const STEPS = ${data};
const $ = (id) => document.getElementById(id);
let i = 0;

STEPS.forEach((_, n) => {
	const b = document.createElement("button");
	b.setAttribute("aria-label", "Step " + (n + 1));
	b.onclick = () => go(n);
	$("dots").append(b);
});
// preload so steps switch instantly
STEPS.forEach((s) => { const im = new Image(); im.src = s.src; });

function go(n) {
	i = Math.max(0, Math.min(STEPS.length - 1, n));
	const s = STEPS[i];
	$("shot").src = s.src;
	$("shot").alt = s.caption || "Step " + (i + 1);
	$("caption").textContent = (i + 1) + "/" + STEPS.length + "  " + (s.caption || "");
	$("prev").disabled = i === 0;
	$("next").textContent = i === STEPS.length - 1 ? "Restart ↺" : "Next →";
	[...$("dots").children].forEach((d, n) => d.setAttribute("aria-current", n === i ? "step" : "false"));
	document.querySelector(".hotspot")?.remove();
	if (s.hotspot) {
		const h = document.createElement("button");
		h.className = "hotspot";
		h.setAttribute("aria-label", s.caption || "Continue");
		const pad = 0.006;
		Object.assign(h.style, {
			left: (s.hotspot.x - pad) * 100 + "%", top: (s.hotspot.y - pad) * 100 + "%",
			width: (s.hotspot.w + 2 * pad) * 100 + "%", height: (s.hotspot.h + 2 * pad) * 100 + "%",
		});
		h.onclick = () => go(i + 1);
		$("stage").append(h);
	}
}
$("prev").onclick = () => go(i - 1);
$("next").onclick = () => go(i === STEPS.length - 1 ? 0 : i + 1);
addEventListener("keydown", (e) => {
	if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(i === STEPS.length - 1 ? 0 : i + 1); }
	if (e.key === "ArrowLeft") go(i - 1);
});
go(0);
</script>
</body>
</html>
`;

await writeFile(outFile, html);
const { size: bytes } = await stat(outFile);
console.log(`${outFile}  ${steps.length} steps, ${(bytes / 1e6).toFixed(2)} MB`);
