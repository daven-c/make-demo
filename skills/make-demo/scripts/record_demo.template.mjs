// Demo recorder template (from the make-demo skill). Copy into the project, then edit CONFIG,
// warmUp() and STEPS. One run produces:
//   <outDir>/raw.mp4                   60 fps master video (encode with encode.sh)
//   <outDir>/tour/steps.json + *.jpg   screenshots + hotspots for the interactive tour (build_tour.mjs)
//
//   DEMO_URL=http://localhost:5173 node scripts/record-demo.mjs
//
// Requires `playwright` (dev dependency) and ffmpeg. Frames come from the DevTools screencast at 2x
// device scale, so text stays sharp and motion is as smooth as the page renders (Playwright's own
// recordVideo is 25 fps and heavily compressed). Uses the installed Google Chrome because
// Playwright's bundled Chromium can't decode H.264/AAC; set DEMO_CHANNEL="" to use it anyway.

import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const CONFIG = {
	url: process.env.DEMO_URL ?? "http://localhost:5173",
	outDir: path.resolve(process.env.DEMO_OUT ?? "demo-out"),
	size: { width: 1280, height: 720 },
	scale: 2, // device pixel ratio of the capture
	fps: 60,
	colorScheme: "dark",
	channel: process.env.DEMO_CHANNEL ?? "chrome",
	typeDelayMs: 65,
	zoom: 1.7, // default level for zoom()
	camera: "body", // element zoom() scales; use your app root (e.g. "#root") if fixed headers misbehave
	accent: "#14b8a6",
	intro: { title: "MyApp", subtitle: "One line on what it does" }, // title card; null to skip
	outro: { title: "MyApp", subtitle: "github.com/you/myapp" },
};

// Prime anything slow on first use (caches, thumbnails, model load) so the video doesn't show
// spinners. Runs before recording starts. Example: hit the API once per query you'll show.
async function warmUp() {
	// await fetch(`${CONFIG.url}/api/search?q=example`);
}

// The story. Each step sets a caption and runs actions through the helpers:
//   click(locator, note?)   eased cursor glide + real mouse click; records a tour step (screenshot + hotspot)
//   type(locator, text)     click into a field and type at a human pace
//   zoom(locator, level?)   smoothly zoom the camera towards an element (stays zoomed until zoomOut)
//   zoomOut()               smoothly return to the full view
//   snap(note)              record a tour step with no hotspot (e.g. a results view)
//   caption(text|null)      set or hide the caption
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
	// 	run: async ({ page, type, click, zoom, zoomOut, wait }) => {
	// 		const input = page.getByPlaceholder("Search…");
	// 		await zoom(input);                                   // move in close for the typing
	// 		await type(input, "a dog catching a frisbee");
	// 		await page.keyboard.press("Enter");
	// 		await zoomOut();                                     // pull back to reveal the results
	// 		await page.getByText(/results/).waitFor();          // wait on UI state, then let it breathe
	// 		await wait(1500);
	// 		await click(page.locator("img").first(), "Open the top result at the matching moment");
	// 		await wait(3000);
	// 	},
	// },
];

// ---------------------------------------------------------------------------------------------

// Runs in the page: fake cursor, click ripple, caption, title card and camera. Everything animates
// in the page itself (requestAnimationFrame / CSS transitions), so motion is frame-smooth.
const overlay = ({ accent, camera }) => {
	const ease = "cubic-bezier(.65,0,.35,1)";
	const style = document.createElement("style");
	style.textContent = `
		html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }
		#demo-cursor { position: fixed; z-index: 2147483647; left: 0; top: 0; pointer-events: none;
			transform: translate(-100px, -100px); filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
		#demo-cursor svg { display: block; transform-origin: 4px 3px; transition: transform .12s ease-out; }
		#demo-cursor.down svg { transform: scale(.8); }
		.demo-ripple { position: fixed; z-index: 2147483646; width: 46px; height: 46px; margin: -23px 0 0 -23px;
			border-radius: 50%; border: 3px solid ${accent}; pointer-events: none;
			animation: demo-ripple .6s cubic-bezier(.2,.7,.3,1) forwards; }
		@keyframes demo-ripple { from { transform: scale(.2); opacity: .95; } to { transform: scale(1.5); opacity: 0; } }
		#demo-caption { position: fixed; z-index: 2147483646; left: 50%; bottom: 34px; max-width: 80%;
			padding: 12px 22px; border-radius: 14px; background: rgba(12,18,30,.74); color: #fff;
			border: 1px solid rgba(255,255,255,.12); box-shadow: 0 12px 40px rgba(0,0,0,.35);
			backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
			font: 500 20px/1.35 system-ui, -apple-system, sans-serif; letter-spacing: -.01em; text-align: center;
			pointer-events: none; opacity: 0; transform: translate(-50%, 14px) scale(.98);
			transition: opacity .35s ease, transform .5s cubic-bezier(.2,.8,.2,1); }
		#demo-caption.on { opacity: 1; transform: translate(-50%, 0); }
		#demo-card { position: fixed; inset: 0; z-index: 2147483645; display: grid; place-content: center; gap: 16px;
			text-align: center; color: #fff; pointer-events: none; opacity: 0; transition: opacity .7s ease;
			background: radial-gradient(ellipse 70% 60% at 50% 42%, ${accent}38, transparent 70%), #06090e;
			font-family: system-ui, -apple-system, sans-serif; }
		#demo-card.on { opacity: 1; }
		#demo-card h1 { margin: 0; font-size: 72px; font-weight: 750; letter-spacing: -.035em; }
		#demo-card p { margin: 0; font-size: 26px; color: rgba(255,255,255,.68); }
		#demo-card h1, #demo-card p { opacity: 0; transform: translateY(18px);
			transition: opacity .8s ease, transform 1s cubic-bezier(.2,.8,.2,1); }
		#demo-card p { transition-delay: .18s; }
		#demo-card.text h1, #demo-card.text p { opacity: 1; transform: none; }
		#demo-card.instant, #demo-card.instant * { transition: none !important; }
		.demo-hide #demo-cursor, .demo-hide #demo-caption, .demo-hide #demo-card, .demo-hide .demo-ripple
			{ visibility: hidden !important; }`;
	const el = (tag, props) => Object.assign(document.createElement(tag), props);
	const cursor = el("div", { id: "demo-cursor" });
	cursor.innerHTML = `<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 2.5v18.2l4.6-4.4 2.9 6.8 3.2-1.4-2.9-6.6h6.4z"
		fill="#fff" stroke="#0b0f14" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
	const caption = el("div", { id: "demo-caption" });
	const card = el("div", { id: "demo-card" });
	const h1 = el("h1"), sub = el("p");
	card.append(h1, sub);
	// overlays live on <html>, outside the element the camera scales, so they never zoom
	const mount = () => document.documentElement.append(style, card, caption, cursor);
	document.body ? mount() : addEventListener("DOMContentLoaded", mount);

	let pos = null;
	const place = (x, y) => {
		pos = { x, y };
		cursor.style.transform = `translate(${x - 4}px, ${y - 2.5}px)`;
	};
	addEventListener("mousemove", (e) => place(e.clientX, e.clientY), true);
	addEventListener("mousedown", () => {
		cursor.classList.add("down");
		if (!pos) return;
		const ripple = el("div", { className: "demo-ripple" });
		Object.assign(ripple.style, { left: `${pos.x}px`, top: `${pos.y}px` });
		document.documentElement.append(ripple);
		setTimeout(() => ripple.remove(), 700);
	}, true);
	addEventListener("mouseup", () => cursor.classList.remove("down"), true);

	// Ease the cursor along a gentle arc, like a hand moving a mouse.
	window.__glide = (x, y, ms) => new Promise((done) => {
		const from = pos;
		const dx = x - (from?.x ?? x), dy = y - (from?.y ?? y), dist = Math.hypot(dx, dy);
		if (!from || dist < 2) return place(x, y), done();
		const bend = Math.min(dist * 0.16, 70) * (dx >= 0 ? 1 : -1);
		const cx = from.x + dx / 2 - (dy / dist) * bend, cy = from.y + dy / 2 + (dx / dist) * bend;
		const t0 = performance.now();
		const frame = (now) => {
			const t = Math.min(1, (now - t0) / ms);
			const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
			const u = 1 - e;
			place(u * u * from.x + 2 * u * e * cx + e * e * x, u * u * from.y + 2 * u * e * cy + e * e * y);
			t < 1 ? requestAnimationFrame(frame) : done();
		};
		requestAnimationFrame(frame);
	});

	let captionTimer;
	const showCaption = (text) => {
		caption.textContent = text ?? "";
		caption.classList.toggle("on", !!text);
	};
	window.__caption = (text) => {
		clearTimeout(captionTimer);
		if (caption.classList.contains("on") && text && caption.textContent !== text) {
			caption.classList.remove("on"); // fade the old caption out before the new one slides in
			captionTimer = setTimeout(() => showCaption(text), 320);
		} else showCaption(text);
	};

	window.__card = ({ title, subtitle, on, text, instant }) => {
		if (title !== undefined) { h1.textContent = title; sub.textContent = subtitle ?? ""; }
		card.classList.toggle("instant", !!instant);
		card.classList.toggle("on", on);
		card.classList.toggle("text", text);
	};

	// Camera: scale the app's root about an origin chosen so the target drifts towards the centre.
	// The origin stays inside the visible area, so the zoomed page always covers the viewport.
	const cam = { s: 1, ox: 0, oy: 0 };
	window.__camera = (vx, vy, s, ms) => new Promise((done) => {
		const root = document.querySelector(camera) ?? document.body;
		const r = root.getBoundingClientRect();
		const left = r.left - cam.ox * (1 - cam.s), top = r.top - cam.oy * (1 - cam.s); // untransformed box
		let { ox, oy } = cam;
		if (s !== 1) {
			const qx = (vx - left - cam.ox) / cam.s + cam.ox, qy = (vy - top - cam.oy) / cam.s + cam.oy;
			const tx = (left + qx + innerWidth / 2) / 2, ty = (top + qy + innerHeight / 2) / 2;
			const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
			ox = clamp((tx - left - s * qx) / (1 - s), -left, innerWidth - left);
			oy = clamp((ty - top - s * qy) / (1 - s), -top, innerHeight - top);
		}
		if (cam.s === 1) {
			// set the origin while unscaled (invisible), then animate only the scale
			root.style.transition = "none";
			root.style.transformOrigin = `${ox}px ${oy}px`;
			root.style.transform = "scale(1)";
			root.getBoundingClientRect();
		}
		root.style.transition = `transform ${ms}ms ${ease}, transform-origin ${ms}ms ${ease}`;
		root.style.transformOrigin = `${ox}px ${oy}px`;
		root.style.transform = `scale(${s})`;
		Object.assign(cam, { s, ox, oy });
		setTimeout(() => {
			// a transform makes the root a containing block for position:fixed; drop it when unzoomed
			if (s === 1) Object.assign(root.style, { transition: "", transform: "", transformOrigin: "" });
			done();
		}, ms + 40);
	});
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = promisify(execFile);

// DevTools screencast: a JPEG every time the page paints, with its timestamp. Frames arriving while
// `paused` (tour screenshots hide the overlays) are dropped; the previous frame is held instead.
async function startCapture(page, dir) {
	const cdp = await page.context().newCDPSession(page);
	const frames = [];
	const writes = [];
	const capture = { paused: false };
	cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
		cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
		if (capture.paused) return;
		const file = `f${String(frames.length).padStart(6, "0")}.jpg`;
		frames.push({ file, t: metadata.timestamp });
		writes.push(writeFile(path.join(dir, file), Buffer.from(data, "base64")));
	});
	await cdp.send("Page.startScreencast", {
		format: "jpeg",
		quality: 92,
		maxWidth: CONFIG.size.width * CONFIG.scale,
		maxHeight: CONFIG.size.height * CONFIG.scale,
	});
	capture.stop = async () => {
		const end = Date.now() / 1000; // screencast timestamps are seconds since the epoch
		await cdp.send("Page.stopScreencast");
		await Promise.all(writes);
		return { frames, end };
	};
	return capture;
}

// Turn the variable-rate frames into a constant-rate H.264 master.
async function assemble({ frames, end }, dir, out) {
	if (!frames.length) throw new Error("no frames captured");
	const list = frames.map((f, i) => {
		const next = frames[i + 1]?.t ?? Math.max(end, f.t + 1 / CONFIG.fps);
		return `file '${f.file}'\nduration ${Math.max(0, next - f.t).toFixed(4)}`;
	});
	list.push(`file '${frames.at(-1).file}'`); // concat demuxer ignores the last duration otherwise
	await writeFile(path.join(dir, "frames.txt"), list.join("\n") + "\n");
	await run("ffmpeg", ["-nostdin", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
		"-i", path.join(dir, "frames.txt"),
		"-vf", `fps=${CONFIG.fps},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`,
		"-c:v", "libx264", "-preset", "medium", "-crf", "14", "-movflags", "+faststart", out]);
}

async function main() {
	const tourDir = path.join(CONFIG.outDir, "tour");
	const framesDir = path.join(CONFIG.outDir, "frames");
	for (const d of [tourDir, framesDir]) {
		await rm(d, { recursive: true, force: true });
		await mkdir(d, { recursive: true });
	}
	await warmUp();

	const browser = await chromium.launch({
		...(CONFIG.channel ? { channel: CONFIG.channel } : {}),
		args: [
			"--autoplay-policy=no-user-gesture-required",
			// the screencast only delivers device pixels when both of these match the viewport
			`--force-device-scale-factor=${CONFIG.scale}`,
			`--window-size=${CONFIG.size.width},${CONFIG.size.height}`,
		],
	});
	const context = await browser.newContext({
		viewport: CONFIG.size,
		deviceScaleFactor: CONFIG.scale,
		colorScheme: CONFIG.colorScheme,
	});
	await context.addInitScript(overlay, { accent: CONFIG.accent, camera: CONFIG.camera });
	const page = await context.newPage();

	const tour = [];
	let capture;

	// Tour screenshots hide the fake cursor and caption; the tour draws its own hotspot and text.
	async function snap(note, box = null) {
		const file = `step-${String(tour.length + 1).padStart(2, "0")}.jpg`;
		capture.paused = true;
		await page.evaluate(() => document.documentElement.classList.add("demo-hide"));
		await page.screenshot({ path: path.join(tourDir, file), type: "jpeg", quality: 80, scale: "css" });
		await page.evaluate(() => document.documentElement.classList.remove("demo-hide"));
		await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
		await sleep(60);
		capture.paused = false;
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
		const inView = await locator.evaluate((el) => {
			const r = el.getBoundingClientRect();
			return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
		});
		if (!inView) {
			await locator.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
			await sleep(700);
		}
		const box = await locator.boundingBox();
		if (!box) throw new Error("glide: element not visible");
		const x = box.x + box.width / 2, y = box.y + box.height / 2;
		const from = await page.evaluate(() => document.getElementById("demo-cursor")?.style.transform);
		const [fx, fy] = (from?.match(/-?[\d.]+/g) ?? [x, y]).map(Number);
		const ms = Math.min(1100, Math.max(450, 380 + Math.hypot(x - fx, y - fy) * 0.55));
		await page.evaluate(([x, y, ms]) => window.__glide(x, y, ms), [x, y, ms]);
		await page.mouse.move(x, y); // the real pointer follows, for hover states and the click
		return box;
	}

	// Real mouse click at the element's centre: overlays on top of the target receive it and
	// bubble it, exactly like a user's click. (locator.click() refuses when something covers it.)
	async function click(locator, note) {
		const box = await glide(locator);
		if (note !== false) await snap(note, box);
		await sleep(140);
		await page.mouse.down();
		await sleep(90);
		await page.mouse.up();
	}

	async function type(locator, text) {
		await click(locator, false);
		await locator.fill("");
		for (const ch of text) {
			await page.keyboard.type(ch);
			await sleep(CONFIG.typeDelayMs * (0.55 + Math.random() * 0.9)); // uneven, like a person
		}
	}

	async function zoom(locator, level = CONFIG.zoom) {
		const box = await locator.boundingBox();
		if (!box) throw new Error("zoom: element not visible");
		await page.evaluate(([x, y, s]) => window.__camera(x, y, s, 1000), [box.x + box.width / 2, box.y + box.height / 2, level]);
	}

	const zoomOut = () => page.evaluate(() => window.__camera(0, 0, 1, 1000));

	let currentCaption = "";
	async function caption(text) {
		currentCaption = text ?? "";
		await page.evaluate((t) => window.__caption(t), text);
	}

	const card = (opts) => page.evaluate((o) => window.__card(o), opts);
	const helpers = { page, click, type, snap, caption, glide, zoom, zoomOut, wait: sleep };

	try {
		await page.goto(CONFIG.url);
		// "load", not "networkidle": apps with polling/streaming requests never go idle
		await page.waitForLoadState("load");
		await sleep(500); // let the first paint settle; steps should still wait on their own UI state
		await page.mouse.move(CONFIG.size.width / 2, CONFIG.size.height * 0.72);
		if (CONFIG.intro) await card({ ...CONFIG.intro, on: true, text: false, instant: true });
		// capture starts after load, so the video never shows a blank page
		capture = await startCapture(page, framesDir);
		if (CONFIG.intro) {
			await sleep(300);
			await card({ on: true, text: true });
			await sleep(2200);
			await card({ on: false, text: true });
			await sleep(800);
		}
		for (const step of STEPS) {
			if (step.caption !== undefined) await caption(step.caption);
			await step.run(helpers);
		}
		await caption(null);
		await page.evaluate(() => window.__camera(0, 0, 1, 800));
		if (CONFIG.outro) {
			await card({ ...CONFIG.outro, on: true, text: false });
			await sleep(450);
			await card({ on: true, text: true });
			await sleep(2600);
		} else await sleep(600);
		const out = path.join(CONFIG.outDir, "raw.mp4");
		const captured = await capture.stop();
		await assemble(captured, framesDir, out);
		const seconds = captured.end - captured.frames[0].t;
		console.log(`recorded ${out} (${seconds.toFixed(1)} s, ${(captured.frames.length / seconds).toFixed(0)} fps captured)`);
	} finally {
		await context.close();
		await browser.close();
	}

	await rm(framesDir, { recursive: true, force: true });
	await writeFile(
		path.join(tourDir, "steps.json"),
		JSON.stringify({ size: CONFIG.size, steps: tour }, null, 2) + "\n"
	);
	console.log(`tour: ${tour.length} steps in ${tourDir}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
