import React from 'react';
import { render } from '@testing-library/react';
import Theme from './Theme';
import { useDirection } from "@util/direction";
import useDarkMode from 'use-dark-mode';
import { MainStore } from '@components/Main';

jest.mock('@util/direction');
jest.mock('use-dark-mode');
jest.mock('@components/Main', () => ({
  MainStore: {
    useState: jest.fn(),
  },
}));

describe('Theme Component', () => {
  beforeEach(() => {
    useDirection.mockReturnValue('ltr');
    useDarkMode.mockReturnValue({ value: false });
    MainStore.useState.mockImplementation((selector) => selector({ fontSize: '16px' }));
  });

  it('renders children within ThemeProvider', () => {
    const { getByText } = render(
      <Theme>
        <div>Test Child</div>
      </Theme>
    );
    expect(getByText('Test Child')).toBeInTheDocument();
  });

  it('sets data-theme attribute on document element', () => {
    useDarkMode.mockReturnValue({ value: true });
    render(<Theme><div>Test</div></Theme>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sets font-size on body', () => {
    MainStore.useState.mockImplementation((selector) => selector({ fontSize: '20px' }));
    render(<Theme><div>Test</div></Theme>);
    expect(document.body.style.fontSize).toBe('20px');
  });
});
