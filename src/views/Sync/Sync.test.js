import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import Sync from './Sync';
import { useTranslations } from "@util/translations";
import { useSyncFeature } from "@sync/sync";
import { useOnline } from "@util/online";
import Cookies from "js-cookie";

jest.mock("@util/translations");
jest.mock("@sync/sync", () => ({
    useSyncFeature: jest.fn(),
    clearBundleCache: jest.fn(),
}));
jest.mock("@util/online");
jest.mock("js-cookie");
jest.mock("@util/updateSessions", () => ({
    useUpdateSessions: jest.fn().mockReturnValue({ busy: false }),
}));
jest.mock("@util/groups", () => ({
    useGroups: jest.fn().mockReturnValue([[]]),
}));
jest.mock("@util/locale", () => ({
    useDateFormatter: jest.fn().mockReturnValue({ format: jest.fn(date => date.toString()) }),
}));
jest.mock("@components/Toolbar", () => ({ registerToolbar: jest.fn(), useToolbar: jest.fn() }));
jest.mock("@sync/syncState", () => ({
    SyncActiveStore: {
        useState: jest.fn().mockReturnValue({}),
        getRawState: jest.fn().mockReturnValue({}),
        subscribe: jest.fn().mockReturnValue(() => {}),
        update: jest.fn(),
    }
}));

describe('Sync View', () => {
  const mockTranslations = {
    SYNC: 'Sync',
    LAST_SYNCED: 'Last Synced',
    DURATION: 'Duration',
    SYNC_STATUS: 'Sync Status',
    NEVER: 'Never',
    IDLE: 'Idle',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue(mockTranslations);
    useOnline.mockReturnValue(true);
    useSyncFeature.mockReturnValue({
        sync: jest.fn(),
        stop: jest.fn(),
        busy: false,
        lastSynced: null,
        percentage: 0,
        duration: 0,
        currentBundle: null,
        logs: [],
        startTime: null
    });
    Cookies.get.mockReturnValue(null);
  });

  it('renders sync view header', () => {
    const { getByText } = render(<Sync />);
    expect(getByText('Last Synced')).toBeInTheDocument();
    expect(getByText('Never')).toBeInTheDocument();
    expect(getByText('Idle')).toBeInTheDocument();
  });

  it('shows syncing status when busy', () => {
    useSyncFeature.mockReturnValue({
        sync: jest.fn(),
        stop: jest.fn(),
        busy: true,
        lastSynced: null,
        percentage: 50,
        duration: 100,
        currentBundle: 'test.json.gz',
        logs: [],
        startTime: Date.now() - 1000
    });
    useTranslations.mockReturnValue({ ...mockTranslations, SYNCING: 'Syncing' });
    
    const { getByText } = render(<Sync />);
    expect(getByText('Syncing')).toBeInTheDocument();
    expect(getByText('50%')).toBeInTheDocument();
  });
});
