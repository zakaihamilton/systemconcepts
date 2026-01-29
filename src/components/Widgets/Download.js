import { registerToolbar, useToolbar } from "@components/Toolbar";
import GetAppIcon from "@mui/icons-material/GetApp";
import { useTranslations } from "@util/translations";

registerToolbar("Download");

export default function Download({ onClick, visible, target, title }) {
    const translations = useTranslations();
    const name = title || translations.DOWNLOAD;

    const toolbarItems = [
        visible && {
            id: "download",
            name,
            icon: <GetAppIcon />,
            location: "header",
            onClick,
            target
        }
    ].filter(Boolean);

    useToolbar({ id: "Download", items: toolbarItems, depends: [visible, translations, name] });
    return null;
}
