import Day from "./Day";
import { addDate } from "@/util/date";

export default function Week({ month, date, row, dateFormatter }) {
    const numDays = 7;
    const days = new Array(numDays).fill(0).map((_, index) => {
        const day = addDate(date, index);
        return <Day key={index} month={month} column={index + 1} row={row} date={day} dateFormatter={dateFormatter} />;
    });
    return <>
        {days}
    </>
}