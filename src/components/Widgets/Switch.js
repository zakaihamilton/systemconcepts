import React, { useState, useEffect } from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';

export default function SwitchWidget({ label, state, off = false, on = true }) {
    const [value, setValue] = state || [];
    const [checked, setChecked] = useState(value);
    const handleChange = (event) => {
        const { checked } = event.target;
        const value = checked ? on : off;
        setValue(value);
    };

    useEffect(() => {
        setChecked(value);
    }, [value]);

    return (
        <FormGroup row>
            <FormControlLabel
                control={<Switch color="primary" checked={checked === on} onChange={handleChange} />}
                label={label}
            />
        </FormGroup>
    );
}
