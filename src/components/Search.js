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
    const deviceType = useDeviceType();
    const isPhone = deviceType === "phone";
    const isDesktop = deviceType === "desktop";
    let effectiveName = name;
    let effectiveUpdateCallback = updateCallback;
    if (typeof effectiveName === "function") {
        effectiveUpdateCallback = effectiveName;
        effectiveName = "default";
    }
    effectiveName = effectiveName || "default";
    const { search } = SearchStore.useState();
    const searchTerm = search[effectiveName] || "";
    const [value, setValue] = useState(searchTerm);
    const [focused, setFocused] = useState(false);
    const translations = useTranslations();
    const inputRef = useRef(null);
    useTimeout(() => {
        SearchStore.update(s => {
            s.search[effectiveName] = value;
        });
        effectiveUpdateCallback && effectiveUpdateCallback(value);
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
            sortKey: -1,
            location: isPhone && "header",
            element: <div className={clsx(styles.search, (isDesktop || focused || value) && styles.searchExpanded)} onClick={() => {
                if (!focused && inputRef.current) {
                    inputRef.current.focus();
                }
            }}>
                <div className={styles.searchIcon}>
                    <SearchIcon />
                </div>
                <InputBase
                    inputRef={node => {
                        inputRef.current = node;
                    }}
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

    useToolbar({ id: "Search", items: toolbarItems, depends: [search, value, isPhone, translations, focused, deviceType] });

    return searchTerm;
}
