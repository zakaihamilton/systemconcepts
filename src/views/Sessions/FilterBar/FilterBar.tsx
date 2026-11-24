import { SessionsStore } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import clsx from "clsx";
import React, { useMemo } from "react";
import styles from "./FilterBar.module.css";
import FilterDropdownButton from "./FilterDropdownButton";
import {
	buildGroupMenuItems,
	buildTypeDefinitions,
	buildTypeMenuItems,
	buildYearMenuItems,
	getGroupLabel,
	getTypeLabel,
	getYearLabel,
} from "./filterDefinitions";

export default React.memo(function FilterBar({ hideYears = false }: any) {
	const translations = useTranslations();
	const typeFilter = SessionsStore.useState((s) => s.typeFilter);
	const yearFilter = SessionsStore.useState((s) => s.yearFilter);
	const groupFilter = SessionsStore.useState((s) => s.groupFilter);
	const sessions = SessionsStore.useState((s) => s.sessions);
	const groups = SessionsStore.useState((s) => s.groups);
	const showFilterDialog = SessionsStore.useState((s) => s.showFilterDialog);

	const types = useMemo(
		() => buildTypeDefinitions(translations, typeFilter),
		[translations, typeFilter],
	);

	const years = useMemo(() => {
		return (sessions || [])
			?.reduce((acc: string[], session: any) => {
				if (session.year && !acc.includes(session.year)) {
					acc.push(session.year);
				}
				return acc;
			}, [])
			?.sort((a: string, b: string) => b.localeCompare(a));
	}, [sessions]);

	const groupMenuItems = useMemo(
		() => buildGroupMenuItems(groups, groupFilter),
		[groups, groupFilter],
	);

	const typeMenuItems = useMemo(
		() => buildTypeMenuItems(types, typeFilter),
		[types, typeFilter],
	);

	const yearMenuItems = useMemo(
		() => buildYearMenuItems(years, yearFilter),
		[years, yearFilter],
	);

	const handleClearGroup = (e: any) => {
		e.stopPropagation();
		SessionsStore.update((s) => {
			s.groupFilter = [];
		});
	};

	const handleClearType = (e: any) => {
		e.stopPropagation();
		SessionsStore.update((s) => {
			s.typeFilter = [];
		});
	};

	const handleClearYear = (e: any) => {
		e.stopPropagation();
		SessionsStore.update((s) => {
			s.yearFilter = [];
		});
	};

	return (
		<div className={clsx(styles.root, !showFilterDialog && styles.hide)}>
			<div className={styles.container}>
				<FilterDropdownButton
					items={typeMenuItems}
					selected={typeFilter}
					label={getTypeLabel(typeFilter, types, translations)}
					clearTitle={translations.CLEAR_FILTER}
					onClear={handleClearType}
				/>

				{!hideYears && (
					<FilterDropdownButton
						items={yearMenuItems}
						selected={yearFilter}
						label={getYearLabel(yearFilter, translations)}
						clearTitle={translations.CLEAR_FILTER}
						onClear={handleClearYear}
					/>
				)}

				<FilterDropdownButton
					items={groupMenuItems}
					selected={groupFilter}
					label={getGroupLabel(groupFilter, translations)}
					clearTitle={translations.CLEAR_FILTER}
					onClear={handleClearGroup}
				/>
			</div>
		</div>
	);
});
