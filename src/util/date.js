export function getMonthViewStart(date) {
    date = new Date(date);
    // Set to the 1st of the month
    date.setDate(1);
    // Get the day of week (0 = Sunday, 6 = Saturday)
    const day = date.getDay();
    // Go back to the Sunday before or on the 1st
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
    let result = Math.floor(offsetDate / 7);

    // Cap at week 4 (0-indexed, so 0-4 = weeks 1-5)
    result = Math.min(result, 4);

    return result;
}

export function setWeekOfMonth(date, weekNum) {
    const weekOfMonth = getWeekOfMonth(date);
    const offset = date.getDate() + (weekNum - weekOfMonth) * 7;
    date.setDate(offset);
}

export function getNumberOfWeeksInMonth(date) {
    if (!date || isNaN(date.getTime())) {
        return 0;
    }

    // Get the first day shown in the month view (Sunday before or on the 1st)
    const startDate = getMonthViewStart(date);

    // Get the last day of the month
    const monthDate = new Date(date);
    monthDate.setDate(1);
    monthDate.setMonth(monthDate.getMonth() + 1);
    monthDate.setDate(0); // Last day of the current month

    // Count weeks from start until we've covered the entire month
    let currentDate = new Date(startDate);
    let weekCount = 0;

    while (currentDate <= monthDate) {
        weekCount++;
        currentDate = addDate(currentDate, 7);
    }

    // Cap at 5 weeks maximum - week 6 should be the first week of next month
    return Math.min(weekCount, 5);
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
    const years = new Array(end - start + 1).fill(0).map((_, index) => {
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

export function getDaysInMonth(date) {
    const month = new Date(date);
    month.setMonth(month.getMonth() + 1);
    month.setDate(0);
    return month.getDate();
}
