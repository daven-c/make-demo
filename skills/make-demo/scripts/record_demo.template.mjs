// Demo recorder template (from the make-demo skill). Copy into the project, then edit CONFIG,
// warmUp() and STEPS. One run produces:
//   <outDir>/demo.webm             video for the MP4/GIF (encode with encode.sh)
//   <outDir>/tour/steps.json + *.jpg   screenshots + hotspots for the interactive tour (build_tour.mjs)
//
//   DEMO_URL=http://localhost:5173 node scripts/record-demo.mjs
//
// Requires `playwright` (dev dependency). Uses the installed Google Chrome because Playwright's
// bundled Chromium can't decode H.264/AAC; set DEMO_CHANNEL="" to use bundled Chromium instead.

import { chromium } from "playwright";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const CONFIG = {
	url: process.env.DEMO_URL ?? "http://localhost:5173",
	outDir: path.resolve(process.env.DEMO_OUT ?? "demo-out"),
	size: { width: 1280, height: 720 },
	colorScheme: "dark",
	channel: process.env.DEMO_CHANNEL ?? "chrome",
	typeDelayMs: 55,
};

// Prime anything slow on first use (caches, thumbnails, model load) so the video doesn't show
// spinners. Runs before recording starts. Example: hit the API once per query you'll show.
async function warmUp() {
	// await fetch(`${CONFIG.url}/api/search?q=example`);
}

// The story. Each step sets a caption and runs actions through the helpers:
//   click(locator, note?)   glide + real mouse click; records a tour step (screenshot + hotspot)
//   type(locator, text)     click into a field and type at a human pace
//   snap(note)              record a tour step with no hotspot (e.g. a results view)
//   caption(text|null)      set or hide the caption bar
//   wait(ms)                pause so viewers can read
//   page                    the Playwright page, for waitFor()/getByRole()/etc.
const STEPS = [
	{
		caption: "Replace these steps with your app's story",
		run: async ({ page, wait, snap }) => {
			await page.locator("body").waitFor();
			await wait(2500);
			await snap("The app's starting screen");
		},
	},
	// {
	// 	caption: "Describe a scene in plain English",
	// 	run: async ({ page, type, click, wait, snap }) => {
	// 		const input = page.getByPlaceholder("Search…");
	// 		await type(input, "a dog catching a frisbee");
	// 		await page.keyboard.press("Enter");
	// 		await page.getByText(/results/).waitFor();          // wait on UI state, then let it breathe
	// 		await wait(1500);
	// 		await click(page.locator("img").first(), "Open the top result at the matching moment");
	// 		await wait(3000);
	// 	},
	// },
];

// ---------------------------------------------------------------------------------------------

const overlay = () => {
	const style = document.createElement("style");
	style.textContent = `
		#demo-cursor { position: fixed; z-index: 2147483647; width: 18px; height: 18px; margin: -9px 0 0 -9px;
			border-radius: 50%; background: rgba(255,255,255,.85); box-shadow: 0 0 0 2px rgba(20,184,166,.9);
			pointer-events: none; transition: transform .12s; left: -50px; top: -50px; }
		#demo-cursor.down { transform: scale(.7); }
		#demo-caption { position: fixed; z-index: 2147483646; left: 50%; bottom: 28px; transform: translateX(-50%);
			max-width: 80%; padding: 10px 18px; border-radius: 10px; background: rgba(15,23,42,.88); color: #fff;
			font: 500 17px/1.35 system-ui, sans-serif; text-align: center; opacity: 0; transition: opacity .3s;
			pointer-events: none; }
		.demo-hide #demo-cursor, .demo-hide #demo-caption { visibility: hidden !important; }`;
	const cursor = Object.assign(document.createElement("div"), { id: "demo-cursor" });
	const caption = Object.assign(document.createElement("div"), { id: "demo-caption" });
	const mount = () => document.body.append(style, cursor, caption);
	document.body ? mount() : addEventListener("DOMContentLoaded", mount);
	addEventListener("mousemove", (e) => { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; }, true);
	addEventListener("mousedown", () => cursor.classList.add("down"), true);
	addEventListener("mouseup", () => cursor.classList.remove("down"), true);
	window.__caption = (text) => {
		caption.textContent = text ?? "";
		caption.style.opacity = text ? "1" : "0";
	};
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
	const tourDir = path.join(CONFIG.outDir, "tour");
	await rm(tourDir, { recursive: true, force: true });
	await mkdir(tourDir, { recursive: true });
	await warmUp();

	const browser = await chromium.launch({
		...(CONFIG.channel ? { channel: CONFIG.channel } : {}),
		args: ["--autoplay-policy=no-user-gesture-required"],
	});
	const context = await browser.newContext({
		viewport: CONFIG.size,
		colorScheme: CONFIG.colorScheme,
		recordVideo: { dir: CONFIG.outDir, size: CONFIG.size },
	});
	await context.addInitScript(overlay);
	const recordingStarted = performance.now(); // video capture starts with the page
	const page = await context.newPage();
	const video = page.video();
	let readyAt = 0;

	const tour = [];
	let currentCaption = "";

	// Tour screenshots hide the fake cursor and caption; the tour draws its own hotspot and text.
	async function snap(note, box = null) {
		const file = `step-${String(tour.length + 1).padStart(2, "0")}.jpg`;
		await page.evaluate(() => document.documentElement.classList.add("demo-hide"));
		await page.screenshot({ path: path.join(tourDir, file), type: "jpeg", quality: 80 });
		await page.evaluate(() => document.documentElement.classList.remove("demo-hide"));
		tour.push({
			image: file,
			caption: note ?? currentCaption,
			hotspot: box && {
				x: box.x / CONFIG.size.width,
				y: box.y / CONFIG.size.height,
				w: box.width / CONFIG.size.width,
				h: box.height / CONFIG.size.height,
			},
		});
	}

	async function glide(locator) {
		await locator.scrollIntoViewIfNeeded();
		const box = await locator.boundingBox();
		if (!box) throw new Error("glide: element not visible");
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
		return box;
	}

	// Real mouse click at the element's centre: overlays on top of the target receive it and
	// bubble it, exactly like a user's click. (locator.click() refuses when something covers it.)
	async function click(locator, note) {
		const box = await glide(locator);
		if (note !== false) await snap(note, box);
		await sleep(250);
		await page.mouse.down();
		await sleep(80);
		await page.mouse.up();
	}

	async function type(locator, text) {
		await click(locator, false);
		await locator.fill("");
		await locator.pressSequentially(text, { delay: CONFIG.typeDelayMs });
	}

	async function caption(text) {
		currentCaption = text ?? "";
		await page.evaluate((t) => window.__caption(t), text);
	}

	const helpers = { page, click, type, snap, caption, glide, wait: sleep };

	try {
		await page.goto(CONFIG.url);
		// "load", not "networkidle": apps with polling/streaming requests never go idle
		await page.waitForLoadState("load");
		await sleep(500); // let the first paint settle; steps should still wait on their own UI state
		// everything before this is a blank/white page load; encode.sh trims it using recording.json
		readyAt = (performance.now() - recordingStarted) / 1000;
		await page.mouse.move(CONFIG.size.width / 2, CONFIG.size.height * 0.7);
		for (const step of STEPS) {
			if (step.caption !== undefined) await caption(step.caption);
			await step.run(helpers);
		}
		await caption(null);
		await sleep(500);
	} finally {
		await context.close();
		await browser.close();
	}

	const out = path.join(CONFIG.outDir, "demo.webm");
	await rm(out, { force: true });
	await rename(await video.path(), out);
	await writeFile(
		path.join(tourDir, "steps.json"),
		JSON.stringify({ size: CONFIG.size, steps: tour }, null, 2) + "\n"
	);
	await writeFile(
		path.join(CONFIG.outDir, "recording.json"),
		JSON.stringify({ readyAt: Number(readyAt.toFixed(2)) }) + "\n"
	);
	console.log(`recorded ${out} (app ready at ${readyAt.toFixed(1)}s)\ntour: ${tour.length} steps in ${tourDir}`);
}

main().catch(async (e) => {
	console.error(e);
	// drop partial recordings (page@<hash>.webm) left by a failed run
	for (const f of await readdir(CONFIG.outDir).catch(() => [])) {
		if (/^page@.*\.webm$/.test(f)) await rm(path.join(CONFIG.outDir, f), { force: true });
	}
	process.exit(1);
});
