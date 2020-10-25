import StatusBar from "@widgets/StatusBar";
import { useEffect } from "react";
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

const tags = {
    name: 'Root #1',
    id: 'root-1',
    items: [
        {
            items: [
                { id: 'child-2', name: 'Child #2' },
                { id: 'child-3', name: 'Child #3' },
            ],
            id: 'child-1',
            name: 'Child #1',
        },
        {
            items: [{ id: 'child-5', name: 'Child #5' }],
            id: 'child-4',
            name: 'Child #4',
        }
    ],
};

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

    console.log("data", data);

    return <>
        <StatusBar data={data} mapper={mapper} store={TagsStore} />
        <Tree
            name="tags"
            mapper={mapper}
            loading={loading}
            Node={Tag}
            store={TagsStore}
            builder={buildTree}
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
