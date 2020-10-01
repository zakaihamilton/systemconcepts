import { MainStore } from "@/components/Main";
import { useTranslations } from "@/util/translations";
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';
import { registerToolbar, useToolbar } from "@/components/Toolbar";

registerToolbar("Fullscreen");

export default function Fullscreen() {
    const { fullscreen } = MainStore.useState();
    const translations = useTranslations();

    const toggleFullscreen = () => {
        MainStore.update(s => {
            s.fullscreen = !s.fullscreen;
        });
    };

    const menuItems = [
        {
            id: "fullscreen",
            name: fullscreen ? translations.EXIT_FULLSCREEN : translations.FULLSCREEN,
            icon: fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />,
            onClick: toggleFullscreen
        }
    ].filter(Boolean);

    useToolbar({ id: "Fullscreen", items: menuItems, depends: [translations, fullscreen] });
    return null;
}
