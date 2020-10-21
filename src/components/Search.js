import { useEffect, useState } from 'react';
import InputBase from '@material-ui/core/InputBase';
import styles from "./Search.module.scss";
import SearchIcon from '@material-ui/icons/Search';
import { useTranslations } from "@/util/translations";
import { Store } from "pullstate";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import { useTimer } from "@/util/timers";
import { useDeviceType } from "@/util/styles";

registerToolbar("Search");

export const SearchStore = new Store({
    search: "",
    show: 0
});

export function useSearch(updateCallback) {
    const { search } = SearchStore.useState();
    useEffect(() => {
        SearchStore.update(s => {
            s.show++;
        });
        const unsubscribe = SearchStore.subscribe(s => s.search, updateCallback);
        return () => {
            SearchStore.update(s => {
                s.show--;
            });
            unsubscribe();
        };
    }, []);
    return { search };
}

export default function Search() {
    const isPhone = useDeviceType() === "phone";
    const { search, show } = SearchStore.useState();
    const [value, setValue] = useState(search || "");
    const { SEARCH } = useTranslations();
    useTimer(() => {
        SearchStore.update(s => {
            s.search = value;
        });
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
                    placeholder={SEARCH + "…"}
                    value={value}
                    onChange={onChangeText}
                    type="search"
                    classes={{
                        root: styles.inputRoot,
                        input: styles.inputInput,
                    }}
                    inputProps={{ 'aria-label': 'search' }}
                />
            </div>
        }
    ].filter(Boolean);

    useToolbar({ id: "Search", items: toolbarItems, visible: show, depends: [search, value] });

    return null;
}
