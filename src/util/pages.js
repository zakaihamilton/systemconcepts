import pageList from "@data/pages";
import { useTranslations } from "@util/translations";
import { isRegEx } from "@util/string";
import { useLanguage } from "@util/language";
import { MainStore } from "@components/Main";

export function usePathItems() {
    let { hash } = MainStore.useState();
    if (hash.startsWith("#")) {
        hash = hash.substring(1);
    }
    const items = hash.split("/").filter(Boolean).map(item => decodeURIComponent(item));
    return items;
}

export function toPath(...path) {
    const hash = path.map(item => encodeURIComponent(item)).join("/");
    return hash;
}

export function addPath(...path) {
    const hash = window.location.hash + "/" + path.map(item => encodeURIComponent(item)).join("/");
    setHash(hash);
}

export function setHash(hash) {
    MainStore.update(s => {
        s.hash = hash;
    });
    window.location.hash = hash;
}

export function setPath(...path) {
    let hash = path.map(item => {
        if (item.startsWith("#")) {
            item = item.substring(1);
        }
        return encodeURIComponent(item);
    }).join("/");
    setHash(hash);
}

export function replacePath(...path) {
    let hash = window.location.hash;
    if (hash.startsWith("#")) {
        hash = hash.substring(1);
    }
    hash = hash.split("/").filter(Boolean).slice(0, -1).join("/");
    hash += "/" + path.map(item => encodeURIComponent(item)).join("/");
    setHash(hash);
}

export function goBackPage() {
    let hash = window.location.hash;
    if (hash.startsWith("#")) {
        hash = hash.substring(1);
    }
    hash = hash.split("/").filter(Boolean).slice(0, -1).join("/");
    setHash(hash);
}

export function urlToParentPath(url) {
    const items = url.split("/").filter(Boolean);
    const previousItem = items[items.length - 2] || "";
    return decodeURIComponent(previousItem);
}

export function useParentPath(index = 0) {
    const { hash } = MainStore.useState();
    const items = hash.split("/").filter(Boolean);
    const previousItem = items[items.length - 2 - index] || "";
    return decodeURIComponent(previousItem);
}

export function useParentParams(index) {
    const path = useParentPath(index);
    const [, query] = path.split("?");
    const params = Object.fromEntries(new URLSearchParams(query));
    return params;
}

export function getPagesFromHash({ hash, translations, pages }) {
    let results = [];
    if (hash.startsWith("#")) {
        hash = hash.substring(1);
    }
    const items = hash.split("/").filter(Boolean);
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
            const url = page.path || path + encodeURIComponent(subPath);
            const name = page.name;
            page = Object.assign({}, page, params);
            if (typeof page.section === "function") {
                const result = page.section({
                    sectionIndex,
                    id: sectionId,
                    translations,
                    path: sectionPath,
                    ...params
                });
                if (!result) {
                    return null;
                }
                page = Object.assign({}, page, result);
            }
            else if (sections.length > 1 && sectionIndex !== sections.length - 1) {
                return;
            }
            const parentPath = urlToParentPath(url);
            const result = { ...page, url, path: sectionPath, sectionIndex, subPath, parentPath };
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

export function useActivePages() {
    let { hash = "" } = MainStore.useState();
    const translations = useTranslations();
    const pages = usePages();
    return getPagesFromHash({ hash, translations, pages });
}

export function usePages(modeId) {
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
        let { name, label, tooltip, ...props } = page;
        let { Icon } = page;
        if (modeId) {
            Icon = page[modeId] && page[modeId].Icon || Icon;
            name = page[modeId] && page[modeId].name || name;
            label = page[modeId] && page[modeId].name || label;
        }
        return {
            ...props,
            icon: !!Icon && <Icon />,
            name: mapText(name),
            label: mapText(label),
            tooltip: mapText(tooltip)
        };
    });
    return pages;
}

export function useCurrentPage() {
    const pages = useActivePages();
    const activePage = pages[pages.length - 1];
    const page = pages[pages.length - 1 - (activePage.useParentName || 0)];
    return page;
}

export function useCurrentPageTitle() {
    const page = useCurrentPage();
    if (page && !page.root) {
        return page.label || page.name;
    }
    return "";
}