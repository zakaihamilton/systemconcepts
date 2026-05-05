import React from 'react';
import { render } from '@testing-library/react';
import BookmarksPage, { BookmarksStore } from './Bookmarks';
import { useTranslations } from "@util/translations";
import { BookmarksStore as Bookmarks } from "@components/Bookmarks";
import { usePages } from "@util/views";

jest.mock("@util/translations");
jest.mock("@components/Bookmarks", () => ({
    BookmarksStore: {
        useState: jest.fn().mockReturnValue({ bookmarks: [] }),
        update: jest.fn(),
    }
}));
jest.mock("@components/Main", () => ({
    MainStore: {
        update: jest.fn(),
    }
}));
jest.mock("@util/views", () => ({
    usePages: jest.fn().mockReturnValue([]),
    getPagesFromHash: jest.fn().mockReturnValue([]),
}));
jest.mock("@util/store", () => ({
    useLocalStorage: jest.fn(),
}));
jest.mock("@widgets/Table", () => () => <div data-testid="table" />);
jest.mock("@widgets/StatusBar", () => () => <div data-testid="status-bar" />);
jest.mock("@widgets/Row", () => ({ children }) => <div data-testid="row">{children}</div>);
jest.mock("@components/Breadcrumbs", () => () => <div data-testid="breadcrumbs" />);
jest.mock("./ItemMenu", () => () => <div data-testid="item-menu" />);

describe('Bookmarks View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue({ NAME: 'Name', LOCATION: 'Location' });
    Bookmarks.useState.mockReturnValue({ bookmarks: [] });
  });

  it('renders bookmarks table and status bar', () => {
    const { getByTestId } = render(<BookmarksPage />);
    expect(getByTestId('table')).toBeInTheDocument();
    expect(getByTestId('status-bar')).toBeInTheDocument();
  });
});
