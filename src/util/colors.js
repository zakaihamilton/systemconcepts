import { useTheme, getContrastRatio } from "@mui/material/styles";

export function hexToRgb(hex) {
    if (!hex) {
        return null;
    }
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function mixColors(color1, color2, weight) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    if (!rgb1 || !rgb2) {
        return color1;
    }

    const r = Math.round(rgb1.r * weight + rgb2.r * (1 - weight));
    const g = Math.round(rgb1.g * weight + rgb2.g * (1 - weight));
    const b = Math.round(rgb1.b * weight + rgb2.b * (1 - weight));

    return `rgb(${r}, ${g}, ${b})`;
}

export function useSessionTextColor(sessionColor) {
    const theme = useTheme();
    const backgroundColor = theme.palette.background.default;

    if (!sessionColor) {
        return theme.palette.text.primary;
    }

    // Session background is drawn with opacity 0.3 over the page background
    const effectiveBackgroundColor = mixColors(sessionColor, backgroundColor, 0.3);

    const contrastWhite = getContrastRatio(effectiveBackgroundColor, '#ffffff');
    const contrastBlack = getContrastRatio(effectiveBackgroundColor, '#000000');

    return contrastWhite >= contrastBlack ? '#ffffff' : '#000000';
}

export function getSessionTextColor(sessionColor, theme) {
    const backgroundColor = theme.palette.background.default;

    if (!sessionColor) {
        return theme.palette.text.primary;
    }

    const effectiveBackgroundColor = mixColors(sessionColor, backgroundColor, 0.3);

    const contrastWhite = getContrastRatio(effectiveBackgroundColor, '#ffffff');
    const contrastBlack = getContrastRatio(effectiveBackgroundColor, '#000000');

    return contrastWhite >= contrastBlack ? '#ffffff' : '#000000';
}
