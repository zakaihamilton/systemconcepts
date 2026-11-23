import { MainStore } from "@components/Main";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";

type AuthViewTestOptions = {
	translations: Record<string, string>;
	cookieId: string | null;
};

export function setupAuthViewTest({
	translations,
	cookieId,
}: AuthViewTestOptions) {
	jest.clearAllMocks();
	asMock(useTranslations).mockReturnValue(translations);
	asMock(MainStore.useState).mockReturnValue({ direction: "ltr" });
	asMock(Cookies.get).mockReturnValue(cookieId);
}

export function mockSignedInCookies() {
	asMock(Cookies.get).mockImplementation((key: string) => {
		if (key === "id") return "testuser";
		if (key === "hash") return "testhash";
		return null;
	});
}
