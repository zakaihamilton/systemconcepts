import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import ClearStorage from './ClearStorage';
import { useTranslations } from "@util/translations";
import { goBackPage, replacePath } from "@util/views";
import { clear } from "@storage/local";

jest.mock("@util/translations");
jest.mock("@util/views");
jest.mock("@storage/local");
jest.mock("@widgets/Dialog", () => ({ title, children, actions }) => (
    <div data-testid="dialog">
        <h1>{title}</h1>
        {children}
        <div data-testid="actions">{actions}</div>
    </div>
));

describe('ClearStorage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue({ CLEAR_STORAGE: 'Clear Storage', CANCEL: 'Cancel', CONFIRM_CLEAR_STORAGE: 'Are you sure?' });
  });

  it('renders dialog with confirm message', () => {
    const { getByText } = render(<ClearStorage />);
    expect(getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls goBackPage when cancel is clicked', () => {
    const { getByText } = render(<ClearStorage />);
    fireEvent.click(getByText('Cancel'));
    expect(goBackPage).toHaveBeenCalled();
  });

  it('calls clear and replacePath when reset is clicked', async () => {
    delete window.location;
    window.location = { reload: jest.fn() };
    const { getByText } = render(<ClearStorage />);
    fireEvent.click(getByText('Clear Storage'));
    expect(clear).toHaveBeenCalled();
    // replacePath is called in async reset
    await React.act(async () => {}); 
    expect(replacePath).toHaveBeenCalledWith("");
  });
});
