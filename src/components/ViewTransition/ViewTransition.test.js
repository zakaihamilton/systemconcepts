import { render } from "@testing-library/react";
import ViewTransition from "./ViewTransition";
import styles from "./ViewTransition.module.css";

describe("ViewTransition", () => {
	it("adds the enter animation class", () => {
		const { getByTestId } = render(
			<ViewTransition transitionKey="home">
				<div>Home</div>
			</ViewTransition>,
		);

		expect(getByTestId("view-transition")).toHaveClass(styles.root);
	});

	it("keeps its boundary mounted when the view key changes", () => {
		const { getByTestId, rerender } = render(
			<ViewTransition transitionKey="home">
				<div>Home</div>
			</ViewTransition>,
		);
		const previousBoundary = getByTestId("view-transition");

		rerender(
			<ViewTransition transitionKey="settings">
				<div>Settings</div>
			</ViewTransition>,
		);

		expect(getByTestId("view-transition")).toBe(previousBoundary);
		expect(getByTestId("view-transition")).toHaveAttribute(
			"data-transition-key",
			"settings",
		);
	});

	it("does not replace its boundary for unchanged view keys", () => {
		const { getByTestId, rerender } = render(
			<ViewTransition transitionKey="home">
				<div>Loading</div>
			</ViewTransition>,
		);
		const previousBoundary = getByTestId("view-transition");

		rerender(
			<ViewTransition transitionKey="home">
				<div>Loaded</div>
			</ViewTransition>,
		);

		expect(getByTestId("view-transition")).toBe(previousBoundary);
		expect(getByTestId("view-transition")).toHaveAttribute(
			"data-transition-key",
			"home",
		);
	});
});
