import { useEffect, useMemo, useCallback } from "react";
import StatusBar from "@widgets/StatusBar";
import Tree from "@widgets/Tree";
import Item from "./Librarian/Item";
import { Store } from "pullstate";
import { buildTree } from "@util/tags";
import { useContent, createID } from "@util/content";
import Fab from "@widgets/Fab";
import { useTranslations } from "@util/translations";
import AddIcon from '@material-ui/icons/Add';
import { addPath } from "@util/pages";
import { useLanguage } from "@util/language";
import storage from "@util/storage";

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
    const { data, busy, remove } = useContent({ counter });

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
        return item;
    }, [language]);

    const filter = useCallback((item, search) => {
        return !search || (item.name && item.name.toLowerCase().includes(search.toLowerCase()));
    }, []);

    const addContent = () => {
        addPath("content/");
    };

    const onImport = async data => {
        const records = [];
        for (const item of data) {
            const { text, _id, user, ...tags } = item;
            let record = records.find(record => record._id === _id);
            if (!record) {
                record = { _id, id: createID(), tags: {} };
                records.push(record);
            }
            for (const tag in tags) {
                record.tags[tag] = { eng: tags[tag] };
            }
            if (text) {
                record.text = text;
            }
        }
        let library = [];
        let folders = [];
        let files = {};
        for (const item of records) {
            const { id, tags, text } = item;
            library.push({ id, tags });
            folders.push(item.id);
            files[item.id + "/tags.json"] = JSON.stringify({ id, tags }, null, 4);
            files[item.id + "/eng.txt"] = text;
        }
        console.log(`creating ${folders.length} folders`);
        await storage.createFolders("content/", folders);
        console.log(`writing ${Object.keys(files).length} files`);
        await storage.writeFiles("content/", files);
        await storage.writeFile("shared/library/library.json", JSON.stringify(library, null, 4));
    };

    const params = useMemo(() => {
        return { data, remove };
    }, [data, remove]);

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
