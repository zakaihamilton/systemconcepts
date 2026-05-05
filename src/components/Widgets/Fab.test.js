import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import FloatingActionButtons from './Fab';

describe('Fab Widget', () => {
  it('renders icon and title', () => {
    const { getByLabelText, getByTestId } = render(
      <FloatingActionButtons title="Add" icon={<span data-testid="icon" />} />
    );
    expect(getByLabelText('Add')).toBeInTheDocument();
    expect(getByTestId('icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    const { getByRole } = render(
      <FloatingActionButtons title="Add" icon={<span>+</span>} onClick={handleClick} />
    );
    fireEvent.click(getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
