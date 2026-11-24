import type { RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "./StickySectionNav.module.css";
import type { ApiSection } from "./sessionsApiDocs";
import type { SectionNavFrame } from "./useStickySectionNav";

interface StickySectionNavProps {
	sections: ApiSection[];
	activeSectionId: string;
	sectionNavFrame: SectionNavFrame | null;
	sectionNavSlotRef: RefObject<HTMLDivElement | null>;
	sectionNavMeasureRef: RefObject<HTMLElement | null>;
	mounted: boolean;
	ariaLabel: string;
	onJump: (sectionId: string) => void;
}

/**
 * Renders an in-flow section jump bar that pins to the viewport via a portal
 * when scrolled past the top offset.
 */
export default function StickySectionNav({
	sections,
	activeSectionId,
	sectionNavFrame,
	sectionNavSlotRef,
	sectionNavMeasureRef,
	mounted,
	ariaLabel,
	onJump,
}: StickySectionNavProps) {
	const renderNav = ({
		fixed = false,
		hidden = false,
		measure = false,
	}: {
		fixed?: boolean;
		hidden?: boolean;
		measure?: boolean;
	} = {}) => (
		<nav
			ref={measure ? sectionNavMeasureRef : undefined}
			className={`${styles.sectionNav} ${fixed ? styles.sectionNavFixed : ""} ${hidden ? styles.sectionNavPlaceholder : ""}`}
			style={
				fixed && sectionNavFrame
					? {
							left: sectionNavFrame.left,
							width: sectionNavFrame.width,
						}
					: undefined
			}
			aria-label={ariaLabel}
			aria-hidden={hidden ? "true" : undefined}
		>
			{sections.map((section) => (
				<button
					type="button"
					key={section.id}
					className={`${styles.sectionNavLink} ${activeSectionId === section.id ? styles.sectionNavLinkActive : ""}`}
					onClick={() => onJump(section.id)}
					aria-current={activeSectionId === section.id ? "true" : undefined}
				>
					{section.label}
				</button>
			))}
		</nav>
	);

	return (
		<>
			{mounted &&
				sectionNavFrame &&
				createPortal(renderNav({ fixed: true }), document.body)}
			<div
				ref={sectionNavSlotRef}
				className={styles.sectionNavSlot}
				style={
					sectionNavFrame ? { minHeight: sectionNavFrame.height } : undefined
				}
			>
				{renderNav({
					hidden: Boolean(sectionNavFrame),
					measure: true,
				})}
			</div>
		</>
	);
}
