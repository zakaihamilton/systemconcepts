import type { Config } from "@svgr/core";

const svgrConfig = {
	ref: true,
	svgoConfig: {
		plugins: [
			{
				name: "preset-default",
				params: {
					overrides: {
						removeViewBox: false,
					},
				},
			},
			"removeDimensions",
		],
	},
	svgProps: {
		fill: "currentColor",
	},
} satisfies Config;

export default svgrConfig;
