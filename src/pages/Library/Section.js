import { MainStore } from "@components/Main";
import { LibraryStore } from "./Store";
import { LibraryIcons, LibraryTagKeys } from "./Icons";

export function getLibrarySection({ id, path, translations, sectionIndex }) {
    const { tags } = LibraryStore.getRawState();

    const onClick = () => {
        MainStore.update(s => {
            s.showLibrarySideBar = !s.showLibrarySideBar;
        });
    };

    // Identify if this is the root "Library" breadcrumb
    if (id && id.toLowerCase() === "library") {
        return {
            name: translations.LIBRARY,
            label: translations.LIBRARY,
            tooltip: translations.LIBRARY,
            onClick
        };
    }

    // For sub-segments, default to the segment name itself
    const name = id;
    let description = "";
    let Icon = null;

    const getTagHierarchy = (tag) => {
        return LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
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
        const segmentIndex = typeof sectionIndex !== "undefined" ? sectionIndex - 1 : subSegments.indexOf(name);

        // Map the segment name to its corresponding field key
        const presentFields = LibraryTagKeys.filter(f => tag[f]);
        const currentField = presentFields[segmentIndex];
        if (currentField) {
            Icon = LibraryIcons[currentField];
        }

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
        Icon,
        onClick
    };
}
