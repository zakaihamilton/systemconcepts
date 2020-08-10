import pageList from "@/data/pages";
import { useTranslations } from "@/util/translations";
import { isRegEx } from "@/util/string";

export function addPath(...path) {
    window.location.hash += "/" + encodeURI(path.map(item => encodeURIComponent(item)).join("/"));
}

export function setPath(...path) {
    window.location.hash = encodeURI(path.map(item => encodeURIComponent(item)).join("/"));
}

export function goBackPage() {
    let hash = window.location.hash;
    if (hash.startsWith("#")) {
        hash = hash.substring(1);
    }
    window.location.hash = encodeURI(decodeURI(hash).split("/").filter(Boolean).slice(0, -1).join("/"));
}

export function getPreviousPath() {
    let hash = window.location.hash;
    if (hash.startsWith("#")) {
        hash = hash.substring(1);
    }
    const items = decodeURI(hash).split("/").filter(Boolean);
    const previousItem = items[items.length - 2] || "";
    return decodeURIComponent(previousItem);
}

export function usePagesFromHash(hash = "") {
    const translations = useTranslations();
    const pages = usePages();
    let results = [];
    if (hash.startsWith("#")) {
        hash = hash.substring(1);
    }
    const items = decodeURI(hash).split("/").filter(Boolean);
    const root = pages.find(page => page.root);
    if (root) {
        if (items[0] && items[0].startsWith("?")) {
            items[0] = root.id + items[0];
        }
        else if (!items[0] || !items[0].startsWith(root.id)) {
            items.unshift(root.id);
        }
    }
    let path = "";
    items.forEach(item => {
        item = decodeURIComponent(item);
        const sections = item.split("/");
        let sectionPath = "";
        const pageId = (sections[0] || "").split("?")[0];
        let subPath = "";
        sections.map((section, index) => {
            const [sectionId, query] = section.split("?");
            if (path) {
                path += "/";
            }
            if (index) {
                if (sectionPath) {
                    sectionPath += "/";
                }
                sectionPath += sectionId;
                subPath += "/";
            }
            subPath += section;
            let page = pages.find(page => {
                const matchId = path + subPath;
                if (!isRegEx(page.id)) {
                    return page.id === matchId;
                }
                const match = matchId.match(page.id);
                return match;
            });
            if (!page) {
                page = pages.find(page => page.id === pageId);
            }
            if (!page) {
                return null;
            }
            let params = {};
            if (query) {
                params = Object.fromEntries(new URLSearchParams(query));
            }
            if (page.root) {
                subPath = subPath.substring(pageId.length);
            }
            const url = encodeURI(path + encodeURIComponent(subPath));
            if (index) {
                if (typeof page.section === "function") {
                    page = Object.assign({}, page, page.section({ index, id: sectionId, translations }));
                }
                else {
                    return;
                }
            }
            results.push({ ...page, url, ...params, path: sectionPath });
        });
        if (subPath) {
            path += encodeURIComponent(subPath);
        }
    });
    return results;
}

export function usePages() {
    const translations = useTranslations();
    const pages = pageList.map(page => {
        const { name, ...props } = page;
        const text = translations[name] || name;
        return { ...props, name: text };
    });
    return pages;
}
