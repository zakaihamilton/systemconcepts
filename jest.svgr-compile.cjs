const { transform } = require("@svgr/core");
const babel = require("@babel/core");
const fs = require("node:fs");
const svgrConfig = require("./src/components/Icons/svgr.config.js");
const svgrTemplate = require("./src/components/Icons/svgr-template.js");

async function main() {
	const sourcePath = process.argv[2];
	const sourceText = fs.readFileSync(sourcePath, "utf8");
	const jsxCode = await transform(
		sourceText,
		{
			...svgrConfig,
			template: svgrTemplate,
			plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
			filename: sourcePath,
		},
		{ filePath: sourcePath, caller: { name: "jest" } },
	);
	const { code } = babel.transformSync(jsxCode, {
		filename: sourcePath.replace(/\.svg$/, ".js"),
		presets: [["next/babel", { "preset-react": { runtime: "automatic" } }]],
	});

	process.stdout.write(code);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
