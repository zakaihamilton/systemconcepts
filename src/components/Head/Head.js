"use client";

import { useTranslations } from "@util/domain/translations";
import { useCurrentPageTitle } from "@util/domain/views";
import { useEffect } from "react";

export default function HeadComponent() {
	const translations = useTranslations();
	const pageTitle = useCurrentPageTitle();

	useEffect(() => {
		const appName = translations.APP_NAME || "";
		document.title = pageTitle ? `${appName} - ${pageTitle}` : appName;
	}, [translations.APP_NAME, pageTitle]);

	return null;
}
