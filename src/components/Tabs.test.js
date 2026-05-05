import React from 'react';
import { render } from '@testing-library/react';
import Tabs from './Tabs';
import { useActivePages } from "@util/views";
import { MainStore } from "@components/Main";

jest.mock("@util/views");
jest.mock("@components/Main", () => ({
  MainStore: {
    useState: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock("@widgets/Tabs", () => ({ children }) => <div data-testid="tabs-widget">{children}</div>);

describe('Tabs Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing if no page with tabs is active', () => {
    useActivePages.mockReturnValue([{ id: 'home' }]);
    MainStore.useState.mockReturnValue({ hash: '#home' });
    const { container } = render(<Tabs />);
    expect(container.firstChild).toBeNull();
  });

  it('renders tabs of the active page', () => {
    const MockTabs = ({ Container }) => <Container><div>Mocked Tabs Content</div></Container>;
    useActivePages.mockReturnValue([{ id: 'page-with-tabs', tabs: MockTabs }]);
    MainStore.useState.mockReturnValue({ hash: '#test' });
    
    const { getByTestId, getByText } = render(<Tabs />);
    expect(getByTestId('tabs-widget')).toBeInTheDocument();
    expect(getByText('Mocked Tabs Content')).toBeInTheDocument();
  });
});
