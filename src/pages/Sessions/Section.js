import { SessionsStore } from "@util/sessions";
import ViewListIcon from "@mui/icons-material/ViewList";
import TableChartIcon from "@mui/icons-material/TableChart";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";

export function getSessionsSection({ translations }) {
    const { viewMode } = SessionsStore.getRawState();
    let description = "";
    let Icon = null;
    if (viewMode === "list") {
        description = translations.LIST_VIEW;
        Icon = ViewListIcon;
    }
    else if (viewMode === "table") {
        description = translations.TABLE_VIEW;
        Icon = TableChartIcon;
    }
    else if (viewMode === "grid") {
        description = translations.GRID_VIEW;
        Icon = ViewComfyIcon;
    }
    const menuItems = [
        {
            name: translations.LIST_VIEW,
            icon: <ViewListIcon />,
            onClick: () => {
                SessionsStore.update(s => { s.viewMode = "list"; });
            }
        },
        {
            name: translations.TABLE_VIEW,
            icon: <TableChartIcon />,
            onClick: () => {
                SessionsStore.update(s => { s.viewMode = "table"; });
            }
        },
        {
            name: translations.GRID_VIEW,
            icon: <ViewComfyIcon />,
            onClick: () => {
                SessionsStore.update(s => { s.viewMode = "grid"; });
            }
        }
    ];
    return { description, menuItems, ...Icon && { Icon } };
}
