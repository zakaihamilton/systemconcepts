import StatusBar from "@widgets/StatusBar";
import { useEffect, useMemo } from "react";
import Tree from "@widgets/Tree";
import Item from "./Content/Item";
import { Store } from "pullstate";
import { buildTree } from "@util/tags";
import { useContent } from "@util/content";
import Fab from "@widgets/Fab";
import { useTranslations } from "@util/translations";
import AddIcon from '@material-ui/icons/Add';
import { addPath } from "@util/pages";
import { useLanguage } from "@util/language";

export const ContentStoreDefaults = {
    mode: "",
    select: null,
    counter: 1,
    onDone: null,
    enableItemClick: true,
    offset: 0,
};

export const ContentStore = new Store(ContentStoreDefaults);

export default function Tags() {
    const language = useLanguage();
    const translations = useTranslations();
    const { counter } = ContentStore.useState();
    const { data, busy, write } = useContent({ counter });

    useEffect(() => {
        ContentStore.update(s => {
            Object.assign(s, ContentStoreDefaults);
        });
    }, []);

    const mapper = item => {
        const translation = item[language];
        if (translation) {
            item.name = translation;
        }
        return item;
    };

    const addContent = () => {

    };

    const onImport = data => {

    };

    const params = useMemo(() => {
        return { data, write };
    }, [data, write]);

    return <>
        <Tree
            name="tags"
            mapper={mapper}
            onImport={onImport}
            loading={busy}
            statusBar={<StatusBar data={data} mapper={mapper} store={ContentStore} />}
            Node={Item}
            store={ContentStore}
            builder={buildTree}
            params={params}
            data={data}
            refresh={() => {
                ContentStore.update(s => {
                    s.counter++;
                });
            }}
        />
        <Fab title={translations.NEW_TAG} icon={<AddIcon />} onClick={addContent} />
    </>;
}
