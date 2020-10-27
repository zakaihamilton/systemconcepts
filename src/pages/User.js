import { useState } from "react";
import { useTranslations } from "@util/translations";
import Form, { FormGroup } from "@widgets/Form";
import EmailIcon from '@material-ui/icons/Email';
import Input from "@widgets/Input";
import Button from '@material-ui/core/Button';
import { goBackPage } from "@util/pages";
import roles from "@data/roles";
import { useFetchJSON, fetchJSON } from "@util/fetch";
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import RecentActorsIcon from '@material-ui/icons/RecentActors';
import { useParentPath } from "@util/pages";

export function getUserSection({ sectionIndex, name }) {
    if (sectionIndex) {
        return { name };
    }
}

export default function User({ path = "" }) {
    const translations = useTranslations();
    const parentPath = useParentPath();
    const editAccount = parentPath === "#account";
    const [data, setData, loading] = useFetchJSON("/api/users", { headers: { id: path } });
    const [validate, setValidate] = useState(false);
    const [inProgress, setProgress] = useState(false);
    const [error, setError] = useState(false);

    const roleTypeMapping = item => {
        return {
            ...item,
            name: translations[item.name]
        }
    };

    const onValidateEmail = text => {
        let error = "";
        const emailPattern = /[a-zA-Z0-9]+[\.]?([a-zA-Z0-9]+)?[\@][a-z]{3,25}[\.][a-z]{2,5}/g;
        if (!text) {
            error = translations.EMPTY_EMAIL;
        }
        else if (!emailPattern.test(text)) {
            error = translations.BAD_EMAIL;
        }
        return error;
    };

    const onValidateField = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
        }
        return error;
    };

    const onValidateId = text => {
        let error = "";
        if (!text) {
            error = translations.EMPTY_FIELD;
        }
        if (!text.match(/^[a-z0-9]+$/i)) {
            error = translations.BAD_ID;
        }
        return error;
    };

    const invalidFields = !data ||
        onValidateEmail(data.email) ||
        onValidateField(data.firstName) ||
        onValidateField(data.lastName) ||
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
        <FormGroup record={data} setRecord={setData}>
            {!editAccount && <Input
                id="id"
                label={translations.ID}
                onValidate={onValidateId}
                icon={<AccountCircleIcon />}
            />}
            <Input
                id="email"
                label={translations.EMAIL_ADDRESS}
                icon={<EmailIcon />}
                onValidate={onValidateEmail}
            />
            <Input
                id="firstName"
                label={translations.FIRST_NAME}
                onValidate={onValidateField}
            />
            <Input
                id="lastName"
                label={translations.LAST_NAME}
                onValidate={onValidateField}
            />
            {!editAccount && <Input
                id="role"
                icon={<RecentActorsIcon />}
                label={translations.ROLE}
                items={roles}
                mapping={roleTypeMapping}
                select={true} />}
        </FormGroup>
    </Form>;
}
