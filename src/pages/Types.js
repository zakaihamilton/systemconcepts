import StatusBar from "@widgets/StatusBar";
import { useEffect, useCallback } from "react";
import Table from "@widgets/Table";
import { Store } from "pullstate";
import { useTypes } from "@util/types";
import Fab from "@widgets/Fab";
import { useTranslations } from "@util/translations";
import AddIcon from '@material-ui/icons/Add';
import { addPath, toPath } from "@util/pages";
import { useLanguage } from "@util/language";
import styles from "./Types.module.scss";
import Row from "@widgets/Row";
import ItemMenu from "./Types/ItemMenu";

export const TypesStoreDefaults = {
    mode: "",
    select: null,
    counter: 1,
    onDone: null,
    offset: 0
};

export const TypesStore = new Store(TypesStoreDefaults);

export default function Types() {
    const language = useLanguage();
    const translations = useTranslations();
    const { select, counter, viewMode } = TypesStore.useState();
    const [data, loading, , setData] = useTypes({ counter });

    useEffect(() => {
        TypesStore.update(s => {
            Object.assign(s, TypesStoreDefaults);
        });
    }, []);

    const columns = [
        {
            id: "idWidget",
            title: translations.ID,
            sortable: "id"
        },
        {
            id: "label",
            title: translations.NAME,
            sortable: true
        },
        {
            id: "parents",
            title: translations.PARENT_TYPES,
            sortable: true
        }
    ];

    const typeClick = useCallback(item => {
        const { id } = item;
        if (select) {
            const exists = select.find(item => item.id === id);
            TypesStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, item];
                }
            });
            return;
        }
        addPath("type/" + id);
    }, [select]);

    const mapper = item => {
        const label = item[language];
        const iconWidget = <ItemMenu item={item} store={TypesStore} />;
        const href = !select && "#librarian/types/" + toPath("type/" + item.id);
        const parents = item.parents && item.parents.map(id => {
            const parent = data.find(item => item.id === id);
            return parent[language];
        }).join(", ");
        return {
            ...item,
            label,
            parents,
            idWidget: <Row href={href} onClick={typeClick.bind(this, item)} icons={iconWidget}>{item.id}</Row>
        };
    };

    const addType = () => {
        addPath("type/");
    };

    const onImport = data => {
        setData(data.types);
    };

    const statusBar = <StatusBar data={data} mapper={mapper} store={TypesStore} />;

    return <>
        <Table
            name="types"
            store={TypesStore}
            onImport={onImport}
            columns={columns}
            data={data}
            refresh={() => {
                TypesStore.update(s => {
                    s.counter++;
                });
            }}
            viewModes={{
                list: {
                    className: styles.listItem
                },
                table: null
            }}
            mapper={mapper}
            statusBar={statusBar}
            loading={loading}
            depends={[select, translations, viewMode]}
        />
        {!loading && <Fab title={translations.NEW_TYPE} icon={<AddIcon />} onClick={addType} />}
    </>;
}
