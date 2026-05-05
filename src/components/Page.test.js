import React from 'react';
import { render } from '@testing-library/react';
import Page from './Page';
import { useDeviceType } from "@util/styles";

jest.mock("@util/styles");
jest.mock("./Footer", () => () => <div data-testid="footer" />);
jest.mock("./Tabs", () => () => <div data-testid="tabs" />);
jest.mock("./Page/Content", () => () => <div data-testid="content" />);

describe('Page Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tabs at the top for desktop', () => {
    useDeviceType.mockReturnValue('desktop');
    const { getByTestId } = render(<Page />);
    const tabs = getByTestId('tabs');
    const content = getByTestId('content');
    expect(tabs.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders tabs at the bottom for phone', () => {
    useDeviceType.mockReturnValue('phone');
    const { getByTestId } = render(<Page />);
    const tabs = getByTestId('tabs');
    const content = getByTestId('content');
    expect(tabs.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('always renders content and footer', () => {
    const { getByTestId } = render(<Page />);
    expect(getByTestId('content')).toBeInTheDocument();
    expect(getByTestId('footer')).toBeInTheDocument();
  });
});
