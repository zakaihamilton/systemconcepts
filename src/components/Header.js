import Head from "next/head"
import { useTranslations } from "@/util/translations";

export default function Header() {
    const translations = useTranslations();

    return <Head>
        <title>{translations.APP_NAME}</title>
        <link rel="icon" href="/favicon.ico" />
    </Head>
}