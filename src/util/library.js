import storage from "@util/storage";
import { tagsFilePath } from "@util/tags";
import { createID } from "@util/content";

export async function importContent(data) {
    let libraryTags = [];
    if (await storage.exists(tagsFilePath)) {
        const body = await storage.readFile(tagsFilePath);
        libraryTags = JSON.parse(body);
    }
    const records = [];
    for (const item of data) {
        const { text, _id, user, ...tags } = item;
        let record = records.find(record => record._id === _id);
        if (!record) {
            record = { _id, id: createID(), tags: {} };
            records.push(record);
        }
        for (const tag in tags) {
            const name = tags[tag].replace(/\./g, " ");
            record.tags[tag] = { id: tag + "." + name, name, eng: tags[tag] };
        }
        if (text) {
            record.text = text;
        }
    }
    for (const item of records) {
        const { tags } = item;
        for (const key in tags) {
            const tag = tags[key];
            const match = libraryTags.find(item => item.eng === tag.eng);
            if (match) {
                tags[key] = { id: match.id };
            }
            else {
                libraryTags.push(tag);
            }
        }
    }
    for (const item of records) {
        const { id, tags, text } = item;
        if (text && tags.article) {
            const match = libraryTags.find(item => item.id === tags.article.id);
            if (!match) {
                continue;
            }
            if (!match.content) {
                match.content = [];
            }
            match.content.push(id);
        }
    }
    let folders = [];
    let files = {};
    for (const item of records) {
        const { id, tags, content, text } = item;
        folders.push(item.id);
        files[item.id + "/tags.json"] = JSON.stringify({ id, tags, content }, null, 4);
        files[item.id + "/eng.txt"] = text;
    }
    await storage.createFolders("content/", folders);
    await storage.writeFiles("content/", files);
    await storage.writeFile(tagsFilePath, JSON.stringify(libraryTags, null, 4));
}

export async function scanContent() {
    const tags = await storage.readFile(tagsFilePath);
}