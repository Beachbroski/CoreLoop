import { isPendingSessionStatus, isSessionExistsError } from './clerk-errors';

describe('isSessionExistsError', () => {
  it('recognizes Clerk session_exists', () => {
    expect(isSessionExistsError({ errors: [{ code: 'session_exists' }] })).toBe(true);
  });

  it('ignores unrelated Clerk errors', () => {
    expect(isSessionExistsError({ errors: [{ code: 'form_password_incorrect' }] })).toBe(false);
  });

  it('handles non-Clerk shapes safely', () => {
    expect(isSessionExistsError(null)).toBe(false);
    expect(isSessionExistsError(undefined)).toBe(false);
    expect(isSessionExistsError(new Error('boom'))).toBe(false);
    expect(isSessionExistsError('session_exists')).toBe(false);
    expect(isSessionExistsError({ errors: 'nope' })).toBe(false);
  });
});

describe('isPendingSessionStatus', () => {
  it('detects a pending (task-blocked) session', () => {
    expect(isPendingSessionStatus('pending')).toBe(true);
  });

  it('treats complete/active/missing as not pending', () => {
    expect(isPendingSessionStatus('complete')).toBe(false);
    expect(isPendingSessionStatus('active')).toBe(false);
    expect(isPendingSessionStatus(null)).toBe(false);
    expect(isPendingSessionStatus(undefined)).toBe(false);
  });
});
