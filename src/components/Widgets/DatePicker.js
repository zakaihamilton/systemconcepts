import "date-fns";
import React from "react";
import DateFnsUtils from "@date-io/date-fns";
import {
    MuiPickersUtilsProvider,
    KeyboardDatePicker,
} from "@material-ui/pickers";

function getDateLocaleFormat() {
    let customDate = new Date(2222, 11, 18);
    let strDate = customDate.toLocaleDateString();
    let format = strDate
        .replace("12", "MM")
        .replace("18", "dd")
        .replace("2222", "yyyy");
    return format;
}

export default function DatePicker({ label, state }) {
    const [date, setDate] = state;
    const handleDateChange = (date) => {
        setDate(date);
    };
    const dateFormat = getDateLocaleFormat();

    return (
        <MuiPickersUtilsProvider utils={DateFnsUtils}>
            <KeyboardDatePicker
                inputVariant="filled"
                clearable={true}
                label={label}
                format={dateFormat}
                value={date}
                fullWidth={true}
                onChange={handleDateChange}
            />
        </MuiPickersUtilsProvider>
    );
}
