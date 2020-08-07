import pageList from "@/data/pages";
import { useTranslations } from "@/util/translations";

export function addPath(...path) {
    window.location.hash += "/" + encodeURI(path.map(item => encodeURIComponent(item)).join("/"));
}

export function setPath(...path) {
    window.location.hash = encodeURI(path.map(item => encodeURIComponent(item)).join("/"));
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
    items.map(item => {
        item = decodeURIComponent(item);
        const [pageId, ...names] = item.split("/");
        let sectionPath = "";
        [pageId, ...names].map((section, index) => {
            const [sectionId, query] = section.split("?");
            console.log("index", index, "sectionId", sectionId);
            if (path) {
                path += "/";
            }
            console.log("path", path);
            if (index) {
                if (sectionPath) {
                    sectionPath += "/";
                }
                sectionPath += sectionId;
            }
            let page = pages.find(page => page.id === path);
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
            path += sectionId;
            if (page.root) {
                path = path.substring(pageId.length);
            }
            const url = encodeURI(encodeURIComponent(path));
            let icon = page.icon;
            let name = page.name;
            if (index) {
                if (typeof page.section === "function") {
                    page = Object.assign({}, page, page.section({ index, id: sectionId, translations }));
                }
                else {
                    name = section;
                }
            }
            results.push({ ...page, name, icon, url, ...params, path: sectionPath });
        });
    }).filter(Boolean);
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
