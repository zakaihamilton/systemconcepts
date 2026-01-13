import React from "react";
import { MainStore } from "@components/Main";
import { LibraryStore } from "./Store";
import { LibraryIcons, LibraryTagKeys } from "./Icons";

export function getLibrarySection({ id, path, translations }) {
    const { tags } = LibraryStore.getRawState();

    const onClick = () => {
        MainStore.update(s => {
            s.showLibrarySideBar = !s.showLibrarySideBar;
        });
    };

    const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
    const name = decodeURIComponent(id || segments[segments.length - 1]);

    // Identify if this is the root "Library" breadcrumb
    const isRoot = name && name.toLowerCase() === "library";

    if (isRoot) {
        let label = translations.LIBRARY || "Library";
        if (label && typeof label === "string" && label.length > 0) {
            label = label.charAt(0).toUpperCase() + label.slice(1);
        }
        const RootIcon = LibraryIcons.library;
        return {
            name: label,
            label: label,
            tooltip: label,
            Icon: RootIcon,
            icon: RootIcon && <RootIcon />,
            onClick
        };
    }

    let description = "";
    let SelectedIcon = null;

    if (tags && tags.length > 0) {
        // Robust matching to find the relevant tag and its field type
        const tag = tags.find(t =>
            LibraryTagKeys.some(key => {
                const val = t[key];
                return val && String(val).trim().toLowerCase() === name.toLowerCase();
            })
        );

        if (tag) {
            const currentField = LibraryTagKeys.find(key => {
                const val = tag[key];
                return val && String(val).trim().toLowerCase() === name.toLowerCase();
            });

            if (currentField) {
                SelectedIcon = LibraryIcons[currentField];
            }
        }
    }

    // Crucial: We must return BOTH Icon: null and icon: null to prevent 
    // the breadcrumb from falling back to the page definition's generic icon.
    const result = {
        name,
        label: name,
        tooltip: name,
        description,
        onClick,
        Icon: SelectedIcon || null,
        icon: SelectedIcon ? <SelectedIcon /> : null
    };

    return result;
}
