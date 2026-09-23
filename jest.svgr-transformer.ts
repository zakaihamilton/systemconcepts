const { execFileSync } =
	require("node:child_process") as typeof import("node:child_process");
const path = require("node:path") as typeof import("node:path");

const compilerPath = path.join(__dirname, "jest.svgr-compile.ts");

const svgTransformer: {
	process(sourceText: string, sourcePath: string): { code: string };
} = {
	process(_sourceText, sourcePath) {
		const code = execFileSync(
			process.execPath,
			["--experimental-strip-types", compilerPath, sourcePath],
			{ encoding: "utf8" },
		);

		return { code };
	},
};

module.exports = svgTransformer;
