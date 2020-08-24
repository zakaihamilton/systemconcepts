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
import Checkbox from '@material-ui/core/Checkbox';
import styles from "./Users.module.scss";

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
            id: "email",
            title: translations.EMAIL_ADDRESS,
            sortable: true
        }
    ];

    const mapper = item => {
        let { firstName, lastName } = item;
        const id = item.email;
        const name = [firstName, lastName].filter(Boolean).join(" ");

        const items = [
            {
                id: "delete",
                name: translations.DELETE,
                icon: <DeleteIcon />,
                onClick: () => {
                    UsersStore.update(s => {
                        s.select = [{ ...item, id }];
                        s.mode = "delete";
                        s.severity = "info";
                        s.onDone = async select => {
                            for (const item of select) {
                                await fetchJSON("/api/users", { headers: { email: item.email }, method: "DELETE" });
                            }
                        }
                    });
                }
            }
        ];

        const selectItem = (event) => {
            const { checked } = event.target;
            UsersStore.update(s => {
                if (checked) {
                    s.select = [...select, { ...item, id }];
                }
                else {
                    s.select = select.filter(item => item.id !== id);
                }
            });
        };

        const menuIcon = !select && <Menu items={items}>
            <IconButton>
                <Tooltip title={translations.MENU}>
                    <MoreVertIcon />
                </Tooltip>
            </IconButton>
        </Menu>;
        const selectIcon = select && <Checkbox
            classes={{ root: styles.checkbox }}
            color="default"
            checked={select.find(item => item.id === id) ? true : false}
            onChange={selectItem} />;

        return {
            ...item,
            id,
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
