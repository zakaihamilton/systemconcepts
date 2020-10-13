import { useEffect, useCallback, useState } from "react";
import Table from "@/widgets/Table";
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";
import { useFile } from "@/util/storage";

export const GroupsStore = new Store({
    counter: 0
});

export default function Groups() {
    const translations = useTranslations();
    const [error, setError] = useState(false);
    const { counter } = GroupsStore.useState();
    const [listing, loading] = useFile("shared/sessions/listing.json", [counter], data => {
        return data ? JSON.parse(data) : {};
    });

    const columns = [
        {
            id: "nameWidget",
            title: translations.NAME,
            sortable: "name"
        }
    ];

    const mapper = item => {

        return {
            ...item,
            nameWidget: item.name[0].toUpperCase() + item.name.slice(1)
        };
    };

    const data = listing;

    return <>
        <Table
            name="groups"
            store={GroupsStore}
            columns={columns}
            data={data}
            refresh={() => {
                GroupsStore.update(s => {
                    s.counter++;
                });
            }}
            mapper={mapper}
            loading={loading}
            depends={[translations]}
            rowHeight="6em"
        />
    </>;
}
