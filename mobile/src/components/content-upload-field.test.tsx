import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { ContentUploadField } from './content-upload-field';

/**
 * ContentUploadField is the only way a creator delivers work, and every one of
 * its failure paths is silent by nature: an upload that resolves with no file,
 * a picker that rejects, a denied photo permission. In each case the spinner
 * simply stops and Submit later complains the content is missing, with nothing
 * on screen explaining why. These tests pin the error copy to each branch.
 *
 * `useImageUploader` is mocked because the real one is a network client built
 * over the native image picker — neither exists under Node. The mock captures
 * the callbacks the component registers so a test can fire them directly,
 * which is exactly how UploadThing reports outcomes at runtime.
 */

type UploaderCallbacks = {
  onClientUploadComplete?: (res: unknown) => void;
  onUploadError?: (err: unknown) => void;
};

type PickerArgs = {
  onInsufficientPermissions?: () => void;
  onCancel?: () => void;
};

const mockOpenImagePicker = jest.fn();
const mockUploaderState: { callbacks: UploaderCallbacks; isUploading: boolean } = {
  callbacks: {},
  isUploading: false,
};

jest.mock('@/lib/uploadthing', () => ({
  useImageUploader: jest.fn((_endpoint: string, callbacks: UploaderCallbacks) => {
    mockUploaderState.callbacks = callbacks;
    return { openImagePicker: mockOpenImagePicker, isUploading: mockUploaderState.isUploading };
  }),
}));

function setup(value: string | null = null) {
  const onUploaded = jest.fn();
  const onError = jest.fn();
  return { onUploaded, onError, ui: <ContentUploadField value={value} onUploaded={onUploaded} onError={onError} /> };
}

beforeEach(() => {
  mockOpenImagePicker.mockReset().mockResolvedValue(undefined);
  mockUploaderState.callbacks = {};
  mockUploaderState.isUploading = false;
});

describe('ContentUploadField', () => {
  describe('empty state', () => {
    it('offers an accessible upload control', async () => {
      const { ui } = setup();

      await renderWithProviders(ui);

      expect(screen.getByLabelText('Upload content')).toBeOnTheScreen();
      expect(screen.getByText('Upload content')).toBeOnTheScreen();
    });

    it('opens the photo library when pressed', async () => {
      const { ui } = setup();
      await renderWithProviders(ui);

      await fireEvent.press(screen.getByLabelText('Upload content'));

      expect(mockOpenImagePicker).toHaveBeenCalledWith(expect.objectContaining({ source: 'library' }));
    });
  });

  describe('uploading state', () => {
    it('announces itself as busy rather than looking idle', async () => {
      mockUploaderState.isUploading = true;
      const { ui } = setup();

      await renderWithProviders(ui);

      expect(screen.getByLabelText('Uploading content')).toBeBusy();
      expect(screen.getByText('Uploading…')).toBeOnTheScreen();
    });
  });

  describe('filled state', () => {
    it('offers replacing the upload instead of a second upload control', async () => {
      const { ui } = setup('https://appid.ufs.sh/f/abc123');

      await renderWithProviders(ui);

      expect(screen.getByLabelText('Replace uploaded content')).toBeOnTheScreen();
      expect(screen.queryByLabelText('Upload content')).toBeNull();
    });
  });

  describe('failure paths', () => {
    it('reports an upload that completed without returning a file', async () => {
      const { ui, onError, onUploaded } = setup();
      await renderWithProviders(ui);

      // UploadThing resolved, but the result carries no file. Without this
      // branch the spinner stops and nothing else happens.
      mockUploaderState.callbacks.onClientUploadComplete?.([]);

      expect(onUploaded).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Upload finished'));
    });

    it("surfaces the server's own reason rather than a generic retry prompt", async () => {
      const { ui, onError } = setup();
      await renderWithProviders(ui);

      // The waitlist-mode allowlist rejection is the real case here: telling
      // the creator to "try again" asks them to repeat something that cannot work.
      mockUploaderState.callbacks.onUploadError?.({ message: 'Your account is not approved for uploads yet' });

      expect(onError).toHaveBeenCalledWith('Your account is not approved for uploads yet');
    });

    it('falls back to generic copy when the upload error carries no message', async () => {
      const { ui, onError } = setup();
      await renderWithProviders(ui);

      mockUploaderState.callbacks.onUploadError?.({});

      expect(onError).toHaveBeenCalledWith('Upload failed. Please try again.');
    });

    it('reports a rejected picker instead of leaving a dead control', async () => {
      mockOpenImagePicker.mockRejectedValue(new Error('picker exploded'));
      const { ui, onError } = setup();
      await renderWithProviders(ui);

      await fireEvent.press(screen.getByLabelText('Upload content'));
      // The rejection is handled in a `.catch()` the press handler does not
      // await, so let the microtask queue drain before asserting.
      await new Promise<void>(resolve => {
        setImmediate(resolve);
      });

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('photo library'));
    });

    it('explains a denied photo permission', async () => {
      mockOpenImagePicker.mockImplementation((args: PickerArgs) => {
        args.onInsufficientPermissions?.();
        return Promise.resolve();
      });
      const { ui, onError } = setup();
      await renderWithProviders(ui);

      await fireEvent.press(screen.getByLabelText('Upload content'));

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Photo access'));
    });

    it('stays silent when the creator simply cancels', async () => {
      mockOpenImagePicker.mockImplementation((args: PickerArgs) => {
        args.onCancel?.();
        return Promise.resolve();
      });
      const { ui, onError, onUploaded } = setup();
      await renderWithProviders(ui);

      await fireEvent.press(screen.getByLabelText('Upload content'));

      expect(onError).not.toHaveBeenCalled();
      expect(onUploaded).not.toHaveBeenCalled();
    });
  });

  describe('success path', () => {
    it('prefers ufsUrl over the legacy url field', async () => {
      const { ui, onUploaded } = setup();
      await renderWithProviders(ui);

      mockUploaderState.callbacks.onClientUploadComplete?.([
        { ufsUrl: 'https://appid.ufs.sh/f/new', url: 'https://utfs.io/f/legacy' },
      ]);

      expect(onUploaded).toHaveBeenCalledWith('https://appid.ufs.sh/f/new');
    });

    it('falls back to url when ufsUrl is absent', async () => {
      const { ui, onUploaded } = setup();
      await renderWithProviders(ui);

      mockUploaderState.callbacks.onClientUploadComplete?.([{ url: 'https://utfs.io/f/legacy' }]);

      expect(onUploaded).toHaveBeenCalledWith('https://utfs.io/f/legacy');
    });
  });
});
