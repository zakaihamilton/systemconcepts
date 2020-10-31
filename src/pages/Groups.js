import Table from "@widgets/Table";
import { useUpdateSessions } from "@util/updateSessions";
import { useTranslations } from "@util/translations";
import { Store } from "pullstate";
import { useGroups } from "@util/groups";
import ColorPicker from "./Groups/ColorPicker";
import styles from "./Groups.module.scss";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import Cookies from 'js-cookie';
import { useOnline } from "@util/online";
import { formatDuration } from "@util/string";
import UpdateIcon from "@material-ui/icons/Update";
import { useStyles } from "@util/styles";
import Progress from "@widgets/Progress";

registerToolbar("Groups");

export const GroupsStore = new Store({
    counter: 0
});

export default function Groups() {
    const online = useOnline();
    const translations = useTranslations();
    const { counter } = GroupsStore.useState();
    const [groups, loading, setGroups] = useGroups([counter]);
    const [data, busy, start, updateSessions] = useUpdateSessions();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const syncEnabled = online && isSignedIn;

    const className = useStyles(styles, {
        animated: busy
    });

    const duration = start && new Date().getTime() - start;
    const formattedDuration = formatDuration(duration);
    const name = <span>
        {busy ? translations.SYNCING : translations.SYNC}
        <br />
        {!!duration && formattedDuration}
    </span>;

    const toolbarItems = [
        syncEnabled && {
            id: "sessions",
            name,
            icon: <UpdateIcon className={className} />,
            onClick: updateSessions
        }
    ];

    useToolbar({ id: "Groups", items: toolbarItems, depends: [syncEnabled, busy, translations, parseInt(duration / 1000)] });

    const withProgress = data && !!data.length;

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        {
            id: "colorWidget",
            title: translations.COLOR,
            sortable: "color"
        },
        withProgress && {
            id: "progress",
            title: translations.PROGRESS
        }
    ];

    const mapper = item => {

        const changeColor = color => {
            setGroups(groups => {
                groups = [...groups];
                const index = groups.findIndex(group => group.name === item.name);
                groups[index] = { ...groups[index], color: color.hex };
                return groups;
            });
        };

        const status = (data || []).find(group => group.name === item.name) || {};

        const variant = status.progress !== -1 ? "static" : undefined;
        const tooltip = status.index + " / " + status.count;

        return {
            ...item,
            nameWidget: item.name[0].toUpperCase() + item.name.slice(1),
            progress: !!status.progress && <Progress variant={variant} tooltip={tooltip} size={48} style={{ flex: 0, justifyContent: "initial" }} value={variant === "static" ? status.progress : undefined} />,
            colorWidget: <ColorPicker key={item.name} color={item.color} onChangeComplete={changeColor} />
        };
    };

    return <>
        <Table
            name="groups"
            store={GroupsStore}
            columns={columns}
            data={groups}
            refresh={() => {
                GroupsStore.update(s => {
                    s.counter++;
                });
            }}
            viewModes={{
                list: {
                    className: withProgress ? styles.listItemWithProgress : styles.listItem
                },
                table: null
            }}
            mapper={mapper}
            loading={loading}
            depends={[translations, data]}
        />
    </>;
}
