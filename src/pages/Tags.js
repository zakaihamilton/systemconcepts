import StatusBar from "@widgets/StatusBar";
import { useEffect, useMemo, useCallback } from "react";
import Tree from "@widgets/Tree";
import Tag from "./Tags/Tag";
import { Store } from "pullstate";
import { useTags, buildTree, tagsFilePath } from "@util/tags";
import Fab from "@widgets/Fab";
import { useTranslations } from "@util/translations";
import AddIcon from '@material-ui/icons/Add';
import { addPath } from "@util/pages";
import { useLanguage } from "@util/language";

export const TagsStoreDefaults = {
    mode: "",
    select: null,
    counter: 1,
    onDone: null,
    offset: 0,
};

export const TagsStore = new Store(TagsStoreDefaults);

export default function Tags() {
    const language = useLanguage();
    const translations = useTranslations();
    const { counter } = TagsStore.useState();
    const [data, loading, , setData] = useTags({ counter });

    useEffect(() => {
        TagsStore.update(s => {
            Object.assign(s, TagsStoreDefaults);
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
        return !search || (item.label && item.label.toLowerCase().includes(search.toLowerCase()));
    }, []);

    const addTag = () => {
        addPath("tag");
    };

    const onImport = data => {
        setData(data.tags);
    };

    const params = useMemo(() => {
        return { data, setData };
    }, [data, setData]);

    return <>
        <Tree
            name="tags"
            mapper={mapper}
            filter={filter}
            onImport={onImport}
            loading={loading}
            statusBar={<StatusBar data={data} mapper={mapper} store={TagsStore} />}
            Node={Tag}
            store={TagsStore}
            builder={buildTree}
            params={params}
            source={tagsFilePath}
            data={data}
            refresh={() => {
                TagsStore.update(s => {
                    s.counter++;
                });
            }}
        />
        {!loading && <Fab title={translations.NEW_TAG} icon={<AddIcon />} onClick={addTag} />}
    </>;
}
