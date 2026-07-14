#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const muiIconsDir = path.join(root, "node_modules/@mui/icons-material");
const outDir = path.join(root, "src/components/Icons");

function collectIconNames() {
	const names = new Set();
	const srcDir = path.join(root, "src");
	const dataDir = path.join(root, "data");

	function walk(dir) {
		if (!fs.existsSync(dir)) return;
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (/\.(js|jsx)$/.test(entry.name)) {
				const content = fs.readFileSync(full, "utf8");
				const singleImport = /from ["']@icons\/(\w+)["']/g;
				let match;
				while ((match = singleImport.exec(content)) !== null) {
					names.add(match[1]);
				}
				const barrelImport = /import\s*\{([^}]+)\}\s*from\s*["']@icons["']/g;
				while ((match = barrelImport.exec(content)) !== null) {
					for (const part of match[1].split(",")) {
						const iconName = part
							.trim()
							.replace(/\s+as\s+\w+$/, "")
							.trim();
						if (iconName) names.add(iconName);
					}
				}
			}
		}
	}

	walk(srcDir);
	walk(dataDir);
	return [...names].sort();
}

function extractPaths(iconFile) {
	const content = fs.readFileSync(iconFile, "utf8");
	const paths = [];
	const pathRe = /d:\s*"([^"]+)"/g;
	let match;
	while ((match = pathRe.exec(content)) !== null) {
		paths.push(match[1]);
	}
	return paths;
}

function generateIconComponent(name, paths) {
	const children = paths
		.map((p) => {
			if (p.startsWith("<circle")) {
				return `\t\t\t${p.replace("/>", " />")}`;
			}
			return `\t\t\t<path d="${p}" />`;
		})
		.join("\n");

	return `import { createIcon } from "@ui/Icon";

const ${name} = createIcon(
\t<>
${children}
\t</>,
\t"${name}",
);

export default ${name};
`;
}

function main() {
	const iconNames = collectIconNames();
	console.log(`Found ${iconNames.length} unique icons`);

	const exports = [];

	for (const name of iconNames) {
		const iconFile = path.join(muiIconsDir, `${name}.js`);
		if (!fs.existsSync(iconFile)) {
			console.warn(`Warning: icon file not found: ${name}`);
			continue;
		}

		const paths = extractPaths(iconFile);
		if (paths.length === 0) {
			console.warn(`Warning: no paths found for ${name}`);
			continue;
		}

		const dir = path.join(outDir, name);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(
			path.join(dir, "index.js"),
			generateIconComponent(name, paths),
		);
		exports.push(`export { default as ${name} } from "./${name}";`);
	}

	// Keep custom Audio icon separate - will be updated manually
	exports.push(`export { default as Audio } from "./Audio";`);

	fs.writeFileSync(path.join(outDir, "index.js"), `${exports.join("\n")}\n`);
	console.log(`Generated ${exports.length - 1} icons`);
}

main();
