import { cleanup, render, waitFor } from "@testing-library/react";
import ServiceWorker from "./ServiceWorker";

describe("ServiceWorker", () => {
	const originalEnv = process.env.NODE_ENV;

	afterEach(() => {
		cleanup();
		Object.defineProperty(process.env, "NODE_ENV", { value: originalEnv });
		delete navigator.serviceWorker;
	});

	it("registers the native worker in production", async () => {
		const register = jest.fn().mockResolvedValue({});
		Object.defineProperty(process.env, "NODE_ENV", { value: "production" });
		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: { register },
		});

		render(<ServiceWorker />);
		await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
	});

	it("does not register during development", () => {
		const register = jest.fn();
		Object.defineProperty(process.env, "NODE_ENV", { value: "development" });
		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: { register },
		});

		render(<ServiceWorker />);
		expect(register).not.toHaveBeenCalled();
	});
});
