import Table from "@/widgets/Table";
import languages from "@/data/languages";
import { useTranslations } from "@/util/translations";

export default function Languages({ language: languageId }) {
    const translations = useTranslations();
    const language = languageId && languages.find(item => item.id === languageId);
    const items = language && language.translations;

    const columns = [
        {
            id: "id",
            title: translations.ID,
            sortable: true
        },
        language && {
            id: "value",
            title: language.name,
            sortable: true,
            dir: language.direction
        }
    ].filter(Boolean);

    return <>
        <Table name="translations" columns={columns} items={items} />
    </>;
}
