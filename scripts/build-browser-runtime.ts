const { readFileSync, writeFileSync, readdirSync } =
	require("node:fs") as typeof import("node:fs");
const { join, relative, sep } =
	require("node:path") as typeof import("node:path");
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

const production = process.argv.includes("--production");
let buildId = "development";
let precacheAssets: string[] = [];
if (production) {
	buildId = readFileSync(join(rootDirectory, ".next/BUILD_ID"), "utf8").trim();
	const staticDirectory = join(rootDirectory, ".next/static");
	const walk = (directory: string): string[] =>
		readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
			const file = join(directory, entry.name);
			return entry.isDirectory()
				? walk(file)
				: /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|avif)$/.test(
							entry.name,
						)
					? [file]
					: [];
		});
	precacheAssets = walk(staticDirectory)
		.map(
			(file) =>
				`/_next/static/${relative(staticDirectory, file).split(sep).join("/")}`,
		)
		.sort();
}

let hasErrors = false;
for (const entry of runtimeEntries) {
	const sourcePath = join(rootDirectory, entry.source);
	const outputPath = join(rootDirectory, entry.output);
	const result = ts.transpileModule(
		readFileSync(sourcePath, "utf8")
			.replace(
				JSON.stringify("__SYSTEMCONCEPTS_BUILD_ID__"),
				JSON.stringify(buildId),
			)
			.replace(
				`[${JSON.stringify("__SYSTEMCONCEPTS_PRECACHE_ASSETS__")}]`,
				JSON.stringify(precacheAssets),
			),
		{
			fileName: sourcePath,
			reportDiagnostics: true,
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ES2022,
				ignoreDeprecations: "6.0",
			},
		},
	);
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
