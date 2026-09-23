const { transform } = require("@svgr/core") as typeof import("@svgr/core");
const babelCore = require("@babel/core") as typeof import("@babel/core");
const fs = require("node:fs") as typeof import("node:fs");

async function compileSvgMain() {
	const sourcePath = process.argv[2];
	if (!sourcePath) throw new Error("An SVG source path is required.");
	const [{ default: svgrConfig }, { default: svgrTemplate }] =
		await Promise.all([
			import("./src/components/Icons/svgr.config.ts"),
			import("./src/components/Icons/svgr-template.ts"),
		]);
	const sourceText = fs.readFileSync(sourcePath, "utf8");
	const jsxCode = await transform(
		sourceText,
		{
			...svgrConfig,
			template: svgrTemplate,
			plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
		},
		{ filePath: sourcePath, caller: { name: "jest" } },
	);
	const transformed = babelCore.transformSync(jsxCode, {
		filename: sourcePath.replace(/\.svg$/, ".js"),
		presets: [["next/babel", { "preset-react": { runtime: "automatic" } }]],
	});
	if (!transformed?.code) throw new Error("Babel did not generate code.");

	process.stdout.write(transformed.code);
}

compileSvgMain().catch((error) => {
	console.error(error);
	process.exit(1);
});
