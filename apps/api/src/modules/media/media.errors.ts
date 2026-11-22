export type MediaErrorCode =
  'INVALID_FILE' | 'UNSUPPORTED_MIME_TYPE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED';

export class MediaValidationError extends Error {
  constructor(
    public readonly code: MediaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MediaValidationError';
  }
}
