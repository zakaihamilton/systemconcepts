import React from 'react';
import { render } from '@testing-library/react';
import Save from './Save';
import { useTranslations } from "@util/translations";
import { registerToolbar, useToolbar } from "@components/Toolbar";

jest.mock("@util/translations");
jest.mock("@components/Toolbar", () => ({
    registerToolbar: jest.fn(),
    useToolbar: jest.fn(),
}));
jest.mock("@widgets/Progress", () => () => <div data-testid="progress" />);

describe('Save Widget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue({ SAVE: 'Save', SAVING: 'Saving' });
  });

  it('calls useToolbar with save item when visible', () => {
    render(<Save visible={true} saving={false} />);
    expect(useToolbar).toHaveBeenCalled();
    const callArgs = useToolbar.mock.calls[0][0];
    expect(callArgs.items[0].name).toBe('Save');
  });

  it('shows progress when saving', () => {
    render(<Save visible={true} saving={true} />);
    expect(useToolbar).toHaveBeenCalled();
    const callArgs = useToolbar.mock.calls[0][0];
    expect(callArgs.items[0].name).toBe('Saving');
    // Check if the icon is the mocked progress
    const icon = render(callArgs.items[0].icon);
    expect(icon.getByTestId('progress')).toBeInTheDocument();
  });
});
