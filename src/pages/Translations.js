import Table from "@/widgets/Table";
import data from "@/data/translations";
import languages from "@/data/languages";
import { useTranslations } from "@/util/translations";

export default function Languages() {
    const translations = useTranslations();

    const columns = [
        {
            id: "id",
            title: translations.COLUMN_ID,
            sortable: true
        },
        ...languages.map(({ id, name, direction }) => ({
            id,
            title: name,
            sortable: true,
            dir: direction
        }))
    ];

    const items = [];
    data.forEach(({ id, value, language }) => {
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
