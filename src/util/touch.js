import { useRef } from 'react';

export function useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50 }) {
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

        // Horizontal swipe
        if (absDistanceX > threshold && absDistanceX > absDistanceY * 1.5) {
            if (distanceX > 0) {
                onSwipeLeft && onSwipeLeft();
            } else {
                onSwipeRight && onSwipeRight();
            }
        }
        // Vertical swipe
        else if (absDistanceY > threshold && absDistanceY > absDistanceX * 1.5) {
            if (distanceY > 0) {
                onSwipeUp && onSwipeUp();
            } else {
                onSwipeDown && onSwipeDown();
            }
        }
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd
    };
}
