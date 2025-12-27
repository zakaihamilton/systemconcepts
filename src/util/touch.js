import { useRef, useState } from 'react';

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 100 }) {
    const touchStart = useRef(null);
    const touchEnd = useRef(null);
    const [swipeDirection, setSwipeDirection] = useState(null);

    const onTouchStart = (e) => {
        touchEnd.current = null;
        touchStart.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    }

    const onTouchMove = (e) => {
        touchEnd.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    }

    const onTouchEnd = () => {
        if (!touchStart.current || !touchEnd.current) return;

        const distanceX = touchStart.current.x - touchEnd.current.x;
        const distanceY = touchStart.current.y - touchEnd.current.y;

        // Only trigger swipe if horizontal movement is significantly greater than vertical
        const absDistanceX = Math.abs(distanceX);
        const absDistanceY = Math.abs(distanceY);

        // Require horizontal movement to be at least 2x the vertical movement
        if (absDistanceX < absDistanceY * 2) return;

        const isLeftSwipe = distanceX > threshold;
        const isRightSwipe = distanceX < -threshold;

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
