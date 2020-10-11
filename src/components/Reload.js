import { MainStore } from "@/components/Main";
import { useTranslations } from "@/util/translations";
import ReplayIcon from '@material-ui/icons/Replay';
import { registerToolbar, useToolbar } from "@/components/Toolbar";

registerToolbar("Reload");

export default function Reload() {
    const translations = useTranslations();

    const reload = () => {
        location.reload();
    };

    const menuItems = [
        {
            id: "reload",
            name: translations.RELOAD,
            icon: <ReplayIcon />,
            onClick: reload
        }
    ].filter(Boolean);

    useToolbar({ id: "Reload", items: menuItems, depends: [translations] });
    return null;
}
