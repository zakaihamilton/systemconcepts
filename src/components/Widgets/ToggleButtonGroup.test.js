import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ToggleButtonGroupWidget from './ToggleButtonGroup';

describe('ToggleButtonGroup Widget', () => {
  const items = [
    { id: '1', name: 'Option 1' },
    { id: '2', name: 'Option 2' },
  ];

  it('renders buttons with names', () => {
    const setSelected = jest.fn();
    const { getByText } = render(
      <ToggleButtonGroupWidget state={['1', setSelected]} items={items} />
    );
    expect(getByText('Option 1')).toBeInTheDocument();
    expect(getByText('Option 2')).toBeInTheDocument();
  });

  it('calls setSelected when a button is clicked', () => {
    const setSelected = jest.fn();
    const { getByText } = render(
      <ToggleButtonGroupWidget state={['1', setSelected]} items={items} />
    );
    fireEvent.click(getByText('Option 2'));
    // Material UI's ToggleButtonGroup onChange passes the value directly if exclusive
    expect(setSelected).toHaveBeenCalledWith('2');
  });
});
