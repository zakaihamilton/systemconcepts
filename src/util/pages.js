import pages from "@/data/pages";

export function getPagesFromHash(hash = "") {
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
    results = items.map(url => {
        url = decodeURI(url);
        const [id, query] = url.split("?");
        const page = pages.find(page => page.id === id);
        if (!page) {
            return null;
        }
        let params = {};
        if (query) {
            params = Object.fromEntries(new URLSearchParams(query));
        }
        if (page.root) {
            url = url.substring(id.length);
        }
        url = encodeURI(url);
        return { ...page, url, ...params };
    }).filter(Boolean);
    return results;
}
