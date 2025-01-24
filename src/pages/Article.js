import { useState, useEffect, useRef } from "react";
import { useTranslations } from "@util/translations";
import Form, { FormGroup } from "@widgets/Form";
import Input from "@widgets/Input";
import Button from "@mui/material/Button";
import { goBackPage, addPath } from "@util/pages";
import { useFile } from "@util/storage";
import { createID, useArticle } from "@util/articles";
import { useLanguage } from "@util/language";
import { Store } from "pullstate";
import { useLocalStorage } from "@util/store";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { useTags } from "@util/tags";
import { useTypes } from "@util/types";
import StyleIcon from "@mui/icons-material/Style";

registerToolbar("Article");

export const ArticleStoreDefaults = {
    viewMode: "list",
    name: "",
    value: "",
    counter: 1,
    onDone: null,
    order: "desc",
    offset: 0,
    orderBy: ""
};

export const ArticleStore = new Store(ArticleStoreDefaults);

export default function Article({ path = "" }) {
    const language = useLanguage();
    const articleId = path;
    const translations = useTranslations();
    const { counter, viewMode = "table", mode } = ArticleStore.useState();
    const [tags] = useTags({ counter });
    const [types] = useTypes({ counter });
    const { toPath } = useArticle({ counter });
    const [inProgress, setProgress] = useState(false);
    const [data, loading, , setData] = useFile(articleId && (toPath(articleId) + "/tags.json"), [articleId], data => {
        return data ? JSON.parse(data) : {};
    });
    const ref = useRef();
    const [record, setRecord] = useState({});
    useLocalStorage("ArticleStore", ArticleStore, ["viewMode"]);

    useEffect(() => {
        ArticleStore.update(s => {
            Object.assign(s, ArticleStoreDefaults);
        });
    }, []);

    useEffect(() => {
        setRecord(data || {});
    }, [data]);

    useEffect(() => {
        if (!articleId) {
            setRecord(record => {
                record.id = createID();
                return record;
            });
        }
    }, [articleId]);

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

    const tagMapping = item => {
        return {
            ...item,
            name: item[language]
        };
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

    const gotoEditor = () => {
        addPath("editor/" + toPath(record.id) + "/" + language + ".txt");
    };

    const toolbarItems = [
        articleId && {
            id: "editor",
            name: translations.EDITOR,
            icon: <InsertDriveFileIcon />,
            onClick: gotoEditor,
            location: "header"
        }
    ].filter(Boolean);

    useToolbar({ id: "Article", items: toolbarItems, depends: [articleId, language] });

    const tagItems = (types || []).map(type => {
        if (type.field === "TAG") {
            const filteredTags = tags.filter(tag => tag.type === type.id);
            return <Input
                key={type.id}
                id={type.id}
                icon={<StyleIcon />}
                label={type[language]}
                items={filteredTags}
                mapping={tagMapping}
                select={true} />;
        }
        else if (type.field === "NUMBER") {
            return <Input
                key={type.id}
                id={type.id}
                label={type[language]}
                type="number" />;
        }
        else if (type.field === "TEXT") {
            return <Input
                key={type.id}
                id={type.id}
                field={language}
                label={type[language]} />;
        }
    }).filter(Boolean);

    return <>
        <Form actions={actions} loading={loading} data={record}>
            <FormGroup record={record} setRecord={setRecord}>
                <Input
                    id="id"
                    label={translations.ID}
                    readOnly={true}
                />
            </FormGroup>
            <FormGroup record={record} setRecord={setRecord}>
                {tagItems}
            </FormGroup>
        </Form>
    </>;
}
