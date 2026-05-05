import React from 'react';
import { render } from '@testing-library/react';
import Toolbar, { ToolbarStore, registerToolbar, useToolbar, useToolbarItems } from './Toolbar';
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";

jest.mock("@util/styles");
jest.mock("@util/translations");
jest.mock("./Toolbar/Item", () => ({ item }) => <div data-testid={`item-${item.id}`}>{item.name}</div>);
jest.mock("@widgets/Menu", () => ({ children }) => <div data-testid="menu">{children}</div>);

describe('Toolbar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ToolbarStore.update(s => {
      s.sections = [];
    });
    useTranslations.mockReturnValue({ MENU: 'Menu' });
    useDeviceType.mockReturnValue('desktop');
  });

  it('renders nothing if no items are present', () => {
    const { container } = render(<Toolbar />);
    expect(container.querySelector('.visible')).toBeNull();
  });

  it('registers and displays toolbar items', () => {
    registerToolbar('test-section', 1);
    
    function TestComponent() {
        useToolbar({ id: 'test-section', items: [{ id: 'item1', name: 'Item 1' }] });
        return <Toolbar />;
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('item-item1')).toBeInTheDocument();
  });

  it('handles menu items correctly', () => {
    registerToolbar('test-section', 1);
    
    function TestComponent() {
        useToolbar({ id: 'test-section', items: [
            { id: 'item1', name: 'Item 1', menu: true },
            { id: 'item2', name: 'Item 2', menu: true }
        ] });
        return <Toolbar />;
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('menu')).toBeInTheDocument();
  });
});
