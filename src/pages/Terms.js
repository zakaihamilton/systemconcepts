import Table from "@/widgets/Table";
import data from "@/data/terms";
import { useTranslations } from "@/util/translations";
import { useLanguage } from "@/util/language";
import Term from "@/widgets/Term";
import { useState } from "react";

export default function Terms() {
    const translations = useTranslations();
    const language = useLanguage();
    const [typeFilter, setTypeFilter] = useState("");
    const [phaseFilter, setPhaseFilter] = useState("");

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
            tags: [phaseFilter && {
                id: phaseFilter,
                name: <Term id={phaseFilter} />,
                onDelete: () => setPhaseFilter("")
            }]
        },
        {
            id: "typeWidget",
            title: translations.TYPE,
            sortable: "type",
            tags: [typeFilter && {
                id: typeFilter,
                name: <Term id={typeFilter} />,
                onDelete: () => setTypeFilter("")
            }]
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
            phaseWidget: <Term id={"phase." + phase} onClick={!phaseFilter && (() => setPhaseFilter("phase." + phase))} />,
            typeWidget: <Term id={type} onClick={!typeFilter && (() => setTypeFilter(type))} />
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
            data={data}
            rowHeight="5em"
            sortColumn="sortId"
            reset={[typeFilter, phaseFilter]}
            depends={[typeFilter, phaseFilter]} />
    </>;
}
