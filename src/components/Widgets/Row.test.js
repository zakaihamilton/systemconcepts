import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import RowWidget from './Row';
import { useDirection } from "@util/direction";

jest.mock("@util/direction");

describe('Row Widget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDirection.mockReturnValue('ltr');
  });

  it('renders children and icons', () => {
    const { getByText, getByTestId } = render(
      <RowWidget icons={<span data-testid="icon" />}>
        Row Content
      </RowWidget>
    );
    expect(getByText('Row Content')).toBeInTheDocument();
    expect(getByTestId('icon')).toBeInTheDocument();
  });

  it('calls onClick when background link is clicked', () => {
    const handleClick = jest.fn();
    const { getByText } = render(
      <RowWidget onClick={handleClick}>
        Clickable Row
      </RowWidget>
    );
    fireEvent.click(getByText('Clickable Row'));
    expect(handleClick).toHaveBeenCalled();
  });
});
