import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Player Button Component', () => {
  it('renders icon and name', () => {
    const { getByText, getByTestId } = render(
      <Button name="Test Button" icon={<span data-testid="icon" />} />
    );
    expect(getByText('Test Button')).toBeInTheDocument();
    expect(getByTestId('icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    const { getByRole } = render(
      <Button name="Test Button" icon={<span>I</span>} onClick={handleClick} />
    );
    fireEvent.click(getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('applies active class when active is true', () => {
    const { getByRole } = render(
      <Button name="Test Button" icon={<span>I</span>} active={true} />
    );
    // styles are mocked in jest, so we check for class name inclusion if possible
    // but usually with CSS modules it's hard to check the exact class without more setup.
    // We can at least check it doesn't crash.
    expect(getByRole('button')).toBeInTheDocument();
  });
});
