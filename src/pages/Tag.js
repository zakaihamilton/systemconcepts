import { useState, useEffect, useRef } from "react";
import { useTranslations } from "@util/translations";
import Form, { FormGroup } from "@widgets/Form";
import Input from "@widgets/Input";
import Button from "@material-ui/core/Button";
import { goBackPage } from "@util/pages";
import { useTag } from "@util/tags";
import { useTypes } from "@util/types";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import languages from "@data/languages";
import { useLanguage } from "@util/language";
import { Store } from "pullstate";
import StyleIcon from "@material-ui/icons/Style";

export const TagStoreDefaults = {
    mode: "",
    select: [],
    counter: 1,
    onDone: null,
    offset: 0,
    viewMode: "list"
};

export const TagStore = new Store(TagStoreDefaults);

export default function Tag({ path = "" }) {
    const language = useLanguage();
    const translations = useTranslations();
    const [record, loading, setRecord] = useTag({ id: path });
    const [types] = useTypes({});
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);
    const [data, setData] = useState({});
    const ref = useRef();

    useEffect(() => {
        setData(record || {});
    }, [record]);

    const onValidateId = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
        }
        else if (!text.match(/^[a-z.0-9]+$/i)) {
            error = translations.BAD_ID;
        }
        return error;
    };

    const invalidFields = !data ||
        onValidateId(data.id);
    const isInvalid = validate && invalidFields;

    const onSubmit = async () => {
        setValidate(true);
        if (!invalidFields && !inProgress) {
            setProgress(true);
            await setRecord(data);
            goBackPage();
            setProgress(false);
            setError("");
        }
    };

    const onCancel = () => {
        goBackPage();
    };

    const actions = <>
        <Button
            onClick={onSubmit}
            variant="contained"
            color="primary"
            size="large"
            disabled={!!(isInvalid || inProgress || !data)}
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

    const languageItem = languages.find(item => item.id === language) || {};
    const languageName = languageItem.name;

    const typeMapping = item => {
        return {
            ...item,
            name: item[language]
        };
    };

    return <Form actions={actions} loading={loading || inProgress} data={data} validate={validate}>
        <FormGroup record={data} setRecord={setData}>
            <Input
                id="id"
                label={translations.ID}
                onValidate={onValidateId}
                icon={<LocalOfferIcon />}
            />
            <Input
                id={language}
                label={translations.NAME}
            />
            <Input
                id="type"
                icon={<StyleIcon />}
                label={translations.TYPE}
                items={types}
                mapping={typeMapping}
                select={true} />
        </FormGroup>
    </Form>;
}
