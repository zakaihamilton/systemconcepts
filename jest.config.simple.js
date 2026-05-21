module.exports = {
	testEnvironment: "jsdom",
	transform: {
		"^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", { presets: ["next/babel"] }],
	},
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
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
