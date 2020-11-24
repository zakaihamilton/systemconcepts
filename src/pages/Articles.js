import StatusBar from "@widgets/StatusBar";
import { useEffect, useCallback } from "react";
import Table from "@widgets/Table";
import { Store } from "pullstate";
import { useArticles } from "@util/articles";
import Fab from "@widgets/Fab";
import { useTranslations } from "@util/translations";
import AddIcon from '@material-ui/icons/Add';
import { addPath, toPath } from "@util/pages";
import { useLanguage } from "@util/language";
import styles from "./Articles.module.scss";
import Row from "@widgets/Row";
import ItemMenu from "./Articles/ItemMenu";
import { useLocalStorage } from "@util/store";

export const ArticlesStoreDefaults = {
    mode: "",
    select: null,
    counter: 1,
    onDone: null,
    offset: 0
};

export const ArticlesStore = new Store(ArticlesStoreDefaults);

export default function Articles() {
    const language = useLanguage();
    const translations = useTranslations();
    const { select, counter, viewMode } = ArticlesStore.useState();
    const [data, loading, , setData] = useArticles({ counter });
    useLocalStorage("ArticlesStore", ArticlesStore, ["viewMode"]);

    useEffect(() => {
        ArticlesStore.update(s => {
            Object.assign(s, ArticlesStoreDefaults);
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
        }
    ];

    const typeClick = useCallback(item => {
        const { id } = item;
        if (select) {
            const exists = select.find(item => item.id === id);
            ArticlesStore.update(s => {
                if (exists) {
                    s.select = select.filter(item => item.id !== id);
                }
                else {
                    s.select = [...select, item];
                }
            });
            return;
        }
        addPath("article/" + id);
    }, [select]);

    const mapper = item => {
        const label = item[language];
        const iconWidget = <ItemMenu item={item} store={ArticlesStore} />;
        const href = !select && "#articles/" + toPath("article/" + item.id);
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

    const addArticle = () => {
        addPath("article/");
    };

    const onImport = data => {
        setData(data.types);
    };

    const statusBar = <StatusBar data={data} mapper={mapper} store={ArticlesStore} />;

    return <>
        <Table
            name="articles"
            store={ArticlesStore}
            onImport={onImport}
            columns={columns}
            data={data}
            refresh={() => {
                ArticlesStore.update(s => {
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
        {!loading && <Fab title={translations.NEW_ARTICLE} icon={<AddIcon />} onClick={addArticle} />}
    </>;
}
