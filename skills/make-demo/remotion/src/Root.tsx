import { Composition } from "remotion";
import type { DemoProps, Timeline } from "./model";
import { Demo } from "./Demo";

const placeholder: Timeline = {
	size: { width: 1280, height: 720 }, fps: 60, duration: 10, accent: "#14b8a6",
	intro: { title: "Demo" }, outro: { title: "Demo" }, start: { x: 640, y: 520 }, events: [],
};

// Output frame; presets lay everything out for 1920x1080.
export const SIZE = { width: 1920, height: 1080 };
// Pacing of the intro and outro, in seconds (frames derive from the chosen fps).
export const INTRO = 2.0, OUTRO = 2.4;

export const Root = () => (
	<Composition
		id="Demo"
		component={Demo}
		width={SIZE.width}
		height={SIZE.height}
		fps={60}
		durationInFrames={600}
		defaultProps={{ timeline: placeholder, videoFile: "raw.mp4", preset: "device", fps: 60, theme: "auto" } satisfies DemoProps}
		calculateMetadata={({ props }) => {
			const p = props as DemoProps;
			const fps = p.fps || 60;
			const intro = p.timeline.intro ? INTRO : 0.4, outro = p.timeline.outro ? OUTRO : 0.4;
			return { fps, durationInFrames: Math.ceil((intro + p.timeline.duration + outro) * fps) };
		}}
	/>
);
