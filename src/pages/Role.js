import { useTranslations } from "@/util/translations";
import Form from "@/widgets/Form";
import Input from "@/widgets/Input";

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

    return <Form>
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
    </Form>;
}
