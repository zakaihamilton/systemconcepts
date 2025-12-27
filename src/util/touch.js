import { useRef, useState } from 'react';

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }) {
    const touchStart = useRef(null);
    const touchEnd = useRef(null);
    const [swipeDirection, setSwipeDirection] = useState(null);

    const onTouchStart = (e) => {
        touchEnd.current = null;
        touchStart.current = e.targetTouches[0].clientX;
    }

    const onTouchMove = (e) => {
        touchEnd.current = e.targetTouches[0].clientX;
    }

    const onTouchEnd = () => {
        if (!touchStart.current || !touchEnd.current) return;
        const distance = touchStart.current - touchEnd.current;
        const isLeftSwipe = distance > threshold;
        const isRightSwipe = distance < -threshold;
        if (isLeftSwipe) {
            setSwipeDirection("left");
            onSwipeLeft && onSwipeLeft();
        }
        if (isRightSwipe) {
            setSwipeDirection("right");
            onSwipeRight && onSwipeRight();
        }
        if (isLeftSwipe || isRightSwipe) {
            setTimeout(() => setSwipeDirection(null), 500);
        }
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        swipeDirection
    };
}
