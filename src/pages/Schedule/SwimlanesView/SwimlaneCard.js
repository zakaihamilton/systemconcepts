import React, { useRef, memo, useCallback, useState, useEffect } from 'react';
import styles from './SwimlaneCard.module.scss';
import clsx from 'clsx';
import Image from "@widgets/Image";
import Typography from '@mui/material/Typography';
import { formatDuration } from "@util/string";
import Tooltip from '@mui/material/Tooltip';
import { getContrastColor } from "@util/color";

const SwimlaneCard = memo(function SwimlaneCard({ session, isActive, onSessionClick }) {
    const rootRef = useRef(null);
    const [showThumbnail, setShowThumbnail] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const { thumbnail, name, duration, color, group, id } = session;

    useEffect(() => {
        setShowThumbnail(false);
        setImageLoaded(false);
        const timer = setTimeout(() => {
            setShowThumbnail(true);
        }, 1000);
        return () => clearTimeout(timer);
    }, [id]);

    const handleClick = useCallback(() => {
        if (onSessionClick) {
            onSessionClick(session);
        }
    }, [onSessionClick, session]);

    const groupColor = color || "#424242";
    const hasThumbnail = showThumbnail && !!thumbnail;
    const textColor = getContrastColor(groupColor);

    // Show gradient if image is not loaded yet (or no thumbnail exists)
    const showGradient = !imageLoaded;

    const backgroundStyle = showGradient ? {
        background: `linear-gradient(135deg, ${groupColor} 0%, #1a1a1a 100%)`
    } : undefined;

    return (
        <div
            ref={rootRef}
            className={clsx(styles.card, isActive && styles.active)}
            onClick={handleClick}
        >
            <div className={styles.cardInner} style={backgroundStyle}>
                <Image
                    path={hasThumbnail ? thumbnail : null}
                    className={styles.thumbnail}
                    width="100%"
                    height="100%"
                    alt={hasThumbnail ? name : ""}
                    loading="lazy"
                    showProgress={false}
                    onLoad={() => setImageLoaded(true)}
                />
                <div className={styles.overlay}>
                    <div className={styles.info}>
                        <Tooltip title={name} arrow>
                            <Typography variant="subtitle2" className={styles.title} noWrap>
                                {name}
                            </Typography>
                        </Tooltip>
                        <Typography variant="caption" className={styles.duration}>
                            {duration ? formatDuration(duration * 1000, true) : ''}
                        </Typography>
                    </div>
                </div>
                <div className={styles.groupPill} style={{ backgroundColor: groupColor, color: textColor }}>
                    {group}
                </div>
            </div>
        </div>
    );
});

export default SwimlaneCard;
