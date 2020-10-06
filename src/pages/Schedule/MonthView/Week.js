import Day from "./Day";
import { addDate } from "@/util/date";

export default function Week({ date, row, dateFormatter }) {
    const numDays = 7;
    const days = new Array(numDays).fill(0).map((_, index) => {
        const day = addDate(date, index);
        return <Day key={index} column={index + 1} row={row} date={day} dateFormatter={dateFormatter} />;
    });
    return <>
        {days}
    </>
}