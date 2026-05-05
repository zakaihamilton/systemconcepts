import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import SignUp from './SignUp';
import { useTranslations } from "@util/translations";
import { MainStore } from "@components/Main";
import { fetchJSON } from "@util/fetch";
import Cookies from "js-cookie";
import { setPath, setHash } from "@util/views";

jest.mock("@util/translations");
jest.mock("@components/Main", () => ({
  MainStore: {
    useState: jest.fn(),
  },
}));
jest.mock("@util/fetch");
jest.mock("js-cookie");
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

describe('SignUp View', () => {
  const mockTranslations = {
    SIGN_UP: 'Sign Up',
    BACK: 'Back',
    ID: 'ID',
    FIRST_NAME: 'First Name',
    LAST_NAME: 'Last Name',
    EMAIL_ADDRESS: 'Email Address',
    PASSWORD: 'Password',
    REMEMBER_ME: 'Remember Me',
    HAVE_ACCOUNT: 'Already have an account? Sign In',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue(mockTranslations);
    MainStore.useState.mockReturnValue({ direction: 'ltr' });
  });

  it('renders sign up form', () => {
    const { getByText, getByTestId } = render(<SignUp />);
    expect(getByText('Sign Up')).toBeInTheDocument();
    expect(getByTestId('input-username')).toBeInTheDocument();
    expect(getByTestId('input-fname')).toBeInTheDocument();
    expect(getByTestId('input-lname')).toBeInTheDocument();
    expect(getByTestId('input-email')).toBeInTheDocument();
    expect(getByTestId('input-password')).toBeInTheDocument();
  });

  it('calls fetchJSON on submit', async () => {
    fetchJSON.mockResolvedValue({ hash: 'newhash' });
    const { getByRole, getByTestId } = render(<SignUp />);
    
    fireEvent.change(getByTestId('input-username'), { target: { value: 'testuser' } });
    fireEvent.change(getByTestId('input-fname'), { target: { value: 'Test' } });
    fireEvent.change(getByTestId('input-lname'), { target: { value: 'User' } });
    fireEvent.change(getByTestId('input-email'), { target: { value: 'test@example.com' } });
    fireEvent.change(getByTestId('input-password'), { target: { value: 'password123' } });
    
    fireEvent.click(getByRole('button', { name: /Sign Up/i }));
    
    await waitFor(() => {
        expect(fetchJSON).toHaveBeenCalledWith('/api/login', expect.objectContaining({
            method: 'PUT'
        }));
    });
  });

  it('calls setHash("account") when back button is clicked', () => {
    const { getByRole } = render(<SignUp />);
    fireEvent.click(getByRole('button', { name: /Back/i }));
    expect(setHash).toHaveBeenCalledWith('account');
  });
});
