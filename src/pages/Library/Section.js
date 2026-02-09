
import { LibraryStore } from "./Store";
import { LibraryIcons, LibraryTagKeys } from "./Icons";

export function getLibrarySection({ id, path, translations }) {
    const { tags } = LibraryStore.getRawState();

    const segments = (path || "").split("/").filter(Boolean).map(decodeURIComponent);
    const name = decodeURIComponent(id || segments[segments.length - 1] || "");

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
            icon: RootIcon && <RootIcon />
        };
    }

    let description = "";
    let SelectedIcon = null;

    if (tags && tags.length > 0) {
        // Find all tags that contain this name in any field
        const matchingTags = tags.filter(t =>
            LibraryTagKeys.some(key => {
                const val = t[key];
                return val && String(val).trim().toLowerCase() === name.toLowerCase();
            })
        );

        // For each matching tag, find which field matches and get its index
        let bestTag = null;
        let bestFieldKey = null;
        let bestFieldIndex = Infinity;

        for (const t of matchingTags) {
            for (let i = 0; i < LibraryTagKeys.length; i++) {
                const key = LibraryTagKeys[i];
                const val = t[key];
                if (val && String(val).trim().toLowerCase() === name.toLowerCase()) {
                    // Prefer earlier fields (chapter before title)
                    if (i < bestFieldIndex) {
                        bestFieldIndex = i;
                        bestFieldKey = key;
                        bestTag = t;
                    }
                    break; // Only check first matching field per tag
                }
            }
        }

        if (bestTag && bestFieldKey) {
            SelectedIcon = LibraryIcons[bestFieldKey];
            description = bestFieldKey.charAt(0).toUpperCase() + bestFieldKey.slice(1);
        }
    }

    // If the name starts with the description, remove it from the label
    let label = name;
    if (description && name && name.toLowerCase().startsWith(description.toLowerCase())) {
        label = name.slice(description.length).trim();
        // If nothing remains after stripping, keep the original name
        if (!label) {
            label = name;
        }
    }

    // Strip numeric suffix (paragraph or article number) from the label
    const lastColonIndex = label.lastIndexOf(":");
    if (lastColonIndex !== -1) {
        const suffix = label.substring(lastColonIndex + 1);
        if (/^\d+$/.test(suffix)) {
            label = label.substring(0, lastColonIndex);
        }
    }

    // Crucial: We must return BOTH Icon: null and icon: null to prevent 
    // the breadcrumb from falling back to the page definition's generic icon.
    const result = {
        name,
        label,
        tooltip: name,
        description,
        static: true,
        Icon: SelectedIcon || null,
        icon: SelectedIcon ? <SelectedIcon /> : null
    };

    return result;
}

