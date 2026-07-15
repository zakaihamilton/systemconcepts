import Tab from "@components/Widgets/Tabs/Tab";
import AudioIcon from "@icons/Audio";
import DescriptionIcon from "@icons/svg/Description.svg";
import ImageIcon from "@icons/svg/Image.svg";
import InfoIcon from "@icons/svg/Info.svg";
import MovieIcon from "@icons/svg/Movie.svg";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import { toPath, useParentParams, usePathItems } from "@util/domain/views";
import styles from "./Tabs.module.css";
export default function Tabs({ Container }) {
	const translations = useTranslations();
	const items = usePathItems();
	const baseIndex = items.findIndex((path) => {
		const [id] = path.split("?");
		return id === "session";
	});
	const parentIndex = items.length - baseIndex - 2;
	const params = useParentParams(parentIndex) || {};
	const [sessions] = useSessions([], { filterSessions: false, active: false });

	const { group, year, date, name } = params;

	const session =
		(sessions &&
			sessions.find(
				(session) =>
					session.group === group &&
					session.name === name &&
					session.date === date &&
					session.year === year,
			)) ||
		{};

	const basePath = "#" + toPath(...items.slice(0, baseIndex + 1));
	const hasTranscript =
		session.subtitles ||
		session.transcription ||
		session.transcriptPath ||
		(session.files || []).some(
			(file) => file.endsWith(".txt") || file.endsWith(".vtt"),
		);

	const tabs = [
		{
			label: translations.DETAILS,
			icon: <InfoIcon />,
			value: basePath,
		},
		session.audio && {
			label: translations.AUDIO,
			icon: <AudioIcon />,
			value: basePath + "/" + encodeURIComponent("player?suffix=.m4a"),
		},
		session.video && {
			label: translations.VIDEO,
			icon: <MovieIcon />,
			value: basePath + "/" + encodeURIComponent("player?suffix=.mp4"),
		},
		session.thumbnail && {
			label: session.video ? translations.THUMBNAIL : translations.IMAGE,
			icon: <ImageIcon />,
			value: basePath + "/" + encodeURIComponent("image"),
		},
		hasTranscript && {
			label: translations.TRANSCRIPT,
			icon: <DescriptionIcon />,
			value:
				basePath +
				"/" +
				encodeURIComponent(
					"player?suffix=" +
						(session.audio ? ".m4a" : ".mp4") +
						"&mode=transcript",
				),
		},
	]
		.filter(Boolean)
		.map((item) => {
			return <Tab key={item.label} {...item} />;
		});

	return <Container className={styles.root}>{tabs}</Container>;
}
