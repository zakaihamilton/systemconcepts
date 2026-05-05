import React from 'react';
import { render, waitFor } from '@testing-library/react';
import Library from './Library';
import storage from "@util/storage";
import { usePathItems } from "@util/views";
import { SyncActiveStore } from "@sync/syncState";
import Cookies from "js-cookie";

jest.mock("@util/storage");
jest.mock("@util/views");
jest.mock("@sync/syncState", () => ({
    SyncActiveStore: {
        useState: jest.fn().mockReturnValue(0),
    }
}));
jest.mock("./Store", () => ({
    LibraryStore: {
        update: jest.fn(),
        getRawState: jest.fn().mockReturnValue({}),
    }
}));
jest.mock("js-cookie");
jest.mock("./Article", () => () => <div data-testid="article" />);
jest.mock("./EditTagsDialog", () => () => <div data-testid="edit-tags-dialog" />);
jest.mock("./EditContentDialog", () => () => <div data-testid="edit-content-dialog" />);
jest.mock("@components/Toolbar", () => ({ registerToolbar: jest.fn() }));

describe('Library View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePathItems.mockReturnValue(['library']);
    Cookies.get.mockReturnValue('visitor');
    storage.exists.mockResolvedValue(false);
  });

  it('renders article component', async () => {
    const { getByTestId } = render(<Library />);
    expect(getByTestId('article')).toBeInTheDocument();
  });

  it('loads tags from storage on mount', async () => {
    storage.exists.mockResolvedValue(true);
    storage.readFile.mockResolvedValue(JSON.stringify([{ _id: '1', name: 'Tag 1', path: 'p1' }]));
    
    render(<Library />);
    
    await waitFor(() => {
        expect(storage.readFile).toHaveBeenCalled();
    });
  });
});
