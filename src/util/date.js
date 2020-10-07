export function getMonthViewStart(date) {
    date = new Date(date);
    date.setDate(1);
    const day = date.getDay();
    const diff = date.getDate() - day;
    const result = new Date(date.setDate(diff));
    return result;
}

export function getWeekViewStart(date) {
    date = new Date(date);
    const day = date.getDay();
    const diff = date.getDate() - day;
    const result = new Date(date.setDate(diff));
    return result;
}

export function addDate(date, index) {
    date = new Date(date);
    date.setDate(date.getDate() + index);
    return date;
}

export function isDateToday(date) {
    const today = new Date();
    return date.getDate() == today.getDate() &&
        date.getMonth() == today.getMonth() &&
        date.getFullYear() == today.getFullYear();
}

export function isDayToday(date) {
    const today = new Date();
    console.log("today", today, "date", date);
    return date.getDay() == today.getDay() &&
        date.getMonth() == today.getMonth() &&
        date.getFullYear() == today.getFullYear();
}

export function isDateMonth(date, month) {
    return date.getMonth() == month.getMonth() &&
        date.getFullYear() == month.getFullYear();
};

export function getWeekOfMonth(date) {
    const firstWeekday = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const offsetDate = date.getDate() + firstWeekday - 1;
    return Math.floor(offsetDate / 7);
}

export function setWeekOfMonth(date, weekNum) {
    const weekOfMonth = getWeekOfMonth(date);
    const offset = date.getDate() + (weekNum - weekOfMonth) * 7;
    console.log("going from: " + weekOfMonth + " to: " + weekNum + " offset: " + offset);
    date.setDate(offset);
    console.log("date", date);
}

export function getNumberOfWeeksInMonth(date) {
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 0);
    return getWeekOfMonth(lastDayOfMonth);
}

export function getMonthNames(date, formatter) {
    date = new Date(date);
    const months = new Array(12).fill(0).map((_, index) => {
        date.setMonth(index);
        return formatter.format(date);
    });
    return months;
}

export function getYearNames(date, formatter, start, end) {
    date = new Date(date);
    const years = new Array(end - start).fill(0).map((_, index) => {
        date.setFullYear(start + index);
        return formatter.format(date);
    });
    return years;
}

export function getDateString(date) {
    let month = '' + (date.getMonth() + 1);
    let day = '' + date.getDate();
    const year = date.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}