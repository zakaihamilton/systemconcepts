import React from "react";
import Checkbox from "@material-ui/core/Checkbox";
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
  console.log("checked", checked, "id", id);

  return (<Checkbox
    classes={{ root: styles.root }}
    checked={checked}
    onChange={selectItem} />);
}
