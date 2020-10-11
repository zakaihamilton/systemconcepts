import pageList from "@/data/pages";
import { useTranslations } from "@/util/translations";
import { isRegEx } from "@/util/string";
import { useLanguage } from "@/util/language";
import { MainStore } from "@/components/Main";

export function addPath(...path) {
    const hash = window.location.hash + "/" + encodeURI(path.map(item => encodeURIComponent(item)).join("/"));
    MainStore.update(s => {
        s.hash = hash;
    });
    window.location.hash = hash;
}

export function setPath(...path) {
    const hash = encodeURI(path.map(item => encodeURIComponent(item)).join("/"));
    MainStore.update(s => {
        s.hash = hash;
    });
    window.location.hash = hash;
}

export function replacePath(...path) {
    let hash = window.location.hash;
    if (hash.startsWith("#")) {
        hash = hash.substring(1);
    }
    hash = encodeURI(decodeURI(hash).split("/").filter(Boolean).slice(0, -1).join("/"));
    hash += "/" + encodeURI(path.map(item => encodeURIComponent(item)).join("/"));
    MainStore.update(s => {
        s.hash = hash;
    });
    window.location.hash = hash;
}

export function goBackPage() {
    let hash = window.location.hash;
    if (hash.startsWith("#")) {
        hash = hash.substring(1);
    }
    hash = encodeURI(decodeURI(hash).split("/").filter(Boolean).slice(0, -1).join("/"));
    MainStore.update(s => {
        s.hash = hash;
    });
    window.location.hash = hash;
}

export function urlToParentPath(url) {
    const items = decodeURI(url).split("/").filter(Boolean);
    const previousItem = items[items.length - 2] || "";
    return decodeURIComponent(previousItem);
}

export function useParentPath() {
    const { hash } = MainStore.useState();
    const items = decodeURI(hash).split("/").filter(Boolean);
    const previousItem = items[items.length - 2] || "";
    return decodeURIComponent(previousItem);
}

export function getParentParams() {
    const path = useParentPath();
    const [, query] = path.split("?");
    const params = Object.fromEntries(new URLSearchParams(query));
    return params;
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
        sections.map((section, sectionIndex) => {
            const [sectionId, query] = section.split("?");
            if (path) {
                path += "/";
            }
            if (sectionIndex) {
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
            const name = page.name;
            if (typeof page.section === "function") {
                const result = page.section({ sectionIndex, id: sectionId, translations, path: sectionPath, ...params });
                if (!result) {
                    return null;
                }
                page = Object.assign({}, page, result);
            }
            else if (sectionIndex) {
                return;
            }
            const parentPath = urlToParentPath(url);
            const result = { ...page, url, ...params, path: sectionPath, sectionIndex, parentPath };
            if (name !== result.name && !result.tooltip) {
                result.tooltip = name;
            }
            results.push(result);
        });
        if (subPath) {
            path += encodeURIComponent(subPath);
        }
    });
    return results;
}

export function usePages() {
    const translations = useTranslations();
    const language = useLanguage();
    const mapText = text => {
        if (typeof text === "object") {
            text = text[language];
        }
        else if (typeof text === "string") {
            text = translations[text] || text;
        }
        return text;
    };
    const pages = pageList.filter(page => {
        let visible = page.visible;
        if (typeof visible === "function") {
            visible = visible(page);
        }
        if (typeof visible === "undefined") {
            visible = true;
        }
        return visible;
    }).map(page => {
        const { name, tooltip, ...props } = page;
        const { Icon } = page;
        return { ...props, icon: <Icon />, name: mapText(name), tooltip: mapText(tooltip) };
    });
    return pages;
}
