import Table from "@/widgets/Table";
import languages from "@/data/languages";
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";

export const TranslationsStore = new Store({
    order: "desc",
    offset: 0,
    orderBy: ""
});

export default function Translations({ language: languageId }) {
    const translations = useTranslations();
    const language = languageId && languages.find(item => item.id === languageId);
    const data = language && language.translations;

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
        <Table
            name="translations"
            columns={columns}
            data={data}
            store={TranslationsStore}
        />
    </>;
}
