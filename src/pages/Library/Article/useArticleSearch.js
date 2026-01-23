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
        setTimeout(() => setTotalMatches(highlights.length), 0);
        if (highlights.length > 0) {
            setTimeout(() => {
                setMatchIndex(prev => {
                    const index = prev >= highlights.length ? 0 : prev;
                    scrollToMatch(index);
                    return index;
                });
            }, 0);
        }
    }, [content, search, scrollToMatch]);

    return {
        matchIndex,
        totalMatches,
        handleNextMatch,
        handlePrevMatch
    };
}
