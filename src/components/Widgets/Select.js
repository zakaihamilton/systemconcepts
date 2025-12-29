import React from "react";
import Checkbox from "@mui/material/Checkbox";
import styles from "./Select.module.scss";

export default function SelectWidget({ item, store, select }) {
  const { id } = item;
  const selectItem = (event) => {
    const { checked } = event.target;
    store.update(s => {
      if (checked) {
        s.select = [...select, item];
      }
      else {
        s.select = select.filter(item => item.id !== id);
      }
    });
  };

  const checked = select.find(item => item.id === id) ? true : false;

  return (<Checkbox
    color="default"
    classes={{ root: styles.root }}
    checked={checked}
    onClick={e => e.stopPropagation()}
    onChange={selectItem} />);
}
