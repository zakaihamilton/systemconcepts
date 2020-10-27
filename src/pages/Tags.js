import StatusBar from "@widgets/StatusBar";
import { useEffect, useMemo } from "react";
import Tree from "@widgets/Tree";
import Tag from "./Tags/Tag";
import { Store } from "pullstate";
import { useTags, buildTree } from "@util/tags";
import Fab from "@widgets/Fab";
import { useTranslations } from "@util/translations";
import AddIcon from '@material-ui/icons/Add';
import { addPath } from "@util/pages";

export const TagsStoreDefaults = {
    mode: "",
    select: null,
    counter: 1,
    onDone: null,
    enableItemClick: true,
    offset: 0,
};

export const TagsStore = new Store(TagsStoreDefaults);

export default function Tags() {
    const translations = useTranslations();
    const { counter } = TagsStore.useState();
    const [data, loading, , setData] = useTags({ counter });

    useEffect(() => {
        TagsStore.update(s => {
            Object.assign(s, TagsStoreDefaults);
        });
    }, []);

    const mapper = item => {
        return item;
    };

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
        <StatusBar data={data} mapper={mapper} store={TagsStore} />
        <Tree
            name="tags"
            mapper={mapper}
            onImport={onImport}
            loading={loading}
            Node={Tag}
            store={TagsStore}
            builder={buildTree}
            params={params}
            data={data}
            refresh={() => {
                TagsStore.update(s => {
                    s.counter++;
                });
            }}
        />
        <Fab title={translations.NEW_TAG} icon={<AddIcon />} onClick={addTag} />
    </>;
}
