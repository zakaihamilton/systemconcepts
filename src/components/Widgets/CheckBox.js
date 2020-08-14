import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";

const useStyles = makeStyles({
  root: {
    display: "flex",
    paddingBottom: "1em",
    alignItems: "center",
    marginLeft: "0.8em"
  },
});

export default function CheckBox({ state, label }) {
  const classes = useStyles();
  const [value, setValue] = state;
  const onChange = event => {
    const { checked } = event.target;
    setValue(checked);
  };

  return (<FormControlLabel
    className={classes.root}
    control={
      <Checkbox
        checked={!!value || false}
        onChange={onChange}
        color="primary"
      />
    }
    label={label}
  />);
}
