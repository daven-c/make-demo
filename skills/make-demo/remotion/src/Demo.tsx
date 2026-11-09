import { AbsoluteFill } from "remotion";
import type { DemoProps } from "./model";
import { Device } from "./presets/device";

// Add a preset by exporting a component with these props and registering it here.
export type PresetProps = Omit<DemoProps, "preset" | "fps">;
const presets: Record<string, React.FC<PresetProps>> = { device: Device };

export const Demo: React.FC<DemoProps> = ({ preset, ...props }) => {
	const Preset = presets[preset];
	if (!Preset) throw new Error(`unknown preset "${preset}"; available: ${Object.keys(presets).join(", ")}`);
	return (
		<AbsoluteFill>
			<Preset {...props} />
		</AbsoluteFill>
	);
};
