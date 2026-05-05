import React from 'react';
import { render } from '@testing-library/react';
import Footer from './Footer';
import { useDeviceType } from "@util/styles";
import { useToolbarItems } from "./Toolbar";

jest.mock("@util/styles");
jest.mock("./Toolbar", () => {
    const ActualToolbar = ({ location }) => <div data-testid={`toolbar-${location}`} />;
    return {
        __esModule: true,
        default: ActualToolbar,
        useToolbarItems: jest.fn(),
    };
});

describe('Footer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing if no items are present', () => {
    useToolbarItems.mockReturnValue([]);
    const { container } = render(<Footer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders footer toolbar if footer items are present', () => {
    useToolbarItems.mockImplementation(({ location }) => location === 'footer' ? [{ id: 'test' }] : []);
    const { getByTestId } = render(<Footer />);
    expect(getByTestId('toolbar-footer')).toBeInTheDocument();
  });

  it('renders mobile toolbar if on phone and mobile items are present', () => {
    useDeviceType.mockReturnValue('phone');
    useToolbarItems.mockImplementation(({ location }) => location === 'mobile' ? [{ id: 'test' }] : []);
    const { getByTestId } = render(<Footer />);
    expect(getByTestId('toolbar-mobile')).toBeInTheDocument();
  });
});
