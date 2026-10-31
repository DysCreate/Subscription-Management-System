import type { Subscription, SubscriptionStatus } from "@/types";

export interface SubscriptionActivityEvent {
  id: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  title: string;
  actor: string;
  createdAt: string;
  reason?: string;
}

export interface SubscriptionNote {
  id: string;
  subscriptionId: string;
  body: string;
  author: string;
  createdAt: string;
}

export interface RecordActivityInput {
  status: SubscriptionStatus;
  title?: string;
  actor: string;
  reason?: string;
}

const ACTIVITY_KEY = "subloop_subscription_activity_v1";
const NOTES_KEY = "subloop_subscription_notes_v1";
const HOUR = 60 * 60 * 1000;

const ACTORS = ["Priya Nair", "Rahul Verma", "Aarav Menon", "Neha Sharma"];

const STATUS_TITLES: Record<SubscriptionStatus, string> = {
  draft: "Subscription created",
  quotation: "Quotation sent to customer",
  confirmed: "Subscription confirmed",
  active: "Subscription activated",
  paused: "Subscription paused",
  closed: "Subscription closed",
};

function readStore<T>(key: string): Record<string, T[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, T[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore<T>(key: string, value: Record<string, T[]>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage issues
  }
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR);
}

function actorFor(seed: number): string {
  return ACTORS[Math.abs(seed) % ACTORS.length] ?? ACTORS[0]!;
}

interface LifecycleSeed {
  status: SubscriptionStatus;
  at: Date;
}

function lifecycleSeeds(subscription: Subscription): LifecycleSeed[] {
  const createdAt = new Date(subscription.createdAt);
  const startDate = new Date(subscription.startDate);
  const seeds: LifecycleSeed[] = [{ status: "draft", at: createdAt }];

  const includeQuotation = subscription.status !== "draft";
  const includeConfirmed =
    subscription.status === "confirmed" ||
    subscription.status === "active" ||
    subscription.status === "paused" ||
    subscription.status === "closed";
  const includeActive =
    subscription.status === "active" ||
    subscription.status === "paused" ||
    subscription.status === "closed";
  const includePaused = subscription.status === "paused";
  const includeClosed = subscription.status === "closed";

  if (includeQuotation) {
    seeds.push({ status: "quotation", at: addHours(createdAt, 26) });
  }
  if (includeConfirmed) {
    seeds.push({
      status: "confirmed",
      at: new Date(startDate.getTime() - 3 * 24 * HOUR),
    });
  }
  if (includeActive) {
    seeds.push({ status: "active", at: startDate });
  }
  if (includePaused) {
    seeds.push({ status: "paused", at: addHours(new Date(), -30) });
  }
  if (includeClosed) {
    seeds.push({
      status: "closed",
      at: new Date(
        subscription.closedAt ??
          subscription.endDate ??
          addHours(startDate, 24 * 30),
      ),
    });
  }

  // Keep the timeline chronological even when nominal dates overlap.
  let cursor = createdAt.getTime();
  return seeds.map((seed, index) => {
    const at = new Date(Math.max(seed.at.getTime(), cursor + (index === 0 ? 0 : HOUR)));
    cursor = at.getTime();
    return { ...seed, at };
  });
}

function seedEvents(subscription: Subscription): SubscriptionActivityEvent[] {
  const numeric = Number(subscription.subscriptionNumber.replace(/\D/g, "")) || 0;
  return lifecycleSeeds(subscription).map((seed, index) => ({
    id: `seed_${subscription.id}_${seed.status}`,
    subscriptionId: subscription.id,
    status: seed.status,
    title: STATUS_TITLES[seed.status],
    actor: actorFor(numeric + index),
    createdAt: seed.at.toISOString(),
  }));
}

/** Timeline of lifecycle changes, seeded from mock history plus recorded actions. */
export async function getSubscriptionActivity(
  subscription: Subscription,
): Promise<SubscriptionActivityEvent[]> {
  const stored = readStore<SubscriptionActivityEvent>(ACTIVITY_KEY);
  const recorded = stored[subscription.id] ?? [];
  // A recorded transition replaces the seeded placeholder for the same status.
  // Custom-titled events (e.g. renewals) keep the original lifecycle entry.
  const recordedStatuses = new Set(
    recorded
      .filter((event) => event.title === STATUS_TITLES[event.status])
      .map((event) => event.status),
  );

  const seeded = seedEvents(subscription).filter(
    (event) => !recordedStatuses.has(event.status),
  );

  return [...seeded, ...recorded].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export async function recordSubscriptionActivity(
  subscriptionId: string,
  input: RecordActivityInput,
): Promise<SubscriptionActivityEvent> {
  const event: SubscriptionActivityEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    subscriptionId,
    status: input.status,
    title: input.title ?? STATUS_TITLES[input.status],
    actor: input.actor,
    createdAt: new Date().toISOString(),
    reason: input.reason?.trim() || undefined,
  };

  const stored = readStore<SubscriptionActivityEvent>(ACTIVITY_KEY);
  stored[subscriptionId] = [...(stored[subscriptionId] ?? []), event];
  writeStore(ACTIVITY_KEY, stored);
  return event;
}

export async function getSubscriptionNotes(
  subscriptionId: string,
): Promise<SubscriptionNote[]> {
  const stored = readStore<SubscriptionNote>(NOTES_KEY);
  return [...(stored[subscriptionId] ?? [])].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function addSubscriptionNote(
  subscriptionId: string,
  body: string,
  author: string,
): Promise<SubscriptionNote> {
  const note: SubscriptionNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    subscriptionId,
    body: body.trim(),
    author,
    createdAt: new Date().toISOString(),
  };

  const stored = readStore<SubscriptionNote>(NOTES_KEY);
  stored[subscriptionId] = [note, ...(stored[subscriptionId] ?? [])];
  writeStore(NOTES_KEY, stored);
  return note;
}
