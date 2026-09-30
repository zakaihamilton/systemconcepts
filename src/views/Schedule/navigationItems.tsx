import ArrowBackIcon from "@icons/svg/ArrowBack.svg";
import ArrowForwardIcon from "@icons/svg/ArrowForward.svg";
import TodayIcon from "@icons/svg/Today.svg";

type ScheduleNavigationState = {
	date: Date;
	viewMode: string | null;
	lastViewMode: string | null;
};

export function getScheduleNavigationItems({
	store,
	direction,
	translations,
	lastViewMode,
	today,
	todayDisabled,
	menu,
}: {
	store: {
		update(callback: (state: ScheduleNavigationState) => void): unknown;
	};
	direction: string | undefined;
	translations: { BACK?: string; TODAY?: string };
	lastViewMode: string | null;
	today: Date | (() => Date);
	todayDisabled?: boolean;
	menu?: false;
}) {
	return [
		{
			id: "back",
			name: translations.BACK,
			icon: direction === "rtl" ? <ArrowForwardIcon /> : <ArrowBackIcon />,
			location: "header",
			disabled: !lastViewMode,
			onClick: () => {
				if (lastViewMode)
					store.update((state) => {
						state.viewMode = lastViewMode;
						state.lastViewMode = null;
					});
			},
		},
		{
			id: "today",
			name: translations.TODAY,
			icon: <TodayIcon />,
			location: "header",
			...(todayDisabled !== undefined ? { disabled: todayDisabled } : {}),
			...(menu !== undefined ? { menu } : {}),
			onClick: () =>
				store.update((state) => {
					state.date = typeof today === "function" ? today() : today;
				}),
		},
	];
}
