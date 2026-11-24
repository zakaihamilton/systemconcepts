import { MainStore } from "@components/Main";
import { fireEvent, screen } from "@testing-library/react";
import { fetchJSON } from "@util/api/fetch";
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

export function changeAuthInput(testId: string, value: string) {
	fireEvent.change(screen.getByTestId(testId), { target: { value } });
}

export function mockSignedInCookies() {
	asMock(Cookies.get).mockImplementation((key: string) => {
		if (key === "id") return "testuser";
		if (key === "hash") return "testhash";
		return null;
	});
}

export function expectLoginPostRequest() {
	expect(fetchJSON).toHaveBeenCalledWith(
		"/api/login",
		expect.objectContaining({
			method: "POST",
		}),
	);
}
