import { useEffect, useMemo, useCallback } from "react";
import StatusBar from "@widgets/StatusBar";
import Tree from "@widgets/Tree";
import Item from "./Librarian/Item";
import { Store } from "pullstate";
import { useTags, buildTree } from "@util/tags";
import Fab from "@widgets/Fab";
import { useTranslations } from "@util/translations";
import AddIcon from '@material-ui/icons/Add';
import { addPath } from "@util/pages";
import { useLanguage } from "@util/language";
import { importContent, scanContent } from "@util/library";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import UpdateIcon from '@material-ui/icons/Update';

registerToolbar("Librarian");

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
    const [data, busy] = useTags({ counter });

    useEffect(() => {
        LibrarianStore.update(s => {
            Object.assign(s, LibrarianStoreDefaults);
        });
    }, []);

    const mapper = useCallback(item => {
        const translation = item[language];
        if (translation) {
            item.label = translation;
        }
        else {
            item.label = item.name;
        }
        if (!item.content || !item.content.length) {
            item.type = "tag";
        }
        else {
            item.type = "content";
        }
        return item;
    }, [language]);

    const filter = useCallback((item, search) => {
        return !search || (item.name && item.name.toLowerCase().includes(search.toLowerCase()));
    }, []);

    const addContent = () => {
        addPath("content/");
    };

    const onImport = async data => {
        await importContent(data);
        LibrarianStore.update(s => {
            s.counter++;
        });
    };

    const params = useMemo(() => {
        return { data, remove: null };
    }, [data]);

    const toolbarItems = [
        {
            id: "scanContent",
            name: translations.SCAN_CONTENT,
            icon: <UpdateIcon />,
            location: "header",
            onClick: scanContent
        }
    ].filter(Boolean);

    useToolbar({ id: "Librarian", items: toolbarItems, depends: [] });

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
