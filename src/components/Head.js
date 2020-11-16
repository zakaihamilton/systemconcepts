import Head from "next/head"
import { useTranslations } from "@util/translations";
import { useCurrentPageTitle } from "@util/pages";

export default function HeadComponent() {
    const translations = useTranslations();
    let title = translations.APP_NAME;
    const pageTitle = useCurrentPageTitle();
    if (pageTitle) {
        title += " - " + pageTitle;
    }

    return <Head>
        <title>{title}</title>
        <link rel="icon" href="/favicon.ico" />
    </Head>
}