import AudioIcon from "@icons/Audio";
import AutoAwesomeIcon from "@icons/svg/AutoAwesome.svg";
import InsertPhotoOutlinedIcon from "@icons/svg/InsertPhotoOutlined.svg";
import MovieIcon from "@icons/svg/Movie.svg";
import MovieFilterIcon from "@icons/svg/MovieFilter.svg";
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
