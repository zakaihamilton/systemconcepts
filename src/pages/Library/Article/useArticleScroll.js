import { useState, useCallback, useRef, useEffect } from "react";

export function useArticleScroll(contentRef, handleScroll, disabled) {
    const [scrollInfo, setScrollInfo] = useState({ page: 1, total: 1, visible: false, clientHeight: 0, scrollHeight: 0 });
    const [showScrollTop, setShowScrollTop] = useState(false);
    const scrollTimeoutRef = useRef(null);

    const updateScrollInfo = useCallback((target) => {
        const { scrollTop, scrollHeight, clientHeight } = target;
        if (clientHeight === 0) return;

        // Use a threshold to prevent small overflows (like margins/padding) from creating extra pages
        const effectiveScrollHeight = scrollHeight - (clientHeight * 0.1); // Allow 10% tolerance
        const total = Math.max(1, Math.ceil(effectiveScrollHeight / clientHeight));
        let page = Math.ceil((scrollTop + clientHeight / 4) / clientHeight) || 1;
        if (scrollTop + clientHeight >= scrollHeight - 1) {
            page = total;
        }

        setScrollInfo(prev => {
            if (prev.page !== page || prev.total !== total || prev.clientHeight !== clientHeight || prev.scrollHeight !== scrollHeight) {
                return { ...prev, page, total, clientHeight, scrollHeight };
            }
            return prev;
        });
    }, []);

    const handleScrollUpdate = useCallback((e) => {
        const { target } = e;
        updateScrollInfo(target);
        setShowScrollTop(target.scrollTop > 300);

        setScrollInfo(prev => {
            if (!prev.visible) return { ...prev, visible: true };
            return prev;
        });

        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
            setScrollInfo(prev => ({ ...prev, visible: false }));
        }, 1500);

        if (handleScroll) {
            handleScroll(e);
        }
    }, [updateScrollInfo, handleScroll]);

    const scrollToTop = useCallback(() => {
        if (contentRef.current) {
            contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [contentRef]);

    useEffect(() => {
        const element = contentRef.current;
        if (!element || disabled) return;

        const observer = new ResizeObserver(() => {
            updateScrollInfo(element);
        });
        observer.observe(element);

        return () => observer.disconnect();
    }, [updateScrollInfo, contentRef, disabled]);

    return {
        scrollInfo,
        setScrollInfo,
        showScrollTop,
        setShowScrollTop,
        handleScrollUpdate,
        scrollToTop,
        updateScrollInfo
    };
}
