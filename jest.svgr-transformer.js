const { execFileSync } = require("node:child_process");
const path = require("node:path");

const compilerPath = path.join(__dirname, "jest.svgr-compile.cjs");

module.exports = {
	process(_sourceText, sourcePath) {
		const code = execFileSync(
			process.execPath,
			[compilerPath, sourcePath],
			{ encoding: "utf8" },
		);

		return { code };
	},
};
