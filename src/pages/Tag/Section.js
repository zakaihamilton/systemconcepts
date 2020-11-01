export function getTagSection({ tag, translations }) {
    return { name: tag || translations.NEW_TAG };
};
