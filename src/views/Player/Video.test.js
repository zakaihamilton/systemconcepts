import React from 'react';
import { render } from '@testing-library/react';
import Video from './Video';
import { PlayerStore } from "./Player";

jest.mock("./Controls", () => () => <div data-testid="controls" />);
jest.mock("./Toolbar", () => () => <div data-testid="toolbar" />);
jest.mock("./Player", () => ({
    PlayerStore: {
        update: jest.fn(),
    }
}));

describe('Video Component', () => {
  it('renders video element and sub-components', () => {
    const { getByTestId } = render(
      <Video show={true} name="Test Video" group="testgroup" color="blue" />
    );
    expect(getByTestId('controls')).toBeInTheDocument();
    expect(getByTestId('toolbar')).toBeInTheDocument();
  });
});
