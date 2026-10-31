import { SubscriptionStatus } from './constants';

export type SubscriptionAction =
  | 'SEND_QUOTATION'
  | 'CONFIRM'
  | 'ACTIVATE'
  | 'PAUSE'
  | 'RESUME'
  | 'RENEW'
  | 'CLOSE';

/**
 * Subscription state machine (architecture.md §5).
 *
 *   Draft -> Quotation -> Confirmed -> Active -> Closed
 *   Active <-> Paused (only when the plan allows pausing)
 *   Active -> Active models `renew`, which extends the term without leaving
 *   the Active state.
 *   Any non-terminal state may be closed by an admin/staff action.
 *
 * The table below is the *structural* rule set. Plan flags (pausable,
 * closable, autoClose, renewable) are enforced on top of it in the API.
 */
export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  DRAFT: ['QUOTATION', 'CONFIRMED', 'CLOSED'],
  QUOTATION: ['CONFIRMED', 'CLOSED'],
  CONFIRMED: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['ACTIVE', 'PAUSED', 'CLOSED'],
  PAUSED: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
};

/** What each action moves a subscription to, when it is allowed at all. */
export const ACTION_TARGET: Record<SubscriptionAction, SubscriptionStatus> = {
  SEND_QUOTATION: 'QUOTATION',
  CONFIRM: 'CONFIRMED',
  ACTIVATE: 'ACTIVE',
  PAUSE: 'PAUSED',
  RESUME: 'ACTIVE',
  RENEW: 'ACTIVE',
  CLOSE: 'CLOSED',
};

export class SubscriptionTransitionError extends Error {
  constructor(
    public readonly from: SubscriptionStatus,
    public readonly to: SubscriptionStatus,
  ) {
    super(`Cannot move subscription from ${from} to ${to}.`);
    this.name = 'SubscriptionTransitionError';
  }
}

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return SUBSCRIPTION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!canTransition(from, to)) {
    throw new SubscriptionTransitionError(from, to);
  }
}

/**
 * Actions that are legal from a given status, ignoring plan flags.
 * Used by the UI to grey out buttons and by the API for fast pre-checks.
 */
export function allowedActions(from: SubscriptionStatus): SubscriptionAction[] {
  return (Object.keys(ACTION_TARGET) as SubscriptionAction[]).filter((action) =>
    canTransition(from, ACTION_TARGET[action]),
  );
}
