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

export function isRegEx(string) {
    return Object.prototype.toString.call(string) === '[object RegExp]';
}

export function isRTL(string) {
    var rtlRegex = /[\u0591-\u07FF]/;
    return rtlRegex.test(string);
}

export function formatDuration(duration, includeHours = false) {
    const seconds = Math.floor((duration / 1000) % 60);
    const minutes = Math.floor((duration / (1000 * 60)) % 60);
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    const hoursString = (hours || includeHours) ? ((hours < 10) ? "0" + hours : hours) + ":" : "";
    const minutesString = (minutes < 10) ? "0" + minutes : minutes;
    const secondsString = (seconds < 10) ? "0" + seconds : seconds;

    return hoursString + minutesString + ":" + secondsString;
}