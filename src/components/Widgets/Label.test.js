import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import LabelWidget from './Label';

describe('Label Widget', () => {
  it('renders name and children', () => {
    const { getByText } = render(
      <LabelWidget name="Test Label">
        <span>Child Content</span>
      </LabelWidget>
    );
    expect(getByText('Test Label')).toBeInTheDocument();
    expect(getByText('Child Content')).toBeInTheDocument();
  });

  it('renders as a button when onClick is provided', () => {
    const handleClick = jest.fn();
    const { getByRole } = render(
      <LabelWidget name="Click Me" onClick={handleClick} />
    );
    const button = getByRole('button');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalled();
  });

  it('renders icon when provided', () => {
    const { getByTestId } = render(
      <LabelWidget name="Test" icon={<span data-testid="icon" />} />
    );
    expect(getByTestId('icon')).toBeInTheDocument();
  });
});
