import FS from '@isomorphic-git/lightning-fs';

const fs = new FS("systemconcepts-fs");

const handler = path => ({
    apply: (target, thisArg, argumentsList) => {

    },
    get: (target, prop, receiver) => {
        if (prop !== "/") {
            const listing = object["/"];
            if (listing) {
                const item = listing.find(item => item.name === prop);
                return item;
            }
        }
    },
    has: (target, key) => {
        return key in target;
    },
    set: (obj, prop, value) => {

    }
});

const init = async (path, object) => {
    const stat = await fs.promises.stat(path);
    if (stat.isDirectory) {
        const names = await fs.readdir(path);
        const listing = object["/"] = [];
        for (const name of names) {
            const item = {};
            const filePath = [path, name].filter(Boolean).join("/");
            try {
                const fileStat = await fs.stat(filePath);
                Object.assign(item, fileStat);
                item.filePath = filePath;
                item.name = name;
                item.folder = path;
                listing.push(item);
            }
            catch (err) {
                console.error(err);
            }
        }
    }
};

export default {
    handler,
    init
};