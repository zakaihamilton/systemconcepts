import { useEffect } from "react";

export function useRequireSigninMode(store, isSignedIn, translations) {
	useEffect(() => {
		store.update((s) => {
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
