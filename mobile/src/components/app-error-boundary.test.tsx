import { fireEvent } from '@testing-library/react-native';

import { AppErrorBoundary, CRASH_MESSAGE } from './app-error-boundary';
import { renderWithProviders } from '@/test/render';

describe('AppErrorBoundary', () => {
  const error = new Error('render blew up');

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the creator-facing message, never the error text', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <AppErrorBoundary error={error} retry={jest.fn().mockResolvedValue(undefined)} />,
    );

    expect(getByText(CRASH_MESSAGE)).toBeTruthy();
    expect(queryByText(/render blew up/)).toBeNull();
  });

  it('lets a custom message override the default', async () => {
    const { getByText } = await renderWithProviders(
      <AppErrorBoundary error={error} retry={jest.fn().mockResolvedValue(undefined)} message="Custom copy." />,
    );

    expect(getByText('Custom copy.')).toBeTruthy();
  });

  it('retries through expo-router and survives a rejected retry', async () => {
    const retry = jest.fn().mockRejectedValue(new Error('still broken'));
    const { getByText } = await renderWithProviders(<AppErrorBoundary error={error} retry={retry} />);

    fireEvent.press(getByText('Retry'));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
