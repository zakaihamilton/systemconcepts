const { execFileSync } = require("node:child_process");
const path = require("node:path");

module.exports = {
	process(_sourceText, sourcePath) {
		const code = execFileSync(
			process.execPath,
			[path.join(__dirname, "jest.svgr-compile.cjs"), sourcePath],
			{ encoding: "utf8" },
		);

		return { code };
	},
};
