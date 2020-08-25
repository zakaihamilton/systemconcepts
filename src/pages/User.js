import { useTranslations } from "@/util/translations";
import Form, { FormGroup } from "@/widgets/Form";
import Input from "@/widgets/Input";
import Button from '@material-ui/core/Button';
import { goBackPage } from "@/util/pages";
import roles from "@/data/roles";
import { useFetchJSON } from "@/util/fetch";

export function getUserSection({ translations, index, path }) {
    if (index) {
        return { name: path };
    }
    else if (!path) {
        return { name: translations.NEW_ROLE };
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
        goBackPage();
    };

    const actions = (<Button
        onClick={onSubmit}
        variant="contained"
        color="primary"
        size="large"
    >
        {translations.SAVE}
    </Button>)

    return <Form actions={actions} loading={loading}>
        <FormGroup record={data}>
            <Input
                id="id"
                label={translations.ID}
                autoFocus
            />
            <Input
                id="email"
                label={translations.EMAIL_ADDRESS}
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
                id="roleType"
                label={translations.ROLE}
                items={roles}
                mapping={roleTypeMapping}
                select={true} />
        </FormGroup>
    </Form>;
}
