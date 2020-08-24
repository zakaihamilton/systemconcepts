import { useTranslations } from "@/util/translations";

export function getRoleSection({ translations, index, path }) {
    if (index) {
        return { name: path };
    }
    else if (!path) {
        return { name: translations.NEW_ROLE };
    }
}

export default function Role({ path = "" }) {
    const translations = useTranslations();

    return <>

    </>;
}
