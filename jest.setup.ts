import "@testing-library/jest-dom";

jest.mock("p-limit", () => {
	return (_concurrency: number) =>
		async <Result>(fn: () => Result): Promise<Result> =>
			await fn();
});
