import Day from "./Day";
import { addDate } from "@util/date";

export default function Week({ sessions, month, date, row, rowCount, dateFormatter, store, onMenuVisible }) {
    const numDays = 7;
    const days = new Array(numDays).fill(0).map((_, index) => {
        const day = addDate(date, index);
        return <Day sessions={sessions} key={index} month={month} column={index + 1} row={row} rowCount={rowCount} columnCount={numDays} date={day} dateFormatter={dateFormatter} store={store} onMenuVisible={onMenuVisible} />;
    });
    return <>
        {days}
    </>;
}