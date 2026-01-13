import { useEffect, useCallback, useState } from "react";
import Table from "@widgets/Table";
import { useTranslations } from "@util/translations";
import { useFetchJSON, fetchJSON } from "@util/fetch";
import Row from "@widgets/Row";
import StatusBar from "@widgets/StatusBar";
import { Store } from "pullstate";
import ItemMenu from "./Users/ItemMenu";
import { addPath, toPath } from "@util/pages";
import roles from "@data/roles";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import RecentActorsIcon from "@mui/icons-material/RecentActors";
import EmailIcon from "@mui/icons-material/Email";
import TodayIcon from "@mui/icons-material/Today";
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
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
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
        !isPhone && {
            id: "date",
            title: translations.DATE,
            sortable: "utc",
            icon: <TodayIcon />
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
        let { id, firstName, lastName } = item;
        const name = [firstName, lastName].filter(Boolean).join(" ");
        const iconWidget = <ItemMenu item={item} store={UsersStore} />;
        const roleItem = roles.find(role => role.id === item.role);
        const rtl = isRTL(name);
        const labelName = rtl ? <div className={styles.name}>
            <span>{lastName}</span>
            <b>{firstName}</b>
        </div> : <div className={styles.name}>
            <b>{firstName}</b>
            <span>{lastName}</span>
        </div>;
        const href = "#users/" + toPath("user/" + id + "?name=" + firstName + " " + lastName);
        return {
            ...item,
            nameWidget: <Row href={href} onClick={userClick.bind(this, item)} icons={iconWidget}>{labelName}</Row>,
            roleWidget: roleItem && translations[roleItem.name],
            name,
            date: new Date(item.utc).toLocaleDateString("en-GB")
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
            });
        }).catch(err => {
            console.error(err);
            setProgress(false);
        });
    };

    return <Table
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
    />;
}
