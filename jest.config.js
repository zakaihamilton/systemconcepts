const nextJest = require("next/jest");

const createJestConfig = nextJest({
	dir: "./",
});

const customJestConfig = {
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
	testEnvironment: "jest-environment-jsdom",
	testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
	moduleNameMapper: {
		"^@icons/svg/(.*)$": "<rootDir>/src/components/Icons/svg/$1",
		"^@components/(.*)$": "<rootDir>/src/components/$1",
		"^@ui$": "<rootDir>/src/components/ui/index.js",
		"^@ui/(.*)$": "<rootDir>/src/components/ui/$1",
		"^@widgets/(.*)$": "<rootDir>/src/components/Widgets/$1",
		"^@icons/Audio$": "<rootDir>/src/components/Icons/Audio.js",
		"^@util/(.*)$": "<rootDir>/src/util/$1",
		"^@data/(.*)$": "<rootDir>/src/data/$1",
		"^@views/(.*)$": "<rootDir>/src/views/$1",
		"^@storage/(.*)$": "<rootDir>/src/storage/$1",
		"^@diagrams/(.*)$": "<rootDir>/src/diagrams/$1",
		"^@sync/(.*)$": "<rootDir>/src/sync/$1",
	},
	transform: {
		"^.+\\.svg$": "<rootDir>/jest.svgr-transformer.js",
	},
	transformIgnorePatterns: [
		"/node_modules/(?!(p-limit|yocto-queue|react-markdown|remark-breaks|vfile|vfile-message|unist-util-.*|unified|bail|is-plain-obj|trough|decode-named-character-reference|character-entities|mdast-util-.*|micromark.*|property-information|hast-util-.*|space-separated-tokens|comma-separated-tokens|style-to-object|inline-style-parser|devlop)/)",
	],
};

module.exports = async () => {
	const jestConfig = await createJestConfig(customJestConfig)();
	const svgMockPattern = "^.+\\.(svg)$";

	if (Array.isArray(jestConfig.moduleNameMapper)) {
		jestConfig.moduleNameMapper = jestConfig.moduleNameMapper.filter(
			([pattern]) => pattern !== svgMockPattern,
		);
	} else {
		delete jestConfig.moduleNameMapper[svgMockPattern];
	}

	return jestConfig;
};
