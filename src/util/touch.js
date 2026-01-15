import { useRef } from 'react';

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }) {
    const touchStart = useRef(null);
    const touchEnd = useRef(null);

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

        const absDistanceX = Math.abs(distanceX);
        const absDistanceY = Math.abs(distanceY);

        // Only trigger swipe if horizontal movement is significantly greater than vertical
        // and meets the threshold
        if (absDistanceX > threshold && absDistanceX > absDistanceY * 1.5) {
            if (distanceX > 0) {
                onSwipeLeft && onSwipeLeft();
            } else {
                onSwipeRight && onSwipeRight();
            }
        }
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd
    };
}
