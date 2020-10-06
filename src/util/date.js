export function getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();;
}

export function getFirstDay(date) {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return firstDay;
}

export function getLastDay(date) {
    const lastDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return lastDay;
}

export function getLongDayName(dateStr, locale) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { weekday: 'long' });
}

export function getShortDayName(dateStr, locale) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { weekday: 'short' });
}

export function getWeek(date) {
    const dates = [];
    for (i = 0; i < 7; i++) {
        dates.push(date);
        date.setDate(date.getDate() + 1);
    }
    return dates;
}

export function getSunday(date) {
    date = new Date(date);
    const day = date.getDay();
    const diff = date.getDate() - day + (day == 6 ? -6 : 0);
    const result = new Date(date.setDate(diff));
    return result;
}

export function addDate(date, index) {
    date = new Date(date);
    date.setDate(date.getDate() + index);
    return date;
}

export function isDateToday(date) {
    const today = new Date()
    return date.getDate() == today.getDate() &&
        date.getMonth() == today.getMonth() &&
        date.getFullYear() == today.getFullYear();
}