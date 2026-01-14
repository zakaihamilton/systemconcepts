import React, { useMemo, useCallback } from "react";
import { useTranslations } from "@util/translations";
import { useSessions } from "@util/sessions";
import Table from "@widgets/Table";
import { Store } from "pullstate";
import FilterBar from "@pages/Sessions/FilterBar";
import styles from "../Tags.module.scss";
import Chip from "@mui/material/Chip";
import Row from "@widgets/Row";
import SessionIcon from "@widgets/SessionIcon";
import { toPath, addPath } from "@util/pages";

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

    const itemPath = item => {
        return `session?group=${item.group}&year=${item.year}&date=${item.date}&name=${encodeURIComponent(item.name)}`;
    };

    const target = useCallback(item => {
        return "#" + toPath("sessions", itemPath(item));
    }, []);

    const gotoItem = useCallback(item => {
        addPath(itemPath(item));
    }, []);

    const renderColumn = useCallback((columnId, item) => {
        if (columnId === "name") {
            const icon = (
                <div className={styles.icon}>
                    <SessionIcon type={item.type} />
                </div>
            );
            const href = target(item);
            return <Row href={href} onClick={() => gotoItem(item)} icons={icon}>{item.name}</Row>;
        }
        return item[columnId];
    }, [target, gotoItem]);

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
                renderColumn={renderColumn}
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
