module.exports = {
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
};
