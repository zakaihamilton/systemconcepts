import Tab from "@material-ui/core/Tab";
import tabStyles from "@widgets/Tabs.module.scss";
import { useTranslations } from "@util/translations";
import { usePathItems, useParentParams, toPath } from "@util/pages";
import { useSessions } from "@util/sessions";
import MovieIcon from '@material-ui/icons/Movie';
import AudioIcon from "@icons/Audio";
import InfoIcon from '@material-ui/icons/Info';
import ImageIcon from '@material-ui/icons/Image';

export default function Tabs({ Container }) {
    const translations = useTranslations();
    const items = usePathItems();
    const baseIndex = items.findIndex(path => {
        const [id] = path.split("?");
        return id === "session";
    });
    const parentIndex = items.length - baseIndex - 2;
    const params = useParentParams(parentIndex) || {};
    const [sessions] = useSessions([], false);

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
            label: translations.THUMBNAIL,
            icon: <ImageIcon />,
            value: basePath + "/" + encodeURIComponent("image?label=THUMBNAIL")
        }
    ].filter(Boolean).map(item => {
        const label = <div className={tabStyles.label}>
            {item.icon}
            <div>{item.label}</div>
        </div >;
        return <Tab key={item.value} label={label} value={item.value} />;
    });

    return <Container>
        {tabs}
    </Container>;
}