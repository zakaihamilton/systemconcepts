import Head from "next/head"
import { useTranslations } from "@util/translations";
import { useActivePages } from "@util/pages";

export default function HeadComponent() {
    const translations = useTranslations();
    const pages = useActivePages();
    const activePage = pages[pages.length - 1];
    const page = pages[pages.length - 1 - (activePage.useParentName || 0)];
    let title = translations.APP_NAME;
    if (page && !page.root) {
        title += " - " + (page.label || page.name);
    }

    return <Head>
        <title>{title}</title>
        <link rel="icon" href="/favicon.ico" />
    </Head>
}