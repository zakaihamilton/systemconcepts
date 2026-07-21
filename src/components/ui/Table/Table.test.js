import { fireEvent, render, screen } from "@testing-library/react";
import Table, {
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TableSortLabel,
} from "./Table";

describe("ui Table primitives", () => {
	it("renders container, head, body, rows, and cells", () => {
		render(
			<TableContainer className="wrap" data-testid="wrap">
				<Table className="tbl" classes={{ root: "root-cls" }} stickyHeader>
					<TableHead className="head">
						<TableRow selected>
							<TableCell align="center" stickyHeader>
								H1
							</TableCell>
							<TableCell align="right" padding="none" classes={{ root: "c" }}>
								H2
							</TableCell>
							<TableCell component="th">H3</TableCell>
						</TableRow>
					</TableHead>
					<TableBody className="body">
						<TableRow className="r" style={{ color: "red" }}>
							<TableCell>A</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</TableContainer>,
		);

		expect(screen.getByTestId("wrap")).toHaveClass("wrap");
		expect(screen.getByText("H1")).toBeInTheDocument();
		expect(screen.getByText("A")).toBeInTheDocument();
		expect(screen.getByText("H3").tagName).toBe("TH");
	});

	it("TableSortLabel toggles active directions", () => {
		const onClick = jest.fn();
		const { rerender } = render(
			<TableSortLabel active direction="asc" onClick={onClick}>
				Name
			</TableSortLabel>,
		);
		expect(screen.getByText("↑")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button"));
		expect(onClick).toHaveBeenCalled();

		rerender(
			<TableSortLabel active direction="desc" className="sort">
				Name
			</TableSortLabel>,
		);
		expect(screen.getByText("↓")).toBeInTheDocument();

		rerender(<TableSortLabel>Name</TableSortLabel>);
		expect(screen.queryByText("↑")).not.toBeInTheDocument();
	});

	it("renders the default table export", () => {
		render(
			<Table data-testid="table">
				<tbody>
					<tr>
						<td>Cell</td>
					</tr>
				</tbody>
			</Table>,
		);
		expect(screen.getByTestId("table")).toBeInTheDocument();
	});
});
