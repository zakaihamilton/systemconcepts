import "@testing-library/jest-dom";

interface UntypedMock extends jest.Mock<any, any[]> {
	mockResolvedValue(value?: unknown): this;
	mockRejectedValue(value?: unknown): this;
}

declare global {
	function asMock<T>(fn: T): UntypedMock;
}

globalThis.asMock = <T>(fn: T) => fn as unknown as UntypedMock;

jest.mock("p-limit", () => {
	return (_concurrency: number) =>
		async <Result>(fn: () => Result): Promise<Result> =>
			await fn();
});
