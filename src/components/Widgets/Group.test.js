import React from 'react';
import { render } from '@testing-library/react';
import Group from './Group';

describe('Group Widget', () => {
  it('renders capitalized name', () => {
    const { getByText } = render(<Group name="test" />);
    expect(getByText('Test')).toBeInTheDocument();
  });

  it('applies color to background', () => {
    const { container } = render(<Group name="test" color="red" />);
    const backgrounds = container.querySelectorAll(`[style*="background-color: red"]`);
    expect(backgrounds.length).toBeGreaterThan(0);
  });
});
