import { Store } from "pullstate";
import { useTranslations } from "@/util/translations";
import AudiotrackIcon from '@material-ui/icons/Audiotrack';
import { registerToolbar, useToolbar } from "@/components/Toolbar";

export const AudioStore = new Store({
    path: "",
    hash: "",
    loaded: false
});

registerToolbar("Audio");

export default function AudioWidget() {
    const translations = useTranslations();
    const { hash } = AudioStore.useState();

    const gotoAudio = () => {
        let hashPath = hash;
        if (hashPath.startsWith("#")) {
            hashPath = hashPath.substring(1);
        }
        window.location.hash = hashPath;
    };

    const menuItems = [
        hash && {
            id: "audio",
            name: translations.AUDIO_PLAYER,
            icon: <AudiotrackIcon />,
            onClick: gotoAudio
        }
    ].filter(Boolean);

    useToolbar({ id: "Audio", items: menuItems, depends: [hash] });
    return null;
}
