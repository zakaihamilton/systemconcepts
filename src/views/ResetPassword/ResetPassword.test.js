import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import ResetPassword from './ResetPassword';
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
        value={value || ''} 
        onChange={e => setValue(e.target.value)}
        {...props}
    />;
});

describe('ResetPassword View', () => {
  const mockTranslations = {
    RESET_PASSWORD: 'Reset Password',
    CHANGE_PASSWORD: 'Change Password',
    BACK: 'Back',
    ID: 'ID',
    NEW_PASSWORD: 'New Password',
    REMEMBER_ME: 'Remember Me',
    RESET_EMAIL_SENT: 'Reset email sent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue(mockTranslations);
    MainStore.useState.mockReturnValue({ direction: 'ltr' });
    Cookies.get.mockReturnValue(null);
  });

  it('renders reset password form when no code is provided', () => {
    const { getByText, getByTestId, queryByTestId } = render(<ResetPassword />);
    expect(getByText('Reset Password')).toBeInTheDocument();
    expect(getByTestId('input-userid')).toBeInTheDocument();
    expect(queryByTestId('input-newpassword')).not.toBeInTheDocument();
  });

  it('renders change password form when code is provided', () => {
    const { getByText, getByTestId } = render(<ResetPassword path="code123" />);
    expect(getByText('Change Password')).toBeInTheDocument();
    expect(getByTestId('input-userid')).toBeInTheDocument();
    expect(getByTestId('input-newpassword')).toBeInTheDocument();
  });

  it('calls fetchJSON with reset:true when no code is provided', async () => {
    fetchJSON.mockResolvedValue({});
    const { getByRole, getByTestId } = render(<ResetPassword />);
    
    fireEvent.change(getByTestId('input-userid'), { target: { value: 'testuser' } });
    fireEvent.click(getByRole('button', { name: /Reset Password/i }));
    
    await waitFor(() => {
        expect(fetchJSON).toHaveBeenCalledWith('/api/login', expect.objectContaining({
            headers: expect.objectContaining({ reset: true })
        }));
    });
  });

  it('calls fetchJSON with code when code is provided', async () => {
    fetchJSON.mockResolvedValue({ hash: 'newhash' });
    const { getByRole, getByTestId } = render(<ResetPassword path="code123" />);
    
    fireEvent.change(getByTestId('input-userid'), { target: { value: 'testuser' } });
    fireEvent.change(getByTestId('input-newpassword'), { target: { value: 'password123' } });
    fireEvent.click(getByRole('button', { name: /Change Password/i }));
    
    await waitFor(() => {
        expect(fetchJSON).toHaveBeenCalledWith('/api/login', expect.objectContaining({
            headers: expect.objectContaining({ code: 'code123' })
        }));
    });
  });
});
