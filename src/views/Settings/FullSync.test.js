import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import FullSync from './FullSync';
import { useTranslations } from "@util/translations";
import { SyncContext } from "@components/Sync";
import { clearBundleCache } from "@sync/sync";
import { goBackPage, setPath } from "@util/views";

jest.mock("@util/translations");
jest.mock("@sync/sync");
jest.mock("@util/views");
jest.mock("@widgets/Dialog", () => ({ title, children, actions }) => (
    <div data-testid="dialog">
        <h1>{title}</h1>
        {children}
        <div data-testid="actions">{actions}</div>
    </div>
));

describe('FullSync Component', () => {
  const mockUpdateSync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useTranslations.mockReturnValue({ FULL_SYNC: 'Full Sync', CANCEL: 'Cancel', FULL_SYNC_MESSAGE: 'Do full sync?' });
  });

  it('renders dialog with full sync message', () => {
    const { getByText } = render(
      <SyncContext.Provider value={{ updateSync: mockUpdateSync }}>
        <FullSync />
      </SyncContext.Provider>
    );
    expect(getByText('Do full sync?')).toBeInTheDocument();
  });

  it('calls clearBundleCache and updateSync when full sync is clicked', async () => {
    clearBundleCache.mockResolvedValue(true);
    const { getByText } = render(
      <SyncContext.Provider value={{ updateSync: mockUpdateSync }}>
        <FullSync />
      </SyncContext.Provider>
    );
    fireEvent.click(getByText('Full Sync'));
    expect(clearBundleCache).toHaveBeenCalled();
    await React.act(async () => {}); 
    expect(mockUpdateSync).toHaveBeenCalledWith(false);
    expect(setPath).toHaveBeenCalledWith("sync");
  });
});
