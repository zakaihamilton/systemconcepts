import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "@util/translations";
import Form, { FormGroup } from "@widgets/Form";
import Input from "@widgets/Input";
import Button from '@material-ui/core/Button';
import { goBackPage, addPath } from "@util/pages";
import { useFile } from "@util/storage";
import { createID, useContent } from "@util/content";
import { useLanguage } from "@util/language";
import Table from "@widgets/Table";
import { Store } from "pullstate";
import { useLocalStorage } from "@util/store";
import styles from "./Content.module.scss";
import { MainStore } from "@components/Main";
import { useSize } from "@util/size";
import Edit from "@pages/Content/Edit";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { useTags, uniqueTags } from "@util/tags";

registerToolbar("Content");

export const ContentStoreDefaults = {
    mode: "",
    name: "",
    value: "",
    select: null,
    counter: 1,
    onDone: null,
    order: "desc",
    offset: 0,
    orderBy: "",
    roleFilter: "",
};

export const ContentStore = new Store(ContentStoreDefaults);

export default function Content({ path = "" }) {
    const { showSideBar } = MainStore.useState();
    const language = useLanguage();
    const contentId = path;
    const translations = useTranslations();
    const { counter, viewMode = "table", mode, item: editedItem } = ContentStore.useState();
    const [tags] = useTags({ counter });
    const { busy, toPath } = useContent({ counter });
    const [inProgress, setProgress] = useState(false);
    const [data, loading, , setData] = useFile(contentId && (toPath(contentId) + "/tags.json"), [contentId], data => {
        return data ? JSON.parse(data) : {};
    });
    const ref = useRef();
    const [record, setRecord] = useState({});
    useLocalStorage("ContentStore", ContentStore, ["viewMode"]);

    useEffect(() => {
        ContentStore.update(s => {
            Object.assign(s, ContentStoreDefaults);
        });
    }, []);

    useEffect(() => {
        setRecord(data || {});
    }, [data]);

    useEffect(() => {
        if (!contentId) {
            setRecord(record => {
                record.id = createID();
                return record;
            });
        }
    }, [contentId]);

    const onSubmit = async () => {
        if (!inProgress) {
            setProgress(true);
            await setData(record, toPath(record.id) + "/tags.json");
            setProgress(false);
            goBackPage();
        }
    };

    const onCancel = () => {
        goBackPage();
    };

    const renameItem = useCallback(item => {
        ContentStore.update(s => {
            s.mode = "rename";
            s.type = item.type;
            s.value = item.value;
            s.item = item;
            s.icon = item.icon;
            s.tooltip = item.tooltip;
            s.placeholder = "";
            s.editing = true;
            s.onDone = async value => {
                setRecord(record => {
                    record = { ...record };
                    record.tags = Object.assign({}, record.tags);
                    const values = record.tags[item.id] = Object.assign({}, record.tags[item.id]);
                    if (value) {
                        values[language] = value;
                    }
                    else {
                        delete values[language]
                        if (!Object.keys(values).length) {
                            delete record.tags[item.id];
                        }
                    }
                    return record;
                });
            }
        });
    }, [language]);

    const columns = [
        {
            id: "name",
            title: translations.TAG,
            sortable: "name"
        },
        {
            id: "valueWidget",
            title: translations.NAME,
            sortable: "value",
            onSelectable: () => mode !== "rename",
            onClick: mode !== "rename" && renameItem
        }
    ];

    const tagsData = useMemo(() => {
        return uniqueTags(tags).map(tagId => {
            const item = { id: tagId };
            const recordTags = record.tags || {};
            const values = recordTags[tagId] || {};
            item.value = values[language];
            return item;
        });
    }, [tags, record]);

    const mapper = item => {
        const tag = tags.find(tag => tag.id === item.id);
        item = { ...tag, ...item };
        const translation = item[language];
        if (translation) {
            item.name = translation;
        }
        if (!item.name) {
            item.name = item.id.split(".").pop();
        }
        item.valueWidget = item.value;
        if (mode === "rename" && editedItem.id === item.id) {
            item.valueWidget = <Edit key={item.id} />;
        }
        return item;
    };

    const actions = <>
        <Button
            onClick={onSubmit}
            variant="contained"
            color="primary"
            size="large"
            disabled={!!(inProgress || !record)}
        >
            {translations.SAVE}
        </Button>
        <Button
            onClick={onCancel}
            variant="contained"
            color="primary"
            size="large"
        >
            {translations.CANCEL}
        </Button>
    </>;

    const onImport = data => {
        setRecord(data);
    };

    const onExport = () => {
        return JSON.stringify(record, null, 4);
    };

    const size = useSize(ref, [showSideBar]);

    const gotoEditor = () => {
        addPath("editor/" + toPath(record.id) + "/" + language + ".txt");
    };

    const toolbarItems = [
        contentId && {
            id: "editor",
            name: translations.EDITOR,
            icon: <InsertDriveFileIcon />,
            onClick: gotoEditor,
            location: "header"
        }
    ].filter(Boolean);

    useToolbar({ id: "Content", items: toolbarItems, depends: [contentId, language] });

    return <>
        <Form actions={actions} loading={loading} data={record}>
            <FormGroup record={record} setRecord={setRecord}>
                <Input
                    id="id"
                    label={translations.ID}
                    readOnly={true}
                />
            </FormGroup>
            <div ref={ref} className={styles.table}>
                <Table
                    name={record.id}
                    size={size}
                    loading={busy}
                    store={ContentStore}
                    onImport={onImport}
                    onExport={onExport}
                    columns={columns}
                    data={tagsData}
                    viewModes={{
                        list: {
                            className: styles.listItem
                        },
                        table: null
                    }}
                    mapper={mapper}
                    depends={[mode, translations, record, tagsData, language, viewMode]}
                />
            </div>
        </Form>
    </>;
}
