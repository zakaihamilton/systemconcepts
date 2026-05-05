import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import BreadcrumbsWidget, { BreadcrumbItem } from './Breadcrumbs';
import { MainStore } from "@components/Main";
import { useDeviceType } from "@util/styles";
import { setHash } from "@util/views";

jest.mock("@components/Main", () => ({
  MainStore: {
    useState: jest.fn(),
  },
}));
jest.mock("@util/styles");
jest.mock("@util/views");
jest.mock("./AppBar/SidebarIcon", () => () => <div data-testid="sidebar-icon" />);
jest.mock("@components/Toolbar", () => () => <div data-testid="toolbar" />);

describe('BreadcrumbItem Component', () => {
  beforeEach(() => {
    MainStore.useState.mockReturnValue({ direction: 'ltr' });
    useDeviceType.mockReturnValue('desktop');
  });

  it('renders label correctly', () => {
    const { getByText } = render(
      <BreadcrumbItem 
        index={1} 
        count={2} 
        label="Test Page" 
        name="test" 
        href="#test" 
      />
    );
    expect(getByText('Test Page')).toBeInTheDocument();
  });

  it('calls setHash when clicked', () => {
    const { getByRole } = render(
      <BreadcrumbItem 
        index={0} 
        count={2} 
        label="Home" 
        href="#home" 
      />
    );
    fireEvent.click(getByRole('link'));
    expect(setHash).toHaveBeenCalledWith('#home');
  });
});

describe('BreadcrumbsWidget Component', () => {
  beforeEach(() => {
    useDeviceType.mockReturnValue('desktop');
  });

  it('renders a list of breadcrumbs', () => {
    const items = [
      { id: 'home', name: 'Home', url: 'home' },
      { id: 'sub', name: 'Sub', url: 'sub' }
    ];
    const { getByText } = render(<BreadcrumbsWidget items={items} />);
    expect(getByText('Home')).toBeInTheDocument();
    expect(getByText('Sub')).toBeInTheDocument();
  });
});
