import { MainStore } from "@components/Main";
import { LibraryStore } from "./Store";

export function getLibrarySection({ id, path, translations }) {
    const { tags } = LibraryStore.getRawState();

    const onClick = () => {
        MainStore.update(s => {
            s.showLibrarySideBar = !s.showLibrarySideBar;
        });
    };

    // Identify if this is the root "Library" breadcrumb
    if (id && id.toLowerCase() === "library") {
        let label = translations.LIBRARY || "Library";
        if (label && typeof label === "string" && label.length > 0) {
            label = label.charAt(0).toUpperCase() + label.slice(1);
        }
        return {
            name: label,
            label: label,
            tooltip: label,
            onClick
        };
    }

    // For sub-segments, default to the segment name itself
    const name = id;
    let description = "";

    const getTagHierarchy = (tag) => {
        return [
            tag.author,
            tag.book,
            tag.volume,
            tag.part,
            tag.section,
            tag.year,
            tag.portion,
            tag.article,
            tag.chapter,
            tag.title
        ].map(v => v ? String(v).trim() : null).filter(Boolean);
    };

    // Find the current hash items to determine if we are at the leaf node
    const hash = (typeof window !== "undefined" ? window.location.hash : "").split("?")[0].replace("#", "");
    const hashItems = hash.split("/").filter(Boolean).map(decodeURIComponent);
    const libRootIndex = hashItems.findIndex(h => h.toLowerCase() === "library");
    const subSegments = hashItems.slice(libRootIndex + 1);
    const urlPath = subSegments.join("|");

    // Find a tag that matches the sequence of segments to identify metadata
    const tag = (tags || []).find(t => {
        const hierarchy = getTagHierarchy(t);
        return subSegments.every((val, i) => hierarchy[i] === val);
    });

    if (tag) {
        const hierarchy = getTagHierarchy(tag);
        const isLeaf = hierarchy.join("|") === urlPath && name === hierarchy[hierarchy.length - 1];
        if (isLeaf) {
            description = [
                tag.number ? `${translations.NUMBER || "No."} ${tag.number}` : null
            ].filter(Boolean).join(" | ");
        }
    }

    return {
        name,
        label: name,
        tooltip: name,
        description,
        onClick
    };
}
