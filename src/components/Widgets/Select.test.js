import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import SelectWidget from './Select';

describe('Select Widget', () => {
  it('renders checked when item is in select array', () => {
    const item = { id: '1' };
    const select = [{ id: '1' }];
    const { getByRole } = render(<SelectWidget item={item} select={select} />);
    const checkbox = getByRole('checkbox');
    expect(checkbox.checked).toBe(true);
  });

  it('renders unchecked when item is not in select array', () => {
    const item = { id: '2' };
    const select = [{ id: '1' }];
    const { getByRole } = render(<SelectWidget item={item} select={select} />);
    const checkbox = getByRole('checkbox');
    expect(checkbox.checked).toBe(false);
  });

  it('calls store.update when checkbox is toggled', () => {
    const item = { id: '1' };
    const select = [];
    const store = { update: jest.fn() };
    const { getByRole } = render(<SelectWidget item={item} select={select} store={store} />);
    const checkbox = getByRole('checkbox');
    
    fireEvent.click(checkbox);
    expect(store.update).toHaveBeenCalled();
  });
});
