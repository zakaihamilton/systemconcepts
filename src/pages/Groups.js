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
import ItemMenu from "./Groups/ItemMenu";
import Label from "@widgets/Label";

registerToolbar("Groups");

export const GroupsStore = new Store({
    counter: 0
});

export default function Groups() {
    const online = useOnline();
    const translations = useTranslations();
    const { viewMode, counter } = GroupsStore.useState();
    const [groups, loading, setGroups] = useGroups([counter]);
    const { status, busy, start, updateSessions, updateGroup: syncGroup } = useUpdateSessions();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const syncEnabled = online && isSignedIn;

    const className = useStyles(styles, {
        animated: busy
    });

    const duration = start && new Date().getTime() - start;
    const formattedDuration = formatDuration(duration);
    const name = <span>
        {busy ? translations.SYNCING : translations.SYNC_SESSIONS}
        <br />
        {!!duration && formattedDuration}
    </span>;

    const toolbarItems = [
        syncEnabled && {
            id: "sync_sessions",
            name,
            icon: <UpdateIcon className={className} />,
            onClick: updateSessions
        }
    ];

    useToolbar({ id: "Groups", items: toolbarItems, depends: [syncEnabled, busy, translations, parseInt(duration / 1000)] });

    const withProgress = status && !!status.length;

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        {
            id: "colorWidget",
            title: translations.COLOR,
            sortable: "color",
            columnProps: {
                style: {
                    width: "6em"
                }
            }
        },
        withProgress && {
            id: "progress",
            title: translations.PROGRESS,
            columnProps: {
                style: {
                    width: "6em"
                }
            }
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

        const statusItem = (status || []).find(group => group.name === item.name) || {};
        const hasStatusItem = statusItem.progress !== "undefined";

        const variant = statusItem.progress !== -1 ? "static" : undefined;
        const tooltip = statusItem.index + " / " + statusItem.count;

        const iconWidget = <ItemMenu syncGroup={syncGroup} item={item} store={GroupsStore} />;

        return {
            ...item,
            iconWidget,
            nameWidget: <Label name={item.name[0].toUpperCase() + item.name.slice(1)} icon={iconWidget} />,
            progress: !!hasStatusItem && <Progress variant={variant} tooltip={tooltip} size={48} style={{ flex: 0, justifyContent: "initial" }} value={variant === "static" ? statusItem.progress : undefined} />,
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
                table: null
            }}
            mapper={mapper}
            loading={loading}
            depends={[translations, status]}
        />
    </>;
}
