import React from 'react';
import { render } from '@testing-library/react';
import Loading from './Loading';

describe('Loading Component', () => {
  it('renders linear progress', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.MuiLinearProgress-root')).toBeInTheDocument();
  });

  it('logs error if provided', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Loading error="Test Error" />);
    expect(consoleSpy).toHaveBeenCalledWith('Test Error');
    consoleSpy.mockRestore();
  });
});
