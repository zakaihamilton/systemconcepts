import { useState, useCallback, useEffect } from "react";

export function useArticleSearch(content, search) {
    const [matchIndex, setMatchIndex] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);

    const scrollToMatch = useCallback((index) => {
        const highlights = document.querySelectorAll('.search-highlight');
        if (highlights[index]) {
            highlights[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlights[index].style.outline = "2px solid #ff9800";
            highlights[index].style.borderRadius = "2px";
            setTimeout(() => {
                if (highlights[index]) {
                    highlights[index].style.outline = "none";
                }
            }, 2000);
        }
    }, []);

    const handleNextMatch = useCallback(() => {
        if (totalMatches === 0) return;
        setMatchIndex(prev => {
            const next = (prev + 1) % totalMatches;
            scrollToMatch(next);
            return next;
        });
    }, [totalMatches, scrollToMatch]);

    const handlePrevMatch = useCallback(() => {
        if (totalMatches === 0) return;
        setMatchIndex(prev => {
            const next = (prev - 1 + totalMatches) % totalMatches;
            scrollToMatch(next);
            return next;
        });
    }, [totalMatches, scrollToMatch]);

    useEffect(() => {
        const highlights = document.querySelectorAll('.search-highlight');
        const count = highlights.length;

        setTimeout(() => {
            setTotalMatches(count);
            setMatchIndex(prev => {
                const newIndex = (count === 0 || !search) ? 0 : (prev >= count ? 0 : prev);
                if (count > 0 && search) {
                    scrollToMatch(newIndex);
                }
                return newIndex;
            });
        }, 0);
    }, [content, search, scrollToMatch]);

    return {
        matchIndex,
        totalMatches,
        handleNextMatch,
        handlePrevMatch
    };
}
