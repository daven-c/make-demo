// "device": the footage in a floating browser window over an animated aurora background, with a camera that
// pushes in on the target, a spotlight that dims everything else, a drawn cursor and click ripples,
// word-by-word captions, and kinetic title cards.
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { INTRO, OUTRO } from "../Root";
import {
	cameraAt, cameraSegments, captionSpans, clicksAt, cursorAt, ease, pressedAt, spotlightAt,
	type Timeline,
} from "../model";
import type { PresetProps } from "../Demo";
import { DEFAULT_THEME, FALLBACK_PALETTE, themes, type Theme } from "../themes";

const FONT = `"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif`;
const CW = 1440, BAR = 46, WIN_TOP = 64; // content width, title-bar height, window top
const CH = (CW * 9) / 16;
const WIN_LEFT = (1920 - CW) / 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const Backdrop: React.FC<{ theme: Theme }> = ({ theme }) => {
	const f = useCurrentFrame();
	const { fps } = useVideoConfig();
	return <>{theme.backdrop(f, fps)}</>;
};

const TitleCard: React.FC<{ title: string; subtitle?: string; accent: string; theme: Theme; start: number; exitAt?: number }> = ({ title, subtitle, accent, theme, start, exitAt }) => {
	const f = useCurrentFrame();
	const { fps } = useVideoConfig();
	const local = f - start;
	if (local < 0) return null;
	const exit = exitAt === undefined ? 0 : clamp01((f - exitAt) / (0.5 * fps));
	if (exit >= 1) return null;
	const chars = [...title];
	return (
		<AbsoluteFill style={{
			alignItems: "center", justifyContent: "center", fontFamily: FONT, color: theme.ink, textAlign: "center",
			opacity: 1 - exit, transform: `scale(${1 + exit * 0.08})`, filter: `blur(${exit * 16}px)`,
		}}>
			<div style={{ fontSize: 148, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1, display: "flex", whiteSpace: "pre" }}>
				{chars.map((c, i) => {
					const s = spring({ frame: local - i * 2.5, fps, config: { damping: 18, stiffness: 140, mass: 0.8 } });
					return (
						<span key={i} style={{
							display: "inline-block", opacity: clamp01(s * 1.6), transform: `translateY(${(1 - s) * 70}px) rotate(${(1 - s) * 6}deg)`,
							filter: `blur(${(1 - s) * 14}px)`,
							background: theme.titleFill(accent), WebkitBackgroundClip: "text", color: "transparent",
						}}>{c}</span>
					);
				})}
			</div>
			{subtitle && (
				<div style={{
					marginTop: 28, fontSize: 38, fontWeight: 500, color: theme.inkSoft, letterSpacing: "-0.01em",
					opacity: interpolate(local, [chars.length * 2.5 + 8, chars.length * 2.5 + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
					transform: `translateY(${interpolate(local, [chars.length * 2.5 + 8, chars.length * 2.5 + 26], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
				}}>{subtitle}</div>
			)}
			<div style={{
				marginTop: 36, height: 4, borderRadius: 2, background: accent, boxShadow: theme.glow ? `0 0 24px ${accent}` : "none",
				width: interpolate(local, [10, 40], [0, 180], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }),
			}} />
		</AbsoluteFill>
	);
};

const Caption: React.FC<{ text: string; start: number; end: number; accent: string; theme: Theme }> = ({ text, start, end, accent, theme }) => {
	const f = useCurrentFrame();
	const { fps } = useVideoConfig();
	if (f < start || f > end) return null;
	const words = text.split(" ");
	const out = clamp01((f - (end - 0.35 * fps)) / (0.3 * fps));
	return (
		<div style={{
			position: "absolute", left: 0, right: 0, top: WIN_TOP + BAR + CH + 50, display: "flex", justifyContent: "center",
			opacity: 1 - out, transform: `translateY(${out * 10}px)`, fontFamily: FONT,
		}}>
			<div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 14px", maxWidth: 1400, fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", color: theme.ink, textShadow: theme.captionShadow }}>
				{words.map((w, i) => {
					const s = spring({ frame: f - start - i * 3, fps, config: { damping: 20, stiffness: 170 } });
					return <span key={i} style={{ display: "inline-block", opacity: clamp01(s * 1.5), transform: `translateY(${(1 - s) * 22}px)`, filter: `blur(${(1 - s) * 8}px)` }}>{w}</span>;
				})}
			</div>
			<div style={{ position: "absolute", bottom: -16, height: 3, width: 64 * clamp01((f - start) / (0.5 * fps)), background: accent, borderRadius: 2, boxShadow: theme.glow ? `0 0 18px ${accent}` : "none" }} />
		</div>
	);
};

export const Device: React.FC<PresetProps> = ({ timeline: tl, videoFile, theme: themeName }) => {
	const make = themes[themeName ?? DEFAULT_THEME];
	if (!make) throw new Error(`unknown theme "${themeName}"; available: ${Object.keys(themes).join(", ")}`);
	const theme = make(tl.palette ?? FALLBACK_PALETTE);
	const accent = theme.accent ?? tl.accent;
	const f = useCurrentFrame();
	const { fps } = useVideoConfig();
	const intro = tl.intro ? INTRO : 0.4;
	const vs = Math.round((intro - 0.35) * fps); // the window enters and the footage starts here
	const vDur = Math.ceil(tl.duration * fps);
	const ve = vs + vDur;
	const t = (f - vs) / fps; // seconds into the footage
	const k = CW / tl.size.width; // viewport px -> window px

	const segs = cameraSegments(tl);
	const cam = cameraAt(segs, t);
	const spot = spotlightAt(segs, t);
	const cur = cursorAt(tl, t);
	const toWin = (x: number, y: number) => ({ x: (cam.tx + cam.s * x) * k, y: (cam.ty + cam.s * y) * k });
	const c = toWin(cur.x, cur.y);

	const enter = spring({ frame: f - vs, fps, config: { damping: 200, stiffness: 90 } });
	const exit = ease(clamp01((f - (ve - 0.6 * fps)) / (0.6 * fps)));
	const bob = Math.sin(f / fps * 0.6);
	const rotY = (1 - enter) * -16 + bob * 1.1 + exit * 8;
	const rotX = (1 - enter) * 10 + Math.cos(f / fps * 0.45) * 0.7;
	const visible = f >= vs - 2 && exit < 1;

	const sp = spot.box ? (() => {
		const a = toWin(spot.box.x, spot.box.y);
		const pad = 16;
		return { x: a.x - pad, y: a.y - pad, w: spot.box.width * cam.s * k + pad * 2, h: spot.box.height * cam.s * k + pad * 2 };
	})() : null;

	return (
		<AbsoluteFill>
			<Backdrop theme={theme} />

			{tl.intro && <TitleCard title={tl.intro.title} subtitle={tl.intro.subtitle} accent={accent} theme={theme} start={0} exitAt={vs - 0.05 * fps} />}

			{visible && (
				<AbsoluteFill style={{ perspective: 2600, opacity: enter * (1 - exit) }}>
					<div style={{
						position: "absolute", left: WIN_LEFT, top: WIN_TOP, width: CW, height: CH + BAR, borderRadius: 20,
						transform: `translateY(${(1 - enter) * 90 - exit * 30}px) scale(${0.9 + enter * 0.1 - exit * 0.05}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
						boxShadow: `${theme.windowShadow}, ${theme.windowRing}`,
						background: "#0b0e14", overflow: "hidden",
					}}>
						<div style={{ height: BAR, display: "flex", alignItems: "center", padding: "0 20px", background: "linear-gradient(#1b1f29,#151821)", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
							{["#ff5f57", "#febc2e", "#28c840"].map((col) => <div key={col} style={{ width: 14, height: 14, borderRadius: 7, background: col, marginRight: 9 }} />)}
							<div style={{ margin: "0 auto", transform: "translateX(-34px)", padding: "6px 22px", borderRadius: 8, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.55)", font: `500 16px ${FONT}`, minWidth: 260, textAlign: "center" }}>
								{tl.intro?.title.toLowerCase() ?? "app"}
							</div>
						</div>
						<div style={{ position: "relative", width: CW, height: CH, overflow: "hidden" }}>
							<div style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH, transformOrigin: "0 0", transform: `translate(${cam.tx * k}px, ${cam.ty * k}px) scale(${cam.s})` }}>
								<Sequence from={vs} layout="none">
									<OffthreadVideo src={staticFile(videoFile)} muted style={{ width: CW, height: CH, display: "block" }} />
								</Sequence>
							</div>

							{sp && spot.alpha > 0.01 && (
								<div style={{
									position: "absolute", left: sp.x, top: sp.y, width: sp.w, height: sp.h, borderRadius: 16, pointerEvents: "none",
									boxShadow: `0 0 0 3000px rgba(3,6,14,${0.5 * spot.alpha}), 0 0 0 2px ${accent}${Math.round(spot.alpha * 160).toString(16).padStart(2, "0")}, 0 0 40px ${accent}${Math.round(spot.alpha * 90).toString(16).padStart(2, "0")}`,
								}} />
							)}

							{clicksAt(tl, t).map((cl, i) => {
								const p = clamp01((t - cl.t) / 0.65), pt = toWin(cl.x, cl.y);
								const sz = 120 * (0.15 + 0.85 * Easing.out(Easing.cubic)(p));
								return <div key={i} style={{ position: "absolute", left: pt.x - sz / 2, top: pt.y - sz / 2, width: sz, height: sz, borderRadius: "50%", border: `4px solid ${accent}`, background: `${accent}22`, opacity: 1 - p }} />;
							})}

							<svg width="34" height="40" viewBox="0 0 24 28" style={{
								position: "absolute", left: c.x - 4, top: c.y - 3, overflow: "visible", transformOrigin: "4px 3px",
								transform: `scale(${pressedAt(tl, t) ? 0.82 : 1})`, filter: "drop-shadow(0 3px 5px rgba(0,0,0,.5))",
							}}>
								<path d="M4 3 L4 23 L9.2 18.4 L12.6 26 L16 24.5 L12.7 17.2 L19.6 17 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
							</svg>
						</div>
					</div>
				</AbsoluteFill>
			)}

			{captionSpans(tl).map((s, i) => (
				<Caption key={i} text={s.text} accent={accent} theme={theme} start={vs + Math.round((s.t0 + 0.05) * fps)} end={vs + Math.round(s.t1 * fps)} />
			))}

			{tl.outro && <TitleCard title={tl.outro.title} subtitle={tl.outro.subtitle} accent={accent} theme={theme} start={ve - Math.round(0.3 * fps)} />}
		</AbsoluteFill>
	);
};
