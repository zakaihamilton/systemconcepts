import Table from "@widgets/Table";
import languages from "@data/languages";
import { useTranslations } from "@util/translations";
import { Store } from "pullstate";
import styles from "./Translations.module.scss";
import { useLocalStorage } from "@util/store";

export const TranslationsStore = new Store({
    order: "desc",
    offset: 0,
    orderBy: ""
});

export function getTranslationsSection({ language: languageId }) {
    if (languageId) {
        const language = languageId && languages.find(item => item.id === languageId);
        return { name: language.name };
    }
}

export default function Translations({ language: languageId }) {
    const translations = useTranslations();
    const language = languageId && languages.find(item => item.id === languageId);
    const data = language && language.translations;
    useLocalStorage("TranslationsStore", TranslationsStore, ["viewMode"]);

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
            viewModes={{
                list: {
                    className: styles.listItem
                },
                table: null
            }}
        />
    </>;
}
