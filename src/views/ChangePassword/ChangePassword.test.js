import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import ChangePassword from './ChangePassword';
import { useTranslations } from "@util/translations";
import { MainStore } from "@components/Main";
import Cookies from "js-cookie";
import { fetchJSON } from "@util/fetch";
import { setPath, setHash } from "@util/views";

jest.mock("@util/translations");
jest.mock("@components/Main", () => ({
  MainStore: {
    useState: jest.fn(),
  },
}));
jest.mock("js-cookie");
jest.mock("@util/fetch");
jest.mock("@util/views");
jest.mock("@widgets/Input", () => ({ state, label, onValidate, validate, ...props }) => {
    const [value, setValue] = state;
    return <input 
        data-testid={`input-${props.name}`} 
        value={value} 
        onChange={e => setValue(e.target.value)}
        {...props}
    />;
});

describe('ChangePassword View', () => {
  const mockTranslations = {
    CHANGE_PASSWORD: 'Change Password',
    BACK: 'Back',
    ID: 'ID',
    OLD_PASSWORD: 'Old Password',
    NEW_PASSWORD: 'New Password',
    REMEMBER_ME: 'Remember Me',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue(mockTranslations);
    MainStore.useState.mockReturnValue({ direction: 'ltr' });
    Cookies.get.mockReturnValue('testuser');
  });

  it('renders change password form', () => {
    const { getByText, getByTestId } = render(<ChangePassword />);
    expect(getByText('Change Password')).toBeInTheDocument();
    expect(getByTestId('input-userid')).toBeInTheDocument();
    expect(getByTestId('input-oldpassword')).toBeInTheDocument();
    expect(getByTestId('input-newpassword')).toBeInTheDocument();
  });

  it('calls fetchJSON on submit', async () => {
    fetchJSON.mockResolvedValue({ hash: 'newhash' });
    const { getByText, getByTestId } = render(<ChangePassword />);
    
    fireEvent.change(getByTestId('input-oldpassword'), { target: { value: 'oldpassword123' } });
    fireEvent.change(getByTestId('input-newpassword'), { target: { value: 'newpassword123' } });
    
    fireEvent.click(getByText('Change Password'));
    
    await waitFor(() => {
        expect(fetchJSON).toHaveBeenCalledWith('/api/login', expect.objectContaining({
            method: 'PUT'
        }));
    });
  });

  it('calls setHash("account") when back button is clicked', () => {
    const { getByRole } = render(<ChangePassword />);
    fireEvent.click(getByRole('button', { name: /Back/i }));
    expect(setHash).toHaveBeenCalledWith('account');
  });
});
