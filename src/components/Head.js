"use client";

import { useEffect } from "react";
import { useTranslations } from "@util/translations";
import { useCurrentPageTitle } from "@util/views";

export default function HeadComponent() {
    const translations = useTranslations();
    const pageTitle = useCurrentPageTitle();

    useEffect(() => {
        const appName = translations.APP_NAME || "";
        document.title = pageTitle ? `${appName} - ${pageTitle}` : appName;
    }, [translations.APP_NAME, pageTitle]);

    return null;
}