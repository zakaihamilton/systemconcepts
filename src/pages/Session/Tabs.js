import { useTranslations } from "@util/translations";
import { usePathItems, useParentParams, toPath } from "@util/pages";
import { useSessions } from "@util/sessions";
import MovieIcon from "@mui/icons-material/Movie";
import AudioIcon from "@icons/Audio";
import InfoIcon from "@mui/icons-material/Info";
import ImageIcon from "@mui/icons-material/Image";
import DescriptionIcon from "@mui/icons-material/Description";
import Tab from "@components/Widgets/Tabs/Tab";

export default function Tabs({ Container }) {
    const translations = useTranslations();
    const items = usePathItems();
    const baseIndex = items.findIndex(path => {
        const [id] = path.split("?");
        return id === "session";
    });
    const parentIndex = items.length - baseIndex - 2;
    const params = useParentParams(parentIndex) || {};
    const [sessions] = useSessions([], { filterSessions: false, active: false });

    const { group, year, date, name } = params;

    const session = sessions && sessions.find(session =>
        session.group === group &&
        session.name === name &&
        session.date === date &&
        session.year === year) || {};

    const basePath = "#" + toPath(...items.slice(0, baseIndex + 1));

    const tabs = [
        {
            label: translations.DETAILS,
            icon: <InfoIcon />,
            value: basePath
        },
        session.audio && {
            label: translations.AUDIO,
            icon: <AudioIcon />,
            value: basePath + "/" + encodeURIComponent("player?suffix=.m4a")
        },
        session.video && {
            label: translations.VIDEO,
            icon: <MovieIcon />,
            value: basePath + "/" + encodeURIComponent("player?suffix=.mp4")
        },
        session.thumbnail && {
            label: session.video ? translations.THUMBNAIL : translations.IMAGE,
            icon: <ImageIcon />,
            value: basePath + "/" + encodeURIComponent("image")
        },
        session.subtitles && {
            label: translations.TRANSCRIPT,
            icon: <DescriptionIcon />,
            value: basePath + "/" + encodeURIComponent("player?suffix=" + (session.video ? ".mp4" : ".m4a") + "&mode=transcript")
        }
    ].filter(Boolean).map(item => {
        return <Tab key={item.label} {...item} />;
    });

    return <Container>
        {tabs}
    </Container>;
}
