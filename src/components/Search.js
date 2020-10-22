import { useEffect, useState } from 'react';
import InputBase from '@material-ui/core/InputBase';
import styles from "./Search.module.scss";
import SearchIcon from '@material-ui/icons/Search';
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import { useTimer } from "@/util/timers";
import { useDeviceType } from "@/util/styles";

registerToolbar("Search", 100);

export const SearchStore = new Store({
    search: ""
});

export function useSearch(updateCallback) {
    const isPhone = useDeviceType() === "phone";
    const { search } = SearchStore.useState();
    const [value, setValue] = useState(search || "");
    const translations = useTranslations();
    useTimer(() => {
        SearchStore.update(s => {
            s.search = value;
        });
        updateCallback && updateCallback(value);
    }, 500, [value]);

    const onChangeText = event => {
        const { value } = event.target;
        setValue(value);
    };

    const toolbarItems = [
        {
            id: "search",
            divider: true,
            menu: false,
            location: isPhone && "header",
            element: <div className={styles.search}>
                <div className={styles.searchIcon}>
                    <SearchIcon />
                </div>
                <InputBase
                    placeholder={translations.SEARCH + "…"}
                    value={value}
                    onChange={onChangeText}
                    type="search"
                    classes={{
                        root: styles.inputRoot
                    }}
                    inputProps={{ 'aria-label': 'search' }}
                />
            </div>
        }
    ].filter(Boolean);

    useToolbar({ id: "Search", items: toolbarItems, depends: [search, value, isPhone, translations] });

    return search;
}
