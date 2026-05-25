"use client";
import { useTranslations } from "@util/translations";
import { useCurrentPageTitle } from "@util/views";
import { useEffect } from "react";

export default function ClientHead() {
	const translations = useTranslations();
	const pageTitle = useCurrentPageTitle();

	useEffect(() => {
		let title = translations.APP_NAME;
		if (pageTitle) {
			title += " - " + pageTitle;
		}
		document.title = title;
	}, [translations, pageTitle]);

	return null;
}
