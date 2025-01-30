import React, { useState, useRef } from "react";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Grow from "@mui/material/Grow";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";

export default function ButtonSelector({ state, items, onClick, children, ...props }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const [selected, setSelected] = state;

  const handleMenuItemClick = (event, id) => {
    setSelected(id);
    setOpen(false);
  };

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }

    setOpen(false);
  };

  return (
    <>
      <ButtonGroup ref={anchorRef} {...props}>
        <Button disabled={!onClick} onClick={onClick}>{children}</Button>
        {items && <Button
          onClick={handleToggle}
        >
          <ArrowDropDownIcon />
        </Button>}
      </ButtonGroup>
      <Popper open={open} anchorEl={anchorRef.current} role={undefined} transition>
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{
              transformOrigin: placement === "bottom" ? "center top" : "center bottom",
            }}
          >
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList>
                  {items.map(item => (
                    <MenuItem
                      key={item.id}
                      selected={item.id === selected}
                      onClick={(event) => handleMenuItemClick(event, item.id)}
                    >
                      {item.name}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}
