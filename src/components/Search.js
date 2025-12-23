import { useEffect, useState, useRef } from "react";
import InputBase from "@mui/material/InputBase";
import styles from "./Search.module.scss";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslations } from "@util/translations";
import { Store } from "pullstate";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import { useTimeout } from "@util/timers";
import { useDeviceType } from "@util/styles";
import clsx from "clsx";

registerToolbar("Search", 200);

export const SearchStore = new Store({
    search: {}
});

export function useSearch(name, updateCallback) {
    const isPhone = useDeviceType() === "phone";
    if (typeof name === "function") {
        updateCallback = name;
        name = "default";
    }
    name = name || "default";
    const { search } = SearchStore.useState();
    const searchTerm = search[name] || "";
    const [value, setValue] = useState(searchTerm);
    const [focused, setFocused] = useState(false);
    const translations = useTranslations();
    const inputRef = useRef(null);
    useTimeout(() => {
        SearchStore.update(s => {
            s.search[name] = value;
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
            element: <div className={clsx(styles.search, (focused || value) && styles.searchExpanded)} onClick={() => {
                if (!focused && inputRef.current) {
                    inputRef.current.focus();
                }
            }}>
                <div className={styles.searchIcon}>
                    <SearchIcon />
                </div>
                <InputBase
                    inputRef={inputRef}
                    placeholder={translations.SEARCH + "…"}
                    value={value}
                    onChange={onChangeText}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    type="search"
                    classes={{
                        root: styles.inputRoot
                    }}
                    inputProps={{ "aria-label": "search" }}
                />
            </div>
        }
    ].filter(Boolean);

    useToolbar({ id: "Search", items: toolbarItems, depends: [search, value, isPhone, translations, focused] });

    return searchTerm;
}
