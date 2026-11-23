import { createElement } from "react";

type AuthInputMockOptions = {
	testIdProp?: "id" | "name";
	allowMissingState?: boolean;
	includeValidationError?: boolean;
};

export function createAuthInputMock({
	testIdProp = "name",
	allowMissingState = false,
	includeValidationError = false,
}: AuthInputMockOptions = {}) {
	return function AuthInputMock({
		state,
		label,
		onValidate,
		validate,
		background,
		select,
		fullWidth,
		icon,
		tooltip,
		mapping,
		helperText,
		...props
	}: any) {
		const [value, setValue] = allowMissingState ? state || [] : state;
		const error = includeValidationError && validate && onValidate ? onValidate(value) : "";

		return createElement("input", {
			"data-testid": `input-${props[testIdProp]}`,
			...(includeValidationError ? { "data-error": error || "" } : {}),
			value: value || "",
			onChange: (event: any) => {
				if (allowMissingState) {
					if (setValue) setValue(event.target.value);
					return;
				}
				setValue(event.target.value);
			},
			...props,
		});
	};
}
