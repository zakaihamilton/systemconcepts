import { useState, useEffect } from "react";
import { useTranslations } from "@util/translations";
import Form, { FormGroup } from "@widgets/Form";
import Input from "@widgets/Input";
import Button from '@material-ui/core/Button';
import { goBackPage } from "@util/pages";
import { useTag } from "@util/tags";
import LocalOfferIcon from '@material-ui/icons/LocalOffer';
import languages from "@data/languages";

export default function Tag({ tag = "" }) {
    const translations = useTranslations();
    const [record, loading, setRecord] = useTag({ id: tag });
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);
    const [data, setData] = useState({});

    useEffect(() => {
        setData(record || {});
    }, [record]);

    const onValidateId = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
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

    const languageItems = languages.map(language => {
        return <Input
            id={language.id}
            label={language.name}
        />
    });

    return <Form actions={actions} loading={loading || inProgress} data={data} validate={validate}>
        <FormGroup record={data} setRecord={setData}>
            <Input
                id="id"
                label={translations.ID}
                onValidate={onValidateId}
                icon={<LocalOfferIcon />}
            />
        </FormGroup>
        <FormGroup record={data} setRecord={setData}>
            {languageItems}
        </FormGroup>
    </Form>;
}
