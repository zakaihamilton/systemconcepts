import { cleanup, render, waitFor } from "@testing-library/react";
import ServiceWorker from "./ServiceWorker";

describe("ServiceWorker", () => {
	const originalEnv = process.env.NODE_ENV;

	afterEach(() => {
		cleanup();
		Object.defineProperty(process.env, "NODE_ENV", { value: originalEnv });
		Reflect.deleteProperty(navigator, "serviceWorker");
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

	it("waits for window load before registering when the document is still loading", async () => {
		const register = jest.fn().mockResolvedValue({});
		Object.defineProperty(process.env, "NODE_ENV", { value: "production" });
		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: { register },
		});
		Object.defineProperty(document, "readyState", {
			configurable: true,
			get: () => "loading",
		});

		try {
			render(<ServiceWorker />);
			expect(register).not.toHaveBeenCalled();
			window.dispatchEvent(new Event("load"));
			await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
		} finally {
			Reflect.deleteProperty(document, "readyState");
		}
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
