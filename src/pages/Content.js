import { useState, useCallback } from "react";
import { useTranslations } from "@util/translations";
import Form, { FormGroup } from "@widgets/Form";
import Input from "@widgets/Input";
import Button from '@material-ui/core/Button';
import { goBackPage } from "@util/pages";
import { useFile } from "@util/storage";
import { useContent } from "@util/content";

export default function Content({ path = "" }) {
    const contentId = path;
    const translations = useTranslations();
    const { write } = useContent({ counter: 0 });
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [data, loading, setData] = useFile("content/" + contentId, [contentId], data => {
        return data ? JSON.parse(data) : {};
    });

    const updateData = useCallback(data => {
        for (const tag of data.tags) {
            write(tag, data.id);
        }
        setData(data);
    }, [write]);

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

    const invalidFields = !data ||
        onValidateId(data.id);
    const isInvalid = validate && invalidFields;

    const onSubmit = () => {
        setValidate(true);
        if (!invalidFields && !inProgress) {
            setProgress(true);
            fetchJSON("/api/users", {
                method: "PUT",
                body: JSON.stringify(data)
            }).then(({ err }) => {
                if (err) {
                    console.error(err);
                    throw err;
                }
                goBackPage();
                setProgress(false);
                setError("");
            }).catch(err => {
                setError(translations[err] || String(err));
                setProgress(false);
            });
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

    return <Form actions={actions} loading={loading} data={data} validate={validate}>
        <FormGroup record={data} setRecord={updateData}>
            <Input
                id="id"
                label={translations.ID}
                onValidate={onValidateId}
            />
        </FormGroup>
    </Form>;
}
