import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import Tags from './Tags';
import { useTranslations } from "@util/translations";

jest.mock("@util/translations");
jest.mock("@widgets/Tabs", () => ({ state, children, ...props }) => {
    const [tab, setTab] = state;
    return <div data-testid="tabs" {...props}>
        {React.Children.map(children, child => 
            React.cloneElement(child, { onClick: () => setTab(child.props.value) })
        )}
    </div>;
});
jest.mock("@mui/material/Tab", () => ({ label, value, onClick }) => (
    <button data-testid={`tab-${value}`} onClick={onClick}>{label}</button>
));
jest.mock("./Sessions", () => () => <div data-testid="sessions-view" />);
jest.mock("./Library", () => () => <div data-testid="library-view" />);

describe('Tags View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue({ SESSIONS: 'Sessions', LIBRARY: 'Library' });
    localStorage.clear();
  });

  it('renders sessions tab by default', () => {
    const { getByTestId, queryByTestId } = render(<Tags />);
    expect(getByTestId('sessions-view')).toBeInTheDocument();
    expect(queryByTestId('library-view')).not.toBeInTheDocument();
  });

  it('switches to library tab when clicked', () => {
    const { getByTestId, queryByTestId } = render(<Tags />);
    fireEvent.click(getByTestId('tab-library'));
    expect(getByTestId('library-view')).toBeInTheDocument();
    expect(queryByTestId('sessions-view')).not.toBeInTheDocument();
  });
});
