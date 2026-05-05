import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import Dialog from './Dialog';
import { useTranslations } from "@util/translations";

jest.mock("@util/translations");

describe('Dialog Widget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue({ CLOSE: 'Close' });
  });

  it('renders title and children', () => {
    const { getByText } = render(
      <Dialog title="Test Title">
        <div>Content</div>
      </Dialog>
    );
    expect(getByText('Test Title')).toBeInTheDocument();
    expect(getByText('Content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = jest.fn();
    const { getByLabelText } = render(
      <Dialog title="Test Title" onClose={handleClose} />
    );
    fireEvent.click(getByLabelText('Close'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders actions when provided', () => {
    const { getByText } = render(
      <Dialog title="Test Title" actions={<button>Action</button>} />
    );
    expect(getByText('Action')).toBeInTheDocument();
  });
});
