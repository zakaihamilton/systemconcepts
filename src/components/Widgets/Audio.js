import { Store } from "pullstate";
import styles from "./Audio.module.scss";
import { useTranslations } from "@/util/translations";
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import { registerToolbar, useToolbar } from "@/components/Toolbar";

export const AudioStore = new Store({
    path: ""
});

registerToolbar("Audio");

export default function AudioWidget() {
    const translations = useTranslations();

    const showAudioPopup = () => {

    };

    const menuItems = [
        {
            id: "audio",
            name: translations.AUDIO_PLAYER,
            icon: <AudiotrackIcon />,
            onClick: showAudioPopup
        }
    ].filter(Boolean);

    useToolbar({ id: "Audio", items: menuItems, depends: [] });
    return null;
}
