const nextJest = require("next/jest");

const createJestConfig = nextJest({
	// Provide the path to your Next.js app to load next.config.js and .env files in your test environment
	dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
	testEnvironment: "jest-environment-jsdom",
	moduleNameMapper: {
		"^@components/(.*)$": "<rootDir>/src/components/$1",
		"^@widgets/(.*)$": "<rootDir>/src/components/Widgets/$1",
		"^@icons/(.*)$": "<rootDir>/src/components/Icons/$1",
		"^@util/(.*)$": "<rootDir>/src/util/$1",
		"^@data/(.*)$": "<rootDir>/src/data/$1",
		"^@views/(.*)$": "<rootDir>/src/views/$1",
		"^@storage/(.*)$": "<rootDir>/src/storage/$1",
		"^@diagrams/(.*)$": "<rootDir>/src/diagrams/$1",
		"^@sync/(.*)$": "<rootDir>/src/sync/$1",
	},
	transformIgnorePatterns: [
		"/node_modules/(?!(p-limit|yocto-queue|react-markdown|remark-breaks|vfile|vfile-message|unist-util-.*|unified|bail|is-plain-obj|trough|decode-named-character-reference|character-entities|mdast-util-.*|micromark.*|property-information|hast-util-.*|space-separated-tokens|comma-separated-tokens|style-to-object|inline-style-parser|devlop)/)",
	],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
