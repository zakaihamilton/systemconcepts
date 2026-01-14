import React, { useMemo } from "react";
import { useTranslations } from "@util/translations";
import { useSessions } from "@util/sessions";
import Table from "@widgets/Table";
import { Store } from "pullstate";
import FilterBar from "@pages/Sessions/FilterBar";
import styles from "../Tags.module.scss";
import Chip from "@mui/material/Chip";

export const TagsStore = new Store({
    order: "asc",
    offset: 0,
    orderBy: "name",
    viewMode: "list"
});

export default function Sessions() {
    const translations = useTranslations();
    const [sessions] = useSessions([], true);
    const { order, orderBy } = TagsStore.useState();

    const columns = [
        {
            id: "group",
            title: translations.GROUP,
            sortable: true,
            columnProps: {
                style: {
                    width: "8em"
                }
            }
        },
        {
            id: "date",
            title: translations.DATE,
            sortable: true,
            columnProps: {
                style: {
                    width: "10em"
                }
            }
        },
        {
            id: "name",
            title: translations.SESSION,
            sortable: true,
            columnProps: {
                style: {
                    width: "20em"
                }
            }
        },
        {
            id: "tags",
            title: translations.TAGS,
            sortable: false
        }
    ];

    const data = useMemo(() => {
        return sessions.map(session => {
            const tags = session.tags || [];
            return {
                ...session,
                group: session.group,
                date: session.date,
                name: session.name,
                tags: tags.length ? (
                    <div className={styles.tags}>
                        {tags.map(tag => (
                            <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                className={styles.tag}
                                style={{ "--group-color": session.color }}
                            />
                        ))}
                    </div>
                ) : null
            };
        });
    }, [sessions]);

    const sortedData = useMemo(() => {
        return data.sort((a, b) => {
            const aValue = a[orderBy];
            const bValue = b[orderBy];
            if (aValue < bValue) {
                return order === "asc" ? -1 : 1;
            }
            if (aValue > bValue) {
                return order === "asc" ? 1 : -1;
            }
            return 0;
        });
    }, [data, order, orderBy]);

    return (
        <div className={styles.root}>
            <FilterBar />
            <Table
                name="tags"
                store={TagsStore}
                columns={columns}
                data={sortedData}
                viewModes={{
                    list: {
                        className: styles.list
                    },
                    table: null
                }}
            />
        </div>
    );
}
