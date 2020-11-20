export function getArticleSection({ sectionIndex, path, translations }) {
    if (sectionIndex) {
        return { name: path || translations.NEW_ARTICLE };
    }
};
