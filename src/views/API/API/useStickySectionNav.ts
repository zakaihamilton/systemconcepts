import { useEffect, useRef, useState } from "react";
import type { ApiSection } from "./sessionsApiDocs";

export interface SectionNavFrame {
	height: number;
	left: number;
	width: number;
}

interface UseStickySectionNavOptions {
	enabled: boolean;
	sections: ApiSection[];
	initialSectionId: string;
}

/**
 * Tracks scroll/resize/transition geometry for the sticky API section nav
 * and determines which section is currently active.
 */
export function useStickySectionNav({
	enabled,
	sections,
	initialSectionId,
}: UseStickySectionNavOptions) {
	const [mounted, setMounted] = useState(false);
	const sectionNavSlotRef = useRef<HTMLDivElement>(null);
	const sectionNavMeasureRef = useRef<HTMLElement>(null);
	const [sectionNavFrame, setSectionNavFrame] =
		useState<SectionNavFrame | null>(null);
	const [activeSectionId, setActiveSectionId] = useState(initialSectionId);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!enabled) {
			setSectionNavFrame(null);
			return;
		}

		const updateSectionNav = () => {
			const slot = sectionNavSlotRef.current;
			const nav = sectionNavMeasureRef.current;
			if (!slot || !nav) {
				return;
			}

			const topOffset = 76;
			const slotRect = slot.getBoundingClientRect();
			const navRect = nav.getBoundingClientRect();
			const shouldPin = slotRect.top <= topOffset;
			const sectionTopOffset = topOffset + navRect.height + 24;
			const activeSection = sections
				.map((section) => {
					const element = document.getElementById(section.id);
					const rect = element?.getBoundingClientRect();
					return rect
						? {
								id: section.id,
								top: rect.top,
								bottom: rect.bottom,
							}
						: null;
				})
				.filter(
					(section): section is NonNullable<typeof section> => section !== null,
				)
				.find(
					(section) =>
						section.top <= sectionTopOffset &&
						section.bottom > sectionTopOffset,
				);

			if (activeSection) {
				setActiveSectionId(activeSection.id);
			}

			const nextFrame = shouldPin
				? {
						height: navRect.height,
						left: slotRect.left,
						width: slotRect.width,
					}
				: null;

			setSectionNavFrame((previousFrame) => {
				if (!previousFrame && !nextFrame) {
					return previousFrame;
				}
				if (
					previousFrame &&
					nextFrame &&
					previousFrame.height === nextFrame.height &&
					previousFrame.left === nextFrame.left &&
					previousFrame.width === nextFrame.width
				) {
					return previousFrame;
				}
				return nextFrame;
			});
		};

		const scrollParent = document.querySelector('[class*="pageContainer"]');
		let transitionFrame: number | null = null;
		let resizeObserver: ResizeObserver | null = null;
		const trackLayoutTransition = () => {
			const startTime = performance.now();
			const tick = () => {
				updateSectionNav();
				if (performance.now() - startTime < 350) {
					transitionFrame = requestAnimationFrame(tick);
				}
			};

			if (transitionFrame) {
				cancelAnimationFrame(transitionFrame);
			}
			transitionFrame = requestAnimationFrame(tick);
		};

		updateSectionNav();
		scrollParent?.addEventListener("scroll", updateSectionNav, {
			passive: true,
		});
		window.addEventListener("scroll", updateSectionNav, {
			passive: true,
		});
		window.addEventListener("resize", updateSectionNav);
		window.addEventListener("transitionrun", trackLayoutTransition, true);
		window.addEventListener("transitionstart", trackLayoutTransition, true);

		if (window.ResizeObserver) {
			resizeObserver = new ResizeObserver(updateSectionNav);
			if (sectionNavSlotRef.current) {
				resizeObserver.observe(sectionNavSlotRef.current);
			}
			if (scrollParent) {
				resizeObserver.observe(scrollParent);
			}
		}

		return () => {
			if (transitionFrame) {
				cancelAnimationFrame(transitionFrame);
			}
			resizeObserver?.disconnect();
			scrollParent?.removeEventListener("scroll", updateSectionNav);
			window.removeEventListener("scroll", updateSectionNav);
			window.removeEventListener("resize", updateSectionNav);
			window.removeEventListener("transitionrun", trackLayoutTransition, true);
			window.removeEventListener(
				"transitionstart",
				trackLayoutTransition,
				true,
			);
		};
	}, [enabled, sections]);

	const handleSectionJump = (sectionId: string) => {
		setActiveSectionId(sectionId);
		document.getElementById(sectionId)?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	};

	return {
		mounted,
		sectionNavSlotRef,
		sectionNavMeasureRef,
		sectionNavFrame,
		activeSectionId,
		handleSectionJump,
	};
}
