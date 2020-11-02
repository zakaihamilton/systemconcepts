import StatusBar from "@widgets/StatusBar";
import { useEffect, useMemo } from "react";
import Tree from "@widgets/Tree";
import Item from "./Librarian/Item";
import { Store } from "pullstate";
import { buildTree } from "@util/tags";
import { useContent } from "@util/content";
import Fab from "@widgets/Fab";
import { useTranslations } from "@util/translations";
import AddIcon from '@material-ui/icons/Add';
import { addPath } from "@util/pages";
import { useLanguage } from "@util/language";

export const LibrarianStoreDefaults = {
    mode: "",
    select: null,
    counter: 1,
    onDone: null,
    enableItemClick: true,
    offset: 0,
};

export const LibrarianStore = new Store(LibrarianStoreDefaults);

export default function Librarian() {
    const language = useLanguage();
    const translations = useTranslations();
    const { counter } = LibrarianStore.useState();
    const { data, busy, write } = useContent({ counter });

    useEffect(() => {
        LibrarianStore.update(s => {
            Object.assign(s, LibrarianStoreDefaults);
        });
    }, []);

    const mapper = item => {
        const translation = item[language];
        if (translation) {
            item.name = translation;
        }
        if (!item.name) {
            item.name = item.id.split(".").pop();
        }
        return item;
    };

    const filter = (item, search) => {
        return !search || (item.name && item.name.toLowerCase().includes(search.toLowerCase()));
    };

    const addContent = () => {
        addPath("content/");
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
            filter={filter}
            onImport={onImport}
            loading={busy}
            statusBar={<StatusBar data={data} mapper={mapper} store={LibrarianStore} />}
            Node={Item}
            store={LibrarianStore}
            builder={buildTree}
            params={params}
            data={data}
            refresh={() => {
                LibrarianStore.update(s => {
                    s.counter++;
                });
            }}
        />
        {!busy && <Fab title={translations.NEW_CONTENT} icon={<AddIcon />} onClick={addContent} />}
    </>;
}
