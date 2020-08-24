import { useEffect } from "react";
import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { useFetchJSON, fetchJSON } from "@/util/fetch";
import Progress from "@/widgets/Progress";
import Label from "@/widgets/Label";
import MoreVertIcon from '@material-ui/icons/MoreVert';
import IconButton from '@material-ui/core/IconButton';
import Menu from "@/widgets/Menu";
import Tooltip from '@material-ui/core/Tooltip';
import DeleteIcon from '@material-ui/icons/Delete';
import StatusBar from "@/widgets/StatusBar";
import { Store } from "pullstate";
import Checkbox from '@/components/Widgets/Checkbox';

export const UsersStoreDefaults = {
    mode: "",
    name: "",
    select: null,
    counter: 1,
    onDone: null
};

export const UsersStore = new Store(UsersStoreDefaults);

export default function Users() {
    const translations = useTranslations();
    const { mode, select, counter } = UsersStore.useState();
    const [data, , loading] = useFetchJSON("/api/users", {}, [counter]);

    useEffect(() => {
        UsersStore.update(s => {
            Object.assign(s, UsersStoreDefaults);
        });
    }, []);

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        {
            id: "id",
            title: translations.ID,
            sortable: true
        },
        {
            id: "email",
            title: translations.EMAIL_ADDRESS,
            sortable: true
        },
        {
            id: "roleWidget",
            title: translations.ROLE,
            sortable: "role"
        }
    ];

    const mapper = item => {
        let { firstName, lastName } = item;
        const name = [firstName, lastName].filter(Boolean).join(" ");

        const items = [
            {
                id: "delete",
                name: translations.DELETE,
                icon: <DeleteIcon />,
                onClick: () => {
                    UsersStore.update(s => {
                        s.select = [item];
                        s.mode = "delete";
                        s.severity = "info";
                        s.onDone = async select => {
                            const ids = select.map(item => item.id);
                            await fetchJSON("/api/users", { headers: { ids }, method: "DELETE" });
                        }
                    });
                }
            }
        ];

        const menuIcon = !select && <Menu items={items}>
            <IconButton>
                <Tooltip title={translations.MENU}>
                    <MoreVertIcon />
                </Tooltip>
            </IconButton>
        </Menu>;
        const selectIcon = select && <Checkbox select={select} item={item} store={UsersStore} />;

        return {
            ...item,
            name,
            nameWidget: <Label name={<>
                <b>{firstName}</b>
                {lastName}
            </>} icon={select ? selectIcon : menuIcon} />
        };
    };

    const statusBar = <StatusBar data={data} mapper={mapper} store={UsersStore} />;

    return <>
        <Table
            columns={columns}
            data={data}
            mapper={mapper}
            statusBar={statusBar}
            depends={[mode, select]}
            rowHeight="6em"
        />
        {loading && <Progress />}
    </>;
}
