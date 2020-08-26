import { useTranslations } from "@/util/translations";
import Form, { FormGroup } from "@/widgets/Form";
import EmailIcon from '@material-ui/icons/Email';
import Input from "@/widgets/Input";
import Button from '@material-ui/core/Button';
import { goBackPage } from "@/util/pages";
import roles from "@/data/roles";
import { useFetchJSON, fetchJSON } from "@/util/fetch";
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import RecentActorsIcon from '@material-ui/icons/RecentActors';

export function getUserSection({ translations, index, path }) {
    if (index) {
        return { name: path };
    }
}

export default function User({ path = "" }) {
    const translations = useTranslations();
    const [data, , loading] = useFetchJSON("/api/users", { headers: { id: path } });

    const roleTypeMapping = item => {
        return {
            ...item,
            name: translations[item.name]
        }
    };

    const onSubmit = () => {
        fetchJSON("/api/users", { method: "PUT", headers: { id: path }, body: JSON.stringify(data) });
        goBackPage();
    };

    const onCancel = () => {
        goBackPage();
    };

    const actions = [
        <Button
            onClick={onSubmit}
            variant="contained"
            color="primary"
            size="large"
        >
            {translations.SAVE}
        </Button>,
        <Button
            onClick={onCancel}
            variant="contained"
            color="primary"
            size="large"
        >
            {translations.CANCEL}
        </Button>];

    return <Form actions={actions} loading={loading}>
        <FormGroup record={data}>
            <Input
                id="id"
                label={translations.ID}
                autoFocus
                icon={<AccountCircleIcon />}
            />
            <Input
                id="email"
                label={translations.EMAIL_ADDRESS}
                icon={<EmailIcon />}
            />
            <Input
                id="firstName"
                label={translations.FIRST_NAME}
            />
            <Input
                id="lastName"
                label={translations.LAST_NAME}
            />
            <Input
                id="role"
                icon={<RecentActorsIcon />}
                label={translations.ROLE}
                items={roles}
                mapping={roleTypeMapping}
                select={true} />
        </FormGroup>
    </Form>;
}
