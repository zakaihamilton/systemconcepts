import Table from "@/widgets/Table";
import data from "@/data/terms";
import { useTranslations } from "@/util/translations";
import { useLanguage } from "@/util/language";
import Term from "@/widgets/Term";
import styles from "./Terms.module.scss";

import { Store } from "pullstate";

export const TermsStore = new Store({
    order: "desc",
    offset: 0,
    orderBy: "sortId",
    typeFilter: "",
    phaseFilter: "",
    viewMode: "list"
});

export default function Terms() {
    const translations = useTranslations();
    const language = useLanguage();
    const { typeFilter, phaseFilter } = TermsStore.useState();

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        },
        {
            id: "phaseWidget",
            title: translations.PHASE,
            sortable: "phase",
            selected: () => phaseFilter,
            onSelectable: item => typeof item.phase !== "undefined" && !phaseFilter,
            onClick: item => TermsStore.update(s => {
                if (s.phaseFilter) {
                    s.phaseFilter = "";
                }
                else {
                    s.phaseFilter = typeof item.phase !== "undefined" && "phase." + item.phase;
                }
                s.offset = 0;
            })
        },
        {
            id: "typeWidget",
            title: translations.TYPE,
            sortable: "type",
            selected: () => typeFilter,
            onSelectable: item => item.type && !typeFilter,
            onClick: item => TermsStore.update(s => {
                if (s.typeFilter) {
                    s.typeFilter = "";
                }
                else {
                    s.typeFilter = typeof item.type !== "undefined" && item.type;
                }
                s.offset = 0;
            }),
        }
    ];

    const mapper = item => {
        let { id, name, type, phase } = item;
        let sortId = [type, phase, id].filter(item => typeof item !== "undefined").join(".");
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
            sortId,
            name,
            nameWidget: <Term id={id} />,
            phaseWidget: <Term id={"phase." + phase} />,
            typeWidget: <Term id={type} />
        };
    };

    const filter = item => {
        let { type, phase } = item;
        let show = !typeFilter || typeFilter === type;
        show = show && (!phaseFilter || phaseFilter === "phase." + phase);
        return show;
    };

    return <>
        <Table
            name="terms"
            columns={columns}
            mapper={mapper}
            filter={filter}
            viewModes={["list","table"]}
            data={data}
            itemProps={{
                className: styles.item
            }}
            rowHeight="5.5em"
            itemHeight="4em"
            store={TermsStore}
            depends={[typeFilter, phaseFilter, translations]} />
    </>;
}
