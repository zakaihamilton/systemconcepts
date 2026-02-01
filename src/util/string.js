export function makeCommaSeparatedString(arr, useOxfordComma) {
    const listStart = arr.slice(0, -1).join(", ");
    const listEnd = arr.slice(-1);
    const conjunction = arr.length <= 1 ? "" :
        useOxfordComma && arr.length > 2 ? ", and " : " and ";

    return [listStart, listEnd].join(conjunction);
}

var NUMBER_SUFFIX = ["", "k", "M", "G", "T", "P", "E"];
var SIZE_SUFFIX = ["b", "KB", "MB", "GB", "TB", "PB", "EB"];

export function abbreviateNumber(number) {
    var tier = Math.log10(number) / 3 | 0;
    if (tier == 0) return number;
    var suffix = NUMBER_SUFFIX[tier];
    var scale = Math.pow(10, tier * 3);
    var scaled = number / scale;
    return scaled.toFixed(1) + suffix;
}

export function abbreviateSize(number) {
    var tier = Math.log10(number) / 3 | 0;
    if (tier == 0) return number + "b";
    var suffix = SIZE_SUFFIX[tier];
    var scale = Math.pow(10, tier * 3);
    var scaled = number / scale;
    return scaled.toFixed(1) + suffix;
}

export function isRTL(string) {
    var rtlRegex = /[\u0591-\u07FF]/;
    return rtlRegex.test(string);
}

export function formatDuration(duration, includeHours = false) {
    if (duration === undefined || duration === null || isNaN(duration) || duration < 0) {
        return "00:00";
    }

    const seconds = Math.floor((duration / 1000) % 60);
    const minutes = Math.floor((duration / (1000 * 60)) % 60);
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    const hoursString = (hours || includeHours) ? ((hours < 10) ? "0" + hours : hours) + ":" : "";
    const minutesString = (minutes < 10) ? "0" + minutes : minutes;
    const secondsString = (seconds < 10) ? "0" + seconds : seconds;

    return hoursString + minutesString + ":" + secondsString;
}

export function copyToClipboard(text) {
    if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText(text);
        return true;
    }
    return false;
}

export function normalizeContent(text) {
    if (typeof text !== "string") return "";
    // Split by code blocks to protect them from normalization
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map(part => {
        if (part.startsWith('```')) return part;

        let processed = part.replace(/\r\n/g, "\n");
        // Convert single newlines to double to ensure granular paragraphs
        processed = processed.replace(/\n+/g, (match) => match.length === 1 ? "\n\n" : match);

        // Ensure headers are followed by double newlines to match indexing split
        processed = processed.replace(/^[ \t]*(?!#|-|\*|\d)([A-Z].*?)[ \t]*(\r?\n)/gm, (match, line) => {
            const trimmed = line.trim();
            if (!trimmed) return match;
            if (trimmed.endsWith('.')) return match;
            if (trimmed.endsWith(';')) return match;
            if (trimmed.endsWith(',')) return match;
            if (trimmed.length > 120) return match;
            return `### ${trimmed}\n\n`;
        });
        return processed;
    }).join("");
};

/**
 * Preprocess markdown content to ensure proper line breaks
 * Handles cases where content is all on one line
 */
export function preprocessMarkdown(content) {
    if (!content) return content;

    let result = content;

    // Add line breaks before bold headers (like **Key Points:** or **Main Takeaways:**)
    result = result.replace(/\s*(\*\*[^*]+:\*\*)\s*/g, '\n\n$1\n\n');

    // Add line breaks before list items (- item)
    result = result.replace(/\s+-\s+\*\*/g, '\n\n- **');
    result = result.replace(/\s+-\s+(?!\*)/g, '\n- ');

    // Add line breaks before numbered items (1. item, 2. item, etc.)
    result = result.replace(/\s+(\d+\.)\s+/g, '\n$1 ');

    // Clean up excessive newlines
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
}
