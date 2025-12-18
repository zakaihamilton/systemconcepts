import StatusBar from "@widgets/StatusBar";
import { useEffect, useCallback } from "react";
import Table from "@widgets/Table";
import { Store } from "pullstate";
import { useTags } from "@util/tags";
import { useTypes } from "@util/types";
import Fab from "@widgets/Fab";
import { useTranslations } from "@util/translations";
import AddIcon from "@mui/icons-material/Add";
import { addPath, toPath } from "@util/pages";
import { useLanguage } from "@util/language";
import styles from "./Tags.module.scss";
import Row from "@widgets/Row";
import ItemMenu from "./Tags/ItemMenu";
import { useLocalStorage } from "@util/store";
import StyleIcon from "@mui/icons-material/Style";

export const TagsStoreDefaults = {
    mode: "",
    select: null,
    counter: 1,
    onDone: null,
    offset: 0,
    typeFilter: ""
};

export const TagsStore = new Store(TagsStoreDefaults);

export default function Tags() {
    const language = useLanguage();
    const translations = useTranslations();
    const { typeFilter, select, counter, viewMode } = TagsStore.useState();
    const [data, loading, , setData] = useTags({ counter });
    const [types] = useTypes({ counter });
    useLocalStorage("TagsStore", TagsStore, ["viewMode"]);

    useEffect(() => {
        TagsStore.update(s => {
            Object.assign(s, TagsStoreDefaults);
        });
    }, []);

    const columns = [
        {
            id: "idWidget",
            title: translations.ID,
            sortable: "id",
            padding: false
        },
        {
            id: "label",
            title: translations.NAME,
            sortable: true
        },
        {
            id: "typeWidget",
            title: translations.TYPE,
            sortable: true,
            icon: <StyleIcon />,
            selected: () => typeFilter,
            onSelectable: item => item.type,
            onClick: item => TagsStore.update(s => {
                if (s.typeFilter) {
                    s.typeFilter = "";
                }
                else {
                    s.typeFilter = typeof item.type !== "undefined" && item.type;
                }
                s.offset = 0;
            })
        }
    ];

    const tagClick = useCallback(item => {
        const { id } = item;
        if (select) {
            const exists = select.find(item => item.id === id);
            TagsStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, item];
                }
            });
            return;
        }
        addPath("tag/" + id);
    }, [select]);

    const mapper = item => {
        const label = item[language];
        const iconWidget = <ItemMenu item={item} store={TagsStore} setData={setData} />;
        const href = !select && "#librarian/tags/" + toPath("tag/" + item.id);
        const parents = item.parents && item.parents.map(id => {
            const parent = data.find(item => item.id === id);
            return parent[language];
        }).join(", ");
        const typeItem = (types || []).find(type => type.id === item.type);
        return {
            ...item,
            label,
            parents,
            idWidget: <Row href={href} onClick={tagClick.bind(this, item)} icons={iconWidget}>{item.id}</Row>,
            typeWidget: typeItem && typeItem[language],
        };
    };

    const addTag = () => {
        addPath("tag/");
    };

    const onImport = data => {
        setData(data.tags);
    };

    const statusBar = <StatusBar data={data} mapper={mapper} store={TagsStore} />;

    return <>
        <Table
            name="tags"
            store={TagsStore}
            onImport={onImport}
            columns={columns}
            data={data}
            refresh={() => {
                TagsStore.update(s => {
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
            depends={[select, translations, types, viewMode]}
        />
        {!loading && <Fab title={translations.NEW_TAG} icon={<AddIcon />} onClick={addTag} />}
    </>;
}
