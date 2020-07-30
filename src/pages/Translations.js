import Table from "@/widgets/Table";
import data from "@/data/translations";
import languages from "@/data/languages";
import { useTranslations } from "@/util/translations";

export default function Languages({ language: languageId }) {
    console.log(languageId);
    const translations = useTranslations();

    const columns = [
        {
            id: "id",
            title: translations.ID,
            sortable: true
        },
        ...languages.filter(({ id }) => !languageId || languageId === id).map(({ id, name, direction }) => ({
            id,
            title: name,
            sortable: true,
            dir: direction
        }))
    ];

    const items = [];
    data.forEach(({ id, value, language }) => {
        if (languageId && languageId !== language) {
            return;
        }
        const item = items.find(item => item.id === id);
        if (item) {
            item[language] = value;
        }
        else {
            items.push({ id, [language]: value });
        }
    });

    return <>
        <Table columns={columns} items={items} />
    </>;
}
