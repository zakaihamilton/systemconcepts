import "@testing-library/jest-dom";

jest.mock("p-limit", () => (concurrency) => async (fn) => await fn());
