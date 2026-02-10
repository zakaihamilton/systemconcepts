import {makeCommaSeparatedString} from "./string";

function getTimeFromSeconds(time) {
    time = Number(time);
    const h = Math.floor(time / 3600);
    const m = Math.floor(time % 3600 / 60);
    const s = Math.floor(time % 3600 % 60);
    return [h, m, s];
}

function getTimeTextFromSeconds(time, {singleNumber}) {
    const [h, m, s] = getTimeFromSeconds(time);
    let hDisplay = "", mDisplay = "", sDisplay = "";
    if(singleNumber) {
        hDisplay = h > 0 ? h + (h == 1 ? " hour" : " hours") : "";
        mDisplay = m > 0 ? m + (m == 1 ? " minute" : " minutes") : "";
        sDisplay = s >= 0 ? s + (s == 1 ? " second" : " seconds") : "";
    }
    else {
        hDisplay = h > 0 ? (h == 1 ? "hour" : h + " hours") : "";
        mDisplay = m > 0 ? (m == 1 ? "minute" : m + " minutes") : "";
        sDisplay = s > 0 ? (s == 1 ? "second" : s + " seconds") : "";
    }
    return [hDisplay, mDisplay, sDisplay];
}

export function formatUpdatedTime(time) {
    const [hDisplay, mDisplay, sDisplay] = getTimeTextFromSeconds(time, {singleNumber:true});
    return `Updated ${hDisplay || mDisplay || sDisplay} ago`;
}

export function formatUpdatedDuration(time) {
    const [hDisplay, mDisplay, sDisplay] = getTimeTextFromSeconds(time, {singleNumber:false});
    const timeText = makeCommaSeparatedString([hDisplay, mDisplay, sDisplay].filter(Boolean), true);
    return `Updates every ${timeText}`;
}