import { useState } from "react";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Grow from "@mui/material/Grow";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import { useTranslations } from "@util/translations";

export default function ButtonSelector({ state, items, onClick, children, label, ...props }) {
  const translations = useTranslations();
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selected, setSelected] = state;

  const handleMenuItemClick = (event, id) => {
    setSelected(id);
    setOpen(false);
  };

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorEl && anchorEl.contains(event.target)) {
      return;
    }

    setOpen(false);
  };

  return (
    <>
      <ButtonGroup ref={setAnchorEl} {...props}>
        <Button disabled={!onClick} onClick={onClick}>{children}</Button>
        {items && <Button
          aria-label={label || translations.OPTIONS}
          onClick={handleToggle}
        >
          <ArrowDropDownIcon />
        </Button>}
      </ButtonGroup>
      <Popper open={open} anchorEl={anchorEl} role={undefined} transition>
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
