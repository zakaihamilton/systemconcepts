import { registerToolbar, useToolbar } from "@components/Toolbar";
import GetAppIcon from "@mui/icons-material/GetApp";
import { useTranslations } from "@util/translations";

registerToolbar("Download");

export default function Download({ onClick, visible, target }) {
    const translations = useTranslations();

    const toolbarItems = [
        visible && {
            id: "download",
            name: translations.DOWNLOAD,
            icon: <GetAppIcon />,
            location: "header",
            onClick,
            target
        }
    ].filter(Boolean);

    useToolbar({ id: "Download", items: toolbarItems, depends: [visible, translations] });
    return null;
}
