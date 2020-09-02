import Table from "@/widgets/Table";
import data from "@/data/terms";
import { useTranslations } from "@/util/translations";
import { useLanguage } from "@/util/language";
import Term from "@/widgets/Term";

export default function Terms() {
    const translations = useTranslations();
    const language = useLanguage();

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        }
    ];

    const mapper = item => {
        let { id, name, type } = item;
        if (typeof name === "object") {
            name = name[language];
        }
        else if (typeof name === "string") {
            name = translations[name];
        }
        if (type) {
            id = type + "." + id;
        }
        return {
            ...item,
            name,
            nameWidget: <Term id={id} />
        };
    };

    return <>
        <Table name="terms" columns={columns} mapper={mapper} data={data} rowHeight="5em" />
    </>;
}
