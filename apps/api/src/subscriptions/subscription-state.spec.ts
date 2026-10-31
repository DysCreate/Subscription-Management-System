import {
  SubscriptionTransitionError,
  allowedActions,
  assertTransition,
  canTransition,
} from '@subloop/shared';

describe('subscription state machine', () => {
  it('walks the happy path Draft -> Quotation -> Confirmed -> Active -> Closed', () => {
    expect(canTransition('DRAFT', 'QUOTATION')).toBe(true);
    expect(canTransition('QUOTATION', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'ACTIVE')).toBe(true);
    expect(canTransition('ACTIVE', 'CLOSED')).toBe(true);
  });

  it('allows pause and resume only between Active and Paused', () => {
    expect(canTransition('ACTIVE', 'PAUSED')).toBe(true);
    expect(canTransition('PAUSED', 'ACTIVE')).toBe(true);
    expect(canTransition('DRAFT', 'PAUSED')).toBe(false);
  });

  it('treats Closed as terminal', () => {
    expect(allowedActions('CLOSED')).toEqual([]);
    expect(canTransition('CLOSED', 'ACTIVE')).toBe(false);
  });

  it('does not allow skipping stages', () => {
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(false);
    expect(canTransition('CONFIRMED', 'PAUSED')).toBe(false);
  });

  it('throws a descriptive error on an illegal transition', () => {
    expect(() => assertTransition('CLOSED', 'ACTIVE')).toThrow(SubscriptionTransitionError);
  });

  it('lists the legal actions for a status', () => {
    expect(allowedActions('DRAFT')).toEqual(
      expect.arrayContaining(['SEND_QUOTATION', 'CONFIRM', 'CLOSE']),
    );
    expect(allowedActions('ACTIVE')).toEqual(
      expect.arrayContaining(['PAUSE', 'RENEW', 'CLOSE']),
    );
  });
});
