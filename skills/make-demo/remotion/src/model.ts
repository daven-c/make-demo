// Turns the recorder's timeline.json (what happened, and when, in video seconds) into the state of the
// camera, cursor and captions at any moment. Presets only draw; the motion math lives here.
import { Easing, interpolate } from "remotion";

export type Box = { x: number; y: number; width: number; height: number };
export type Pt = { x: number; y: number };

export type TimelineEvent =
	| { t: number; type: "caption"; text: string | null }
	| { t: number; type: "glide"; from: Pt; to: Pt; ms: number }
	| { t: number; type: "click"; x: number; y: number; box: Box }
	| { t: number; type: "zoom"; box: Box | null; level: number; ms: number };

export type Timeline = {
	size: { width: number; height: number }; // the page viewport, in CSS px (event coordinates use this)
	fps: number;
	duration: number; // seconds of footage
	accent: string;
	intro: { title: string; subtitle?: string } | null;
	outro: { title: string; subtitle?: string } | null;
	start: Pt;
	palette?: Palette; // the app's own colours (recorded in clean mode); the "auto" theme is built from it
	events: TimelineEvent[];
};

export type Palette = { bg: string; text: string; accent: string };

export type DemoProps = { timeline: Timeline; videoFile: string; preset: string; fps: number; theme?: string };

export const ease = Easing.bezier(0.65, 0, 0.35, 1); // the same curve the in-page camera uses
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

// ---- Camera: scale + translate of the footage, in viewport px with the origin at the top-left. -------
export type Cam = { s: number; tx: number; ty: number };
export type CamSeg = { t0: number; t1: number; from: Cam; to: Cam; box: Box | null };
const IDENTITY: Cam = { s: 1, tx: 0, ty: 0 };

// Same rules as the in-page camera: zoom capped so the target fits with a margin, the target drifts halfway
// towards the centre, the whole target stays on screen, and the zoomed footage always covers the viewport.
function target(box: Box, level: number, W: number, H: number): Cam {
	let s = Math.min(level, (W * 0.86) / box.width, (H * 0.7) / box.height);
	if (s < 1.08) return IDENTITY;
	const axis = (b: number, len: number, view: number) => {
		const c = b + len / 2;
		let t = (c + view / 2) / 2 - s * c;
		const m = Math.min(24, (view - s * len) / 2);
		t = clamp(t, m - s * b, view - m - s * (b + len));
		return clamp(t, -(s - 1) * view, 0);
	};
	return { s, tx: axis(box.x, box.width, W), ty: axis(box.y, box.height, H) };
}

const union = (a: Box, b: Box): Box => {
	const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
	return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

// `box` of a segment is what the spotlight frames: the zoom target plus anything clicked while zoomed in on it.
export function cameraSegments(tl: Timeline): CamSeg[] {
	const segs: CamSeg[] = [];
	let cur = IDENTITY;
	const zooms = tl.events.filter((e): e is Extract<TimelineEvent, { type: "zoom" }> => e.type === "zoom");
	zooms.forEach((e, i) => {
		const to = e.box ? target(e.box, e.level, tl.size.width, tl.size.height) : IDENTITY;
		let box = e.box;
		const until = zooms[i + 1]?.t ?? Infinity;
		if (box && to.s > 1) {
			for (const c of tl.events) if (c.type === "click" && c.t >= e.t && c.t < until) box = union(box, c.box);
		}
		segs.push({ t0: e.t, t1: e.t + e.ms / 1000, from: cur, to, box });
		cur = to;
	});
	return segs;
}

export function cameraAt(segs: CamSeg[], t: number): Cam {
	const seg = [...segs].reverse().find((s) => s.t0 <= t);
	if (!seg) return IDENTITY;
	const e = ease(clamp01((t - seg.t0) / (seg.t1 - seg.t0)));
	return {
		s: seg.from.s + (seg.to.s - seg.from.s) * e,
		tx: seg.from.tx + (seg.to.tx - seg.from.tx) * e,
		ty: seg.from.ty + (seg.to.ty - seg.from.ty) * e,
	};
}

// 0..1: how strongly the spotlight is on, and which box it's on.
export function spotlightAt(segs: CamSeg[], t: number): { box: Box | null; alpha: number } {
	const active = [...segs].reverse().find((s) => s.t0 <= t);
	if (!active) return { box: null, alpha: 0 };
	if (active.box && active.to.s > 1) {
		const d = active.t1 - active.t0;
		return { box: active.box, alpha: interpolate(t, [active.t0 + d * 0.5, active.t1 + 0.25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) };
	}
	const prev = [...segs].reverse().find((s) => s.t0 < active.t0 && s.box && s.to.s > 1);
	return { box: prev?.box ?? null, alpha: 1 - clamp01((t - active.t0) / 0.4) };
}

// ---- Cursor: eased arcs between targets, plus click presses and ripples. -----------------------------
export function cursorAt(tl: Timeline, t: number): Pt {
	let pos = tl.start;
	for (const e of tl.events) {
		if (e.type !== "glide") continue;
		if (t < e.t) return pos;
		const p = (t - e.t) / (e.ms / 1000);
		if (p >= 1) {
			pos = e.to;
			continue;
		}
		const from = e.from;
		const dx = e.to.x - from.x, dy = e.to.y - from.y, dist = Math.hypot(dx, dy);
		if (dist < 2) return e.to;
		const bend = Math.min(dist * 0.16, 70) * (dx >= 0 ? 1 : -1);
		const cx = from.x + dx / 2 - (dy / dist) * bend, cy = from.y + dy / 2 + (dx / dist) * bend;
		const k = ease(clamp01(p)), u = 1 - k;
		return { x: u * u * from.x + 2 * u * k * cx + k * k * e.to.x, y: u * u * from.y + 2 * u * k * cy + k * k * e.to.y };
	}
	return pos;
}

export const clicksAt = (tl: Timeline, t: number) =>
	tl.events.filter((e): e is Extract<TimelineEvent, { type: "click" }> => e.type === "click" && t >= e.t && t < e.t + 0.8);

export const pressedAt = (tl: Timeline, t: number) => clicksAt(tl, t).some((c) => t - c.t < 0.14);

// ---- Captions: a caption shows from its event until the next one (or a null that hides it). ----------
export type CaptionSpan = { t0: number; t1: number; text: string };
export function captionSpans(tl: Timeline): CaptionSpan[] {
	const evs = tl.events.filter((e): e is Extract<TimelineEvent, { type: "caption" }> => e.type === "caption");
	const spans: CaptionSpan[] = [];
	evs.forEach((e, i) => {
		if (e.text) spans.push({ t0: Math.max(0, e.t), t1: evs[i + 1]?.t ?? tl.duration, text: e.text });
	});
	return spans;
}

// ---- Colour helpers (for themes built from the app's palette). ---------------------------------------
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
	const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
	const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
	const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
	let h = 0;
	if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return { h: ((h * 60) % 360 + 360) % 360, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
}
export const hsl = (h: number, s: number, l: number, a = 1) =>
	`hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}% / ${a})`;
