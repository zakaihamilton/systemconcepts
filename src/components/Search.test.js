import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { SearchWidget } from './Search';

describe('SearchWidget Component', () => {
  it('renders with placeholder and value', () => {
    const { getByPlaceholderText } = render(
      <SearchWidget 
        placeholder="Search..." 
        value="test" 
        onChange={() => {}} 
      />
    );
    const input = getByPlaceholderText('Search...');
    expect(input.value).toBe('test');
  });

  it('calls onChange when text is entered', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(
      <SearchWidget 
        placeholder="Search..." 
        value="" 
        onChange={onChange} 
      />
    );
    const input = getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'new search' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onEnter when Enter key is pressed', () => {
    const onEnter = jest.fn();
    const { getByPlaceholderText } = render(
      <SearchWidget 
        placeholder="Search..." 
        value="test" 
        onChange={() => {}} 
        onEnter={onEnter} 
      />
    );
    const input = getByPlaceholderText('Search...');
    fireEvent.keyDown(input, { keyCode: 13 });
    expect(onEnter).toHaveBeenCalled();
  });
});
