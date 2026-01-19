import { useState, useRef, useMemo, useCallback, useEffect } from "react";
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

export function SearchWidget({ isDesktop, translations, placeholder, defaultValue, onChange }) {
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    // Update expanded class via DOM to avoid recreating the element
    useEffect(() => {
        if (containerRef.current) {
            if (isDesktop || focused) {
                containerRef.current.classList.add(styles.searchExpanded);
            } else {
                containerRef.current.classList.remove(styles.searchExpanded);
            }
        }
    }, [isDesktop, focused]);

    const handleFocus = useCallback(() => setFocused(true), []);
    const handleBlur = useCallback(() => setFocused(false), []);
    const handleClick = useCallback(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    return (
        <div ref={containerRef} className={clsx(styles.search, isDesktop && styles.searchExpanded)} onClick={handleClick}>
            <div className={styles.searchIcon}>
                <SearchIcon />
            </div>
            <InputBase
                inputRef={inputRef}
                placeholder={placeholder}
                defaultValue={defaultValue}
                onChange={onChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                type="search"
                classes={{
                    root: styles.inputRoot
                }}
                inputProps={{ "aria-label": "search" }}
            />
        </div>
    );
}

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
    const translations = useTranslations();
    // Track initial value for uncontrolled input
    const [initialValue] = useState(searchTerm);

    useTimeout(() => {
        SearchStore.update(s => {
            s.search[effectiveName] = value;
        });
        effectiveUpdateCallback && effectiveUpdateCallback(value);
    }, 1000, [value]);

    const onChangeText = useCallback(event => {
        setValue(event.target.value);
    }, []);

    // Wrap the search UI in a component so that we don't pass refs directly through the ToolbarStore.
    // This prevents Pullstate/Immer from freezing the ref objects.
    const searchElement = useMemo(() => (
        <SearchWidget
            isDesktop={isDesktop}
            translations={translations}
            placeholder={translations.SEARCH + "…"}
            defaultValue={initialValue}
            onChange={onChangeText}
        />
    ), [isDesktop, translations, initialValue, onChangeText]);

    const toolbarItems = useMemo(() => [
        {
            id: "search",
            menu: false,
            sortKey: -1,
            location: isPhone && "header",
            element: searchElement
        }
    ], [isPhone, searchElement]);

    useToolbar({ id: "Search", items: toolbarItems, depends: [isPhone, deviceType] });

    return searchTerm;
}
