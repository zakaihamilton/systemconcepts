import { useEffect } from "react";

export function useRequireSigninMode(
	store: any,
	isSignedIn: any,
	translations: any,
) {
	useEffect(() => {
		store.update((s: any) => {
			if (!isSignedIn) {
				s.mode = "signin";
				s.message = translations.REQUIRE_SIGNIN;
			} else {
				s.mode = "";
				s.message = "";
			}
		});
	}, [isSignedIn, translations, store]);
}
