import languages from "@/data/languages";
import { useLanguage } from "@/util/language";

export function useDirection() {
    const language = useLanguage();
    const { direction } = languages.find(item => item.id === language) || {};
    return direction;
}
