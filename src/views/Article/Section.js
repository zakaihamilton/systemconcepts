export function getArticleSection({ sectionIndex, name, translations }) {
    if (sectionIndex) {
        return { name: name || translations.NEW_ARTICLE };
    }
};
