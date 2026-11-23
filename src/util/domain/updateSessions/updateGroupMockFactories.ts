export function storageMockFactory() {
	return {
		createFolderPath: jest.fn(),
		deleteFile: jest.fn(),
		exists: jest.fn(),
		readFile: jest.fn(),
		writeFile: jest.fn(),
	};
}
