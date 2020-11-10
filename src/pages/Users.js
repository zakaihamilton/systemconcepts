import { useEffect, useCallback, useState } from "react";
import Table from "@widgets/Table";
import { useTranslations } from "@util/translations";
import { useFetchJSON, fetchJSON } from "@util/fetch";
import Label from "@widgets/Label";
import StatusBar from "@widgets/StatusBar";
import { Store } from "pullstate";
import ItemMenu from "./Users/ItemMenu";
import { addPath } from "@util/pages";
import roles from "@data/roles";
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import RecentActorsIcon from '@material-ui/icons/RecentActors';
import EmailIcon from '@material-ui/icons/Email';
import { isRTL } from "@util/string";
import { useDeviceType } from "@util/styles";
import styles from "./Users.module.scss";
import { useLocalStorage } from "@util/store";

export const UsersStoreDefaults = {
    mode: "",
    name: "",
    select: null,
    counter: 1,
    onDone: null,
    order: "desc",
    offset: 0,
    orderBy: "",
    roleFilter: "",
};

export const UsersStore = new Store(UsersStoreDefaults);

export default function Users() {
    const isPhone = useDeviceType() === "phone";
    const translations = useTranslations();
    const { roleFilter, viewMode = "table", mode, select, counter } = UsersStore.useState();
    useLocalStorage("UsersStore", UsersStore, ["viewMode"]);
    const [data, , loading] = useFetchJSON("/api/users", {}, [counter]);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        UsersStore.update(s => {
            Object.assign(s, UsersStoreDefaults);
        });
    }, []);

    const userClick = useCallback(item => {
        const { id, firstName, lastName } = item;
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
        addPath("user/" + id + "?name=" + firstName + " " + lastName);
    }, [select]);

    const columns = [
        {
            id: "iconWidget",
            viewModes: {
                list: true
            }
        },
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name",
            onSelectable: item => true,
            onClick: userClick
        },
        !isPhone && {
            id: "id",
            title: translations.ID,
            sortable: true,
            icon: <AccountCircleIcon />
        },
        !isPhone && {
            id: "email",
            title: translations.EMAIL_ADDRESS,
            sortable: true,
            icon: <EmailIcon />
        },
        {
            id: "roleWidget",
            title: translations.ROLE,
            sortable: "role",
            icon: <RecentActorsIcon />,
            selected: () => roleFilter,
            onSelectable: item => item.role,
            onClick: item => UsersStore.update(s => {
                if (s.roleFilter) {
                    s.roleFilter = "";
                }
                else {
                    s.roleFilter = typeof item.role !== "undefined" && item.role;
                }
                s.offset = 0;
            })
        }
    ];

    const mapper = item => {
        let { firstName, lastName } = item;
        const name = [firstName, lastName].filter(Boolean).join(" ");
        const iconWidget = <ItemMenu viewMode={viewMode} item={item} store={UsersStore} />;
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
            iconWidget,
            nameWidget: <Label name={labelName} icon={viewMode === "table" && iconWidget} />,
            roleWidget: roleItem && translations[roleItem.name],
            name
        };
    };

    const filter = item => {
        const { role } = item;
        const show = !roleFilter || roleFilter === role;
        return show;
    };

    const statusBar = <StatusBar data={data} mapper={mapper} store={UsersStore} />;

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
            columns={columns}
            data={data}
            refresh={() => {
                UsersStore.update(s => {
                    s.counter++;
                });
            }}
            viewModes={{
                list: {
                    className: isPhone ? styles.listPhoneItem : styles.listItem
                },
                table: null
            }}
            mapper={mapper}
            filter={filter}
            statusBar={statusBar}
            loading={loading || inProgress}
            depends={[mode, select, translations, viewMode, roleFilter]}
        />
    </>;
}
