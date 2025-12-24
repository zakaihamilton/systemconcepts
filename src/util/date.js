export function getMonthViewStart(date) {
    date = getWeekViewEnd(date);
    date.setDate(1);
    const day = date.getDay();
    const diff = date.getDate() - day;
    date.setDate(diff);
    return date;
}

export function getMonthViewEnd(date) {
    date = new Date(date);
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    const day = date.getDay();
    const diff = date.getDate() - day + 6;
    date.setDate(diff);
    return date;
}

export function getWeekViewStart(date) {
    date = new Date(date);
    const day = date.getDay();
    const diff = date.getDate() - day;
    date.setDate(diff);
    return date;
}

export function getWeekViewEnd(date) {
    date = getWeekViewStart(date);
    const diff = date.getDate() + 6;
    date.setDate(diff);
    return date;
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
    return date.getDay() == today.getDay() &&
        date.getMonth() == today.getMonth() &&
        date.getFullYear() == today.getFullYear();
}

export function isDateMonth(date, month) {
    return date.getMonth() == month.getMonth() &&
        date.getFullYear() == month.getFullYear();
};

export function diffDays(from, to) {
    const utc1 = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const utc2 = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    const diffTime = Math.abs(utc2 - utc1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

export function getWeekOfMonth(date) {
    const firstDayOfWeek = getWeekViewStart(date);
    const firstDayOfMonth = getMonthViewStart(date);
    const offsetDate = diffDays(firstDayOfWeek, firstDayOfMonth);
    const result = Math.floor(offsetDate / 7);
    return result;
}

export function setWeekOfMonth(date, weekNum) {
    const weekOfMonth = getWeekOfMonth(date);
    const offset = date.getDate() + (weekNum - weekOfMonth) * 7;
    date.setDate(offset);
}

export function getNumberOfWeeksInMonth(date) {
    let maxIndex = getWeekOfMonth(date);
    while (true) {
        date = addDate(date, 7);
        const index = getWeekOfMonth(date);
        if (index <= maxIndex) {
            break;
        }
        maxIndex = index;
    }
    return maxIndex + 1;
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
    let month = "" + (date.getMonth() + 1);
    let day = "" + date.getDate();
    const year = date.getFullYear();

    if (month.length < 2)
        month = "0" + month;
    if (day.length < 2)
        day = "0" + day;

    return [year, month, day].join("-");
}