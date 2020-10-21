import { registerToolbar, useToolbar } from "@/components/Toolbar";
import GetAppIcon from '@material-ui/icons/GetApp';
import { useTranslations } from "@/util/translations";

registerToolbar("Download");

export default function Download({ onClick, visible }) {
    const translations = useTranslations();

    const toolbarItems = [
        visible && {
            id: "download",
            name: translations.DOWNLOAD,
            icon: <GetAppIcon />,
            location: "header",
            onClick
        }
    ].filter(Boolean);

    useToolbar({ id: "Download", items: toolbarItems, depends: [visible, translations] });
    return null;
}
