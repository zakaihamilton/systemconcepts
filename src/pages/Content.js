import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "@util/translations";
import Form, { FormGroup } from "@widgets/Form";
import Input from "@widgets/Input";
import Button from '@material-ui/core/Button';
import { goBackPage } from "@util/pages";
import { useFile } from "@util/storage";
import { useContent } from "@util/content";
import { useLanguage } from "@util/language";
import Table from "@widgets/Table";
import { Store } from "pullstate";
import { useLocalStorage } from "@util/store";
import styles from "./Content.module.scss";
import { MainStore } from "@components/Main";
import { useSize } from "@util/size";
import Edit from "@pages/Content/Edit";

export const ContentStoreDefaults = {
    mode: "",
    name: "",
    value: "",
    select: null,
    counter: 1,
    onDone: null,
    enableItemClick: true,
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
    const { tags, uniqueTags, busy } = useContent({ counter: 0 });
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const toPath = contentId => "content/" + contentId + ".json";
    const [data, loading, , setData] = useFile(contentId && (toPath(contentId)), [contentId], data => {
        return data ? JSON.parse(data) : {};
    });
    const ref = useRef();
    const [record, setRecord] = useState({});
    const { viewMode = "table", mode, item: editedItem, enableItemClick } = ContentStore.useState();
    useLocalStorage("ContentStore", ContentStore, ["viewMode"]);

    useEffect(() => {
        ContentStore.update(s => {
            Object.assign(s, ContentStoreDefaults);
        });
    }, []);

    useEffect(() => {
        setRecord(data || {});
    }, [data]);

    const onValidateId = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
        }
        else if (!text.match(/^[a-z0-9]+$/i)) {
            error = translations.BAD_ID;
        }
        return error;
    };

    const invalidFields = !record ||
        onValidateId(record.id);
    const isInvalid = validate && invalidFields;

    const onSubmit = async () => {
        setValidate(true);
        if (!invalidFields && !inProgress) {
            setProgress(true);
            await setData(record, toPath(record.id));
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
                    record.tags = record.tags || {};
                    const values = record.tags[item.id] = record.tags[item.id] || {};
                    values[language] = value;
                    return { ...record };
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
            onClick: mode !== "rename" && enableItemClick && renameItem
        }
    ];

    const mapper = tagId => {
        const tag = tags.find(tag => tag.id === tagId);
        const item = { ...tag, id: tagId };
        const translation = item[language];
        if (translation) {
            item.name = translation;
        }
        if (!item.name) {
            item.name = item.id.split(".").pop();
        }
        const recordTags = record.tags || {};
        const values = recordTags[tagId] || {};
        item.value = values[language];
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
            disabled={!!(isInvalid || inProgress || !record)}
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

    };

    const size = useSize(ref, [showSideBar], false);
    const readOnly = !!contentId;

    return <>
        <Form actions={actions} loading={loading} data={record} validate={validate}>
            <FormGroup record={record} setRecord={setRecord}>
                <Input
                    id="id"
                    label={translations.ID}
                    onValidate={onValidateId}
                    readOnly={readOnly}
                />
            </FormGroup>
            <div ref={ref} className={styles.table}>
                <Table
                    name={record.id || "content"}
                    size={size}
                    loading={busy}
                    store={ContentStore}
                    onImport={onImport}
                    columns={columns}
                    data={uniqueTags}
                    viewModes={{
                        list: {
                            className: styles.listItem
                        },
                        table: null
                    }}
                    mapper={mapper}
                    depends={[mode, translations, record, uniqueTags, language, viewMode]}
                />
            </div>
        </Form>
    </>;
}
