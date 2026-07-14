import AccountTreeIcon from "@icons/svg/AccountTree.svg";
import TableChartIcon from "@icons/svg/TableChart.svg";
import ViewComfyIcon from "@icons/svg/ViewComfy.svg";
import ViewListIcon from "@icons/svg/ViewList.svg";
import { SessionsStore } from "@util/domain/sessions";
export function getSessionsSection({ translations }) {
	const { viewMode } = SessionsStore.getRawState();
	let description = "";
	let Icon = null;
	if (viewMode === "list") {
		description = translations.LIST_VIEW;
		Icon = ViewListIcon;
	} else if (viewMode === "table") {
		description = translations.TABLE_VIEW;
		Icon = TableChartIcon;
	} else if (viewMode === "grid") {
		description = translations.GRID_VIEW;
		Icon = ViewComfyIcon;
	} else if (viewMode === "tree") {
		description = translations.TREE_VIEW;
		Icon = AccountTreeIcon;
	}
	const menuItems = [
		{
			name: translations.LIST_VIEW,
			icon: <ViewListIcon />,
			onClick: () => {
				SessionsStore.update((s) => {
					s.viewMode = "list";
				});
			},
		},
		{
			name: translations.TABLE_VIEW,
			icon: <TableChartIcon />,
			onClick: () => {
				SessionsStore.update((s) => {
					s.viewMode = "table";
				});
			},
		},
		{
			name: translations.GRID_VIEW,
			icon: <ViewComfyIcon />,
			onClick: () => {
				SessionsStore.update((s) => {
					s.viewMode = "grid";
				});
			},
		},
		{
			name: translations.TREE_VIEW,
			icon: <AccountTreeIcon />,
			onClick: () => {
				SessionsStore.update((s) => {
					s.viewMode = "tree";
				});
			},
		},
	];
	return { description, menuItems, ...(Icon && { Icon }) };
}
