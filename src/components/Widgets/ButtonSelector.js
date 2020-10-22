import React from 'react';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import Grow from '@material-ui/core/Grow';
import Paper from '@material-ui/core/Paper';
import Popper from '@material-ui/core/Popper';
import MenuItem from '@material-ui/core/MenuItem';
import MenuList from '@material-ui/core/MenuList';

export default function ButtonSelector({ state, items, onClick, children, ...props }) {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef(null);
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
              transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom',
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
