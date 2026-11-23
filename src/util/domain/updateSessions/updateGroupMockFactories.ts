function createBundleMock() {
	return { writeCompressedFile: jest.fn() };
}

function createHashMock() {
	return { getFileInfo: jest.fn() };
}

function createManifestMock() {
	return { updateManifestEntry: jest.fn() };
}

function createLoggerMock() {
	return {
		logger: {
			debug: jest.fn(),
			error: jest.fn(),
			info: jest.fn(),
			warn: jest.fn(),
		},
	};
}

function createGroupStorageMock() {
	return {
		createFolderPath: jest.fn(),
		deleteFile: jest.fn(),
		exists: jest.fn(),
		readFile: jest.fn(),
		writeFile: jest.fn(),
	};
}

function createUtilsStorageMock() {
	return {
		exists: jest.fn(),
		getListing: jest.fn(),
		readFile: jest.fn(),
		writeFile: jest.fn(),
		deleteFile: jest.fn(),
		createFolderPath: jest.fn(),
		rename: jest.fn(),
	};
}

export const updateGroupMockFactories = {
	groupBundle: createBundleMock,
	utilsBundle: createBundleMock,
	groupHash: createHashMock,
	utilsHash: createHashMock,
	groupManifest: createManifestMock,
	utilsManifest: createManifestMock,
	groupLogger: createLoggerMock,
	utilsLogger: createLoggerMock,
	groupStorage: createGroupStorageMock,
	utilsStorage: createUtilsStorageMock,
};