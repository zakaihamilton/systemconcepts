import MovieIcon from "@mui/icons-material/Movie";
import AudioIcon from "@components/Icons/Audio";
import InsertPhotoOutlinedIcon from "@mui/icons-material/InsertPhotoOutlined";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "@util/translations";

export default function SessionIcon({ type }) {
    const translations = useTranslations();
    const title = translations[type?.toUpperCase()] || "";
    return type ? <Tooltip title={title}>
        <span>
            {type === "video" && <MovieIcon />}
            {type === "audio" && <AudioIcon />}
            {type === "image" && <InsertPhotoOutlinedIcon />}
            {type === "overview" && <MovieFilterIcon />}
            {type === "ai" && <AutoAwesomeIcon />}
        </span>
    </Tooltip> : null;
}
