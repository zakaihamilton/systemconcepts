import { useEffect, useCallback, useState } from "react";
import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { useFetchJSON, fetchJSON } from "@/util/fetch";
import Label from "@/widgets/Label";
import StatusBar from "@/widgets/StatusBar";
import { Store } from "pullstate";
import Select from '@/components/Widgets/Select';
import ItemMenu from "./Users/ItemMenu";
import { addPath } from "@/util/pages";
import roles from "@/data/roles";
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import RecentActorsIcon from '@material-ui/icons/RecentActors';
import EmailIcon from '@material-ui/icons/Email';
import { isRTL } from "@/util/string";

export const UsersStoreDefaults = {
    mode: "",
    name: "",
    select: null,
    counter: 1,
    onDone: null,
    enableItemClick: true,
    order: "desc",
    offset: 0,
    orderBy: ""
};

export const UsersStore = new Store(UsersStoreDefaults);

export default function Users() {
    const translations = useTranslations();
    const { viewMode, mode, select, counter, enableItemClick } = UsersStore.useState();
    const [data, , loading] = useFetchJSON("/api/users", {}, [counter]);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);

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
            sortable: true,
            icon: <AccountCircleIcon />
        },
        {
            id: "email",
            title: translations.EMAIL_ADDRESS,
            sortable: true,
            icon: <EmailIcon />
        },
        {
            id: "roleWidget",
            title: translations.ROLE,
            sortable: "role",
            icon: <RecentActorsIcon />
        }
    ];

    const mapper = item => {
        let { firstName, lastName } = item;
        const name = [firstName, lastName].filter(Boolean).join(" ");

        const menuIcon = !select && <ItemMenu viewMode={viewMode} item={item} />;
        const selectIcon = select && <Select select={select} item={item} store={UsersStore} />;
        const roleItem = roles.find(role => role.id === item.role);
        const rtl = isRTL(name);

        const labelName = rtl ? <>
            <span>{lastName}</span>
            <b>{firstName}</b>
        </> : <>
                <b>{firstName}</b>
                <span>{lastName}</span>
            </>;

        return {
            ...item,
            name,
            nameWidget: <Label name={labelName} icon={select ? selectIcon : menuIcon} />,
            roleWidget: roleItem && translations[roleItem.name]
        };
    };

    const statusBar = <StatusBar data={data} mapper={mapper} store={UsersStore} />;

    const rowClick = useCallback((_, item) => {
        const { id } = item;
        if (select) {
            const exists = select.find(item => item.id === id);
            UsersStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, item];
                }
            });
            return;
        }
        addPath("user/" + id);
    }, [select]);

    const onRowClick = enableItemClick && rowClick;

    const onImport = data => {
        const body = JSON.stringify(data);
        setProgress(true);
        fetchJSON("/api/users", {
            method: "PUT",
            body
        }).then(({ err }) => {
            if (err) {
                console.error(err);
                throw err;
            }
            setProgress(false);
            UsersStore.update(s => {
                s.counter++;
            })
        }).catch(err => {
            setError(translations[err] || String(err));
            setProgress(false);
        });
    };

    return <>
        <Table
            name="users"
            store={UsersStore}
            onImport={onImport}
            rowClick={onRowClick}
            columns={columns}
            data={data}
            refresh={() => {
                UsersStore.update(s => {
                    s.counter++;
                });
            }}
            mapper={mapper}
            statusBar={statusBar}
            loading={loading || inProgress}
            depends={[mode, select, onRowClick, translations]}
            rowHeight="6em"
        />
    </>;
}
