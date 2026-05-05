import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import SpeedDialWidget from './SpeedDial';
import { MainStore } from "@components/Main";
import { useTranslations } from "@util/translations";

jest.mock("@components/Main", () => ({
    MainStore: {
        useState: jest.fn().mockReturnValue({ direction: 'ltr' }),
    }
}));
jest.mock("@util/translations");

describe('SpeedDial Widget', () => {
  const items = [
    { id: '1', name: 'Action 1', icon: <span data-testid="icon1" />, onClick: jest.fn() },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue({ MENU: 'Menu' });
  });

  it('renders and opens on click', () => {
    const { getByLabelText, getByText } = render(<SpeedDialWidget items={items} />);
    const fab = getByLabelText('Menu');
    
    fireEvent.click(fab);
    expect(getByText('Action 1')).toBeInTheDocument();
  });

  it('calls item onClick when action is clicked', () => {
    const { getByLabelText, getByText } = render(<SpeedDialWidget items={items} />);
    fireEvent.click(getByLabelText('Menu'));
    fireEvent.click(getByText('Action 1'));
    expect(items[0].onClick).toHaveBeenCalled();
  });
});
