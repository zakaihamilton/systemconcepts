import type { Config } from "@svgr/core";

const svgrConfig: Config = {
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
			{ name: "removeDimensions" },
		],
	},
	svgProps: {
		fill: "currentColor",
	},
};

export default svgrConfig;
