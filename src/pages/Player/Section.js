import MovieIcon from '@material-ui/icons/Movie';
import AudioIcon from "@icons/Audio";

export function getPlayerSection({ suffix, icon, name, translations }) {
    if (suffix === ".m4a") {
        name = translations.AUDIO;
        icon = <AudioIcon />;
    }
    else if (suffix === ".mp4") {
        name = translations.VIDEO;
        icon = <MovieIcon />;
    }
    return { name, icon };
}