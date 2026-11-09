// Background themes. A theme is the backdrop plus the ink, shadow and window colours that have to match it.
// The app's accent colour only shows up in small touches (ripples, spotlight ring, caption underline), never
// as the background, so a demo of any app doesn't come out teal-and-purple.
import { AbsoluteFill } from "remotion";
import type { ReactNode } from "react";
import { hexToHsl, hsl, type Palette } from "./model";

export type Theme = {
	backdrop: (frame: number, fps: number) => ReactNode;
	ink: string; // title and caption text
	inkSoft: string; // subtitle
	titleFill: (accent: string) => string; // CSS background clipped to the title text
	captionShadow: string;
	windowShadow: string;
	windowRing: string;
	glow: boolean; // accent glow on underline and spotlight
	accent?: string; // overrides the recorder's accent for ripples, spotlight ring and underline
};
export type ThemeFactory = (palette: Palette) => Theme;

const grain = (opacity: number, blend: "multiply" | "overlay" | "soft-light" = "multiply") => (
	<AbsoluteFill style={{
		opacity, mixBlendMode: blend,
		backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
	}} />
);

// Warm off-white paper with soft daylight; the dark app window sits on it like a printed screenshot.
const paper: Theme = {
	backdrop: () => (
		<AbsoluteFill style={{ background: "#e8e3da" }}>
			<AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 30% 15%, #f6f3ed, transparent 70%)" }} />
			<AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 80% at 50% 110%, rgba(120,95,60,.18), transparent 70%)" }} />
			{grain(0.35)}
		</AbsoluteFill>
	),
	ink: "#1b1814", inkSoft: "rgba(27,24,20,.62)", titleFill: () => "linear-gradient(#1b1814, #1b1814)",
	captionShadow: "none",
	windowShadow: "0 60px 90px -30px rgba(70,45,15,.38), 0 24px 40px -12px rgba(70,45,15,.25)",
	windowRing: "0 0 0 1px rgba(0,0,0,.2)", glow: false,
};

// Near-black studio: one flat colour, one soft overhead light.
const studio: Theme = {
	backdrop: () => (
		<AbsoluteFill style={{ background: "#0c0c0f" }}>
			<AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,255,255,.075), transparent 70%)" }} />
			{grain(0.22, "overlay")}
		</AbsoluteFill>
	),
	ink: "#f4f2ee", inkSoft: "rgba(244,242,238,.62)", titleFill: () => "linear-gradient(#fff, #cfcac2)",
	captionShadow: "0 2px 20px rgba(0,0,0,.6)",
	windowShadow: "0 70px 120px -20px rgba(0,0,0,.85)",
	windowRing: "0 0 0 1px rgba(255,255,255,.2)", glow: false,
};

// A fixed, designed gradient (like a desktop wallpaper), not derived from the app's colours.
const dusk: Theme = {
	backdrop: () => (
		<AbsoluteFill style={{ background: "linear-gradient(155deg, #1c1745 0%, #4a2a7a 35%, #b8487a 70%, #f0975a 100%)" }}>
			<AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(255,255,255,.12), transparent 70%)" }} />
			{grain(0.28, "soft-light")}
		</AbsoluteFill>
	),
	ink: "#fff", inkSoft: "rgba(255,255,255,.78)", titleFill: () => "linear-gradient(#fff, #ffe3d0)",
	captionShadow: "0 2px 22px rgba(30,10,50,.55)",
	windowShadow: "0 70px 110px -20px rgba(25,8,50,.6)",
	windowRing: "0 0 0 1px rgba(255,255,255,.18)", glow: false,
};

// Built from the app's own colours: one hue (the app's brand colour) in a tonal, low-saturation backdrop that
// contrasts with the app (a dark app gets a pale tint of its brand hue, a light app gets a deep one). No
// second hue and no glow, so the demo feels like part of the app's brand rather than a template.
const auto: ThemeFactory = ({ bg, accent }) => {
	const a = hexToHsl(accent), b = hexToHsl(bg);
	const h = a.s > 0.15 ? a.h : b.s > 0.1 ? b.h : 30; // brand hue, else the app background's, else warm neutral
	const s = Math.max(0.1, Math.min(0.3, a.s * 0.32));
	const appIsDark = b.l < 0.45;
	return appIsDark
		? {
			backdrop: () => (
				<AbsoluteFill style={{ background: `linear-gradient(160deg, ${hsl(h - 6, s, 0.93)}, ${hsl(h + 8, s * 1.25, 0.86)})` }}>
					<AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 65% at 28% 12%, ${hsl(h, s * 0.6, 0.98)}, transparent 70%)` }} />
					<AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 70% at 55% 115%, ${hsl(h, s * 2, 0.55, 0.22)}, transparent 70%)` }} />
					{grain(0.3)}
				</AbsoluteFill>
			),
			ink: hsl(h, 0.3, 0.1), inkSoft: hsl(h, 0.22, 0.1, 0.62), titleFill: () => `linear-gradient(${hsl(h, 0.3, 0.1)}, ${hsl(h, 0.3, 0.1)})`,
			captionShadow: "none",
			windowShadow: `0 60px 90px -30px ${hsl(h, 0.5, 0.18, 0.4)}, 0 24px 40px -12px ${hsl(h, 0.5, 0.18, 0.26)}`,
			windowRing: `0 0 0 1px ${hsl(h, 0.4, 0.1, 0.22)}`, glow: false, accent,
		}
		: {
			backdrop: () => (
				<AbsoluteFill style={{ background: `linear-gradient(160deg, ${hsl(h - 6, s * 1.5, 0.1)}, ${hsl(h + 8, s * 1.7, 0.17)})` }}>
					<AbsoluteFill style={{ background: `radial-gradient(ellipse 65% 55% at 50% 0%, ${hsl(h, s * 1.6, 0.3, 0.55)}, transparent 70%)` }} />
					{grain(0.22, "overlay")}
				</AbsoluteFill>
			),
			ink: hsl(h, 0.25, 0.96), inkSoft: hsl(h, 0.2, 0.96, 0.66), titleFill: () => `linear-gradient(${hsl(h, 0.3, 1)}, ${hsl(h, 0.3, 0.85)})`,
			captionShadow: `0 2px 20px ${hsl(h, 0.5, 0.05, 0.6)}`,
			windowShadow: `0 70px 110px -20px ${hsl(h, 0.6, 0.04, 0.75)}`,
			windowRing: "0 0 0 1px rgba(255,255,255,.16)", glow: false, accent,
		};
};

export const themes: Record<string, ThemeFactory> = { auto, paper: () => paper, studio: () => studio, dusk: () => dusk };
export const DEFAULT_THEME = "auto";
// Without a recorded palette (a non-clean recording) "auto" falls back to this one.
export const FALLBACK_PALETTE: Palette = { bg: "#0b0e14", text: "#e5e7eb", accent: "#14b8a6" };
