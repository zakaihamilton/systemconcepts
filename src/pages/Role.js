import { useTranslations } from "@/util/translations";
import Form, { FormGroup } from "@/widgets/Form";
import Input from "@/widgets/Input";
import Button from '@material-ui/core/Button';
import { goBackPage } from "@/util/pages";

export function getRoleSection({ translations, index, path }) {
    if (index) {
        return { name: path };
    }
    else if (!path) {
        return { name: translations.NEW_ROLE };
    }
}

export const roleTypes = [
    {
        id: "admin",
        name: "ADMIN"
    },
    {
        id: "student",
        name: "STUDENT"
    },
    {
        id: "upper",
        name: "UPPER"
    },
    {
        id: "teacher",
        name: "TEACHER"
    }
];

export default function Role({ path = "" }) {
    const translations = useTranslations();

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

    return <Form actions={actions}>
        <FormGroup>
            <Input
                id="id"
                label={translations.ID}
                autoFocus />
            <Input
                id="type"
                label={translations.TYPE}
                items={roleTypes}
                mapping={roleTypeMapping}
                select={true} />
        </FormGroup>
    </Form>;
}
