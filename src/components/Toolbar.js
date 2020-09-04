import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import { MainStore } from "@/components/Main";
import { useTranslations } from "@/util/translations";
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';

export default function Toolbar() {
    const { fullscreen } = MainStore.useState();
    const translations = useTranslations();

    const toggleFullscreen = () => {
        MainStore.update(s => {
            s.fullscreen = !s.fullscreen;
        });
    };

    return <>
        <Tooltip arrow title={fullscreen ? translations.EXIT_FULLSCREEN : translations.FULLSCREEN}>
            <IconButton onClick={toggleFullscreen}>
                {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
        </Tooltip>
    </>;
}
