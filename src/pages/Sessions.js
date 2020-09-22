import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { useStatus } from "@/util/sessions";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import UpdateIcon from "@material-ui/icons/Update";
import styles from "./Sessions.module.scss";
import { useOnline } from "@/util/online";
import Cookies from 'js-cookie';
import { useStyles } from "@/util/styles";
import Chip from "@material-ui/core/Chip";
import Row from "@/widgets/Row";
import Label from "@/widgets/Label";
import Progress from "@/widgets/Progress";

registerToolbar("Sessions");

export default function Sessions({ }) {
    const translations = useTranslations();
    const online = useOnline();
    const [data, busy, updateSessions] = useStatus();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const syncEnabled = online && isSignedIn;

    const className = useStyles(styles, {
        animated: busy
    });

    let name = translations.SYNC;
    if (busy) {
        name = translations.SYNCING;
    }

    const menuItems = [
        syncEnabled && {
            id: "sessions",
            name,
            icon: <UpdateIcon className={className} />,
            onClick: updateSessions,
            divider: true
        }
    ];

    useToolbar({ id: "Sessions", items: menuItems, depends: [syncEnabled, busy] });

    const columns = [
        {
            id: "name",
            title: translations.FOLDER,
            sortable: true
        },
        {
            id: "years",
            title: translations.YEARS
        },
        {
            id: "progress",
            title: translations.PROGRESS
        }
    ].filter(Boolean);

    const mapper = item => {
        const name = item.name[0].toUpperCase() + item.name.substring(1);
        const tags = item.years && item.years.map(year => {
            return <Chip
                key={year}
                label={year}
            />;
        });
        const showProgress = parseInt(item.progress) !== 100;
        return {
            ...item,
            name,
            years: <Row>
                {tags}
            </Row>,
            progress: !!item.progress && <Progress variant="static" size={48} style={{ flex: 0, justifyContent: "initial" }} value={item.progress} />
        }
    };

    return <>
        <Table rowHeight="5.5em" resetOnDataChange={false} name="sessions" columns={columns} data={data} mapper={mapper} />
    </>;
}
