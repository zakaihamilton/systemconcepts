const { readFileSync, writeFileSync } =
	require("node:fs") as typeof import("node:fs");
const { join } = require("node:path") as typeof import("node:path");
const ts = require("typescript") as typeof import("typescript");

const rootDirectory = process.cwd();
const runtimeEntries = [
	{
		source: "src/browser-runtime/noflash.ts",
		output: "public/noflash.js",
	},
	{
		source: "src/browser-runtime/service-worker.ts",
		output: "public/sw.js",
	},
];

let hasErrors = false;
for (const entry of runtimeEntries) {
	const sourcePath = join(rootDirectory, entry.source);
	const outputPath = join(rootDirectory, entry.output);
	const result = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
		fileName: sourcePath,
		reportDiagnostics: true,
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
			ignoreDeprecations: "6.0",
		},
	});
	const errors = (result.diagnostics ?? []).filter(
		(diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
	);
	if (errors.length > 0) {
		hasErrors = true;
		for (const error of errors) {
			console.error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
		}
		continue;
	}
	writeFileSync(outputPath, result.outputText);
}

if (hasErrors) process.exitCode = 1;
