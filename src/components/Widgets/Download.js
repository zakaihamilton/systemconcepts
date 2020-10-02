import { registerToolbar, useToolbar } from "@/components/Toolbar";
import GetAppIcon from '@material-ui/icons/GetApp';
import { useTranslations } from "@/util/translations";

registerToolbar("Download");

export default function Download({ onClick, loading }) {
    const translations = useTranslations();

    const menuItems = [
        !loading && {
            id: "download",
            name: translations.DOWNLOAD,
            icon: <GetAppIcon />,
            onClick
        }
    ].filter(Boolean);

    useToolbar({ id: "Download", items: menuItems, depends: [loading, translations] });
    return null;
}
