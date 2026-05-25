import AudioIcon from "@components/Icons/Audio";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import InsertPhotoOutlinedIcon from "@mui/icons-material/InsertPhotoOutlined";
import MovieIcon from "@mui/icons-material/Movie";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";

import { useTranslations } from "@util/domain/translations";
import Tooltip from "@widgets/Tooltip";

export default function SessionIcon({ type }) {
	const translations = useTranslations();
	const title = translations[type?.toUpperCase()] || "";
	return type ? (
		<Tooltip title={title}>
			<span>
				{type === "video" && <MovieIcon />}
				{type === "audio" && <AudioIcon />}
				{type === "image" && <InsertPhotoOutlinedIcon />}
				{type === "overview" && <MovieFilterIcon />}
				{type === "ai" && <AutoAwesomeIcon />}
			</span>
		</Tooltip>
	) : null;
}
