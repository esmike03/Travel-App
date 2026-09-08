// Per-plan metadata (budget target, budget line items, notes), keyed by the
// itinerary plan key (`scope|start|end`). Persisted to SQLite so a plan's budget
// survives restarts even though plans themselves are derived from trip stops.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadPlanMetas, upsertPlanMeta } from '../data/db';
import { PlanScope, defaultRange, planKeyOf } from '../utils/planDates';

export interface BudgetItem {
  id: string;
  label: string;
  amount: number;
  shared?: boolean;
}

export interface PlanMeta {
  targetBudget: number | null;
  notes: string | null;
  items: BudgetItem[];
  title: string | null;
  origin: string | null;
  departureAt: string | null;
  destinationName: string | null;
  travelerCount: number;
  /**
   * Who is splitting the shared costs, in order. Always `travelerCount` long —
   * the two are kept in step by `withTravelerNames`, so the receipt can name
   * every share and the split maths still has a plain count to divide by.
   */
  travelerNames: string[];
}

export const EMPTY_META: PlanMeta = {
  targetBudget: null,
  notes: null,
  items: [],
  title: null,
  origin: null,
  departureAt: null,
  destinationName: null,
  // Solo by default: splitting is something the traveller opts into, so a plan
  // nobody shares never quietly halves its own numbers.
  travelerCount: 1,
  travelerNames: ['You'],
};

/**
 * The placeholder for a person the traveller hasn't named yet.
 *
 * `names` is typed as required but checked anyway: a PlanMeta held in state from
 * before this field existed still reaches here after a hot reload, and a blank
 * placeholder is a far better outcome than a crash on the budget page.
 */
export function travelerLabel(names: string[] | undefined, index: number): string {
  return names?.[index]?.trim() || (index === 0 ? 'You' : `Traveller ${index + 1}`);
}

/**
 * Reconcile the name list with a people count, so neither can drift: growing
 * pads with placeholders, shrinking drops from the end.
 */
function withTravelerNames(names: string[] | undefined, count: number): string[] {
  const next = (names ?? []).slice(0, count);
  while (next.length < count) next.push(next.length === 0 ? 'You' : `Traveller ${next.length + 1}`);
  return next;
}

function parseNames(json: string | null, count: number): string[] {
  if (json) {
    try {
      const arr = JSON.parse(json);
      if (Array.isArray(arr)) return withTravelerNames(arr.map(String), count);
    } catch {
      // Fall through to the generated names below.
    }
  }
  // Plans written before people could be named: generate a list of the right
  // length so the receipt has something to print against each share.
  return withTravelerNames(['You'], count);
}

interface PlansContextValue {
  getMeta: (planKey: string) => PlanMeta;
  setMeta: (planKey: string, patch: Partial<PlanMeta>) => void;
}

const PlansContext = createContext<PlansContextValue | undefined>(undefined);

// Plan keys used to be `scope|anchor`; they are now `scope|start|end`. The old
// anchor plus its scope implies the range exactly (day, Mon–Sun week, calendar
// month), so a stored budget can be carried over to the new key rather than
// silently orphaned.
function migrateKey(key: string): string {
  const parts = key.split('|');
  if (parts.length !== 2) return key; // already migrated, or unrecognised
  const [scope, anchor] = parts;
  if (scope !== 'day' && scope !== 'week' && scope !== 'month') return key;
  return planKeyOf(scope as PlanScope, defaultRange(scope as PlanScope, anchor));
}

function parseItems(json: string | null): BudgetItem[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function PlansProvider({ children }: { children: React.ReactNode }) {
  const [metas, setMetas] = useState<Record<string, PlanMeta>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await loadPlanMetas();
        if (!active) return;
        const map: Record<string, PlanMeta> = {};
        for (const r of rows) {
          const key = migrateKey(r.planKey);
          const travelerCount = Math.max(1, r.travelerCount ?? 2);
          const meta: PlanMeta = {
            targetBudget: r.targetBudget ?? null,
            notes: r.notes ?? null,
            items: parseItems(r.items),
            title: r.title ?? null,
            origin: r.origin ?? null,
            departureAt: r.departureAt ?? null,
            destinationName: r.destinationName ?? null,
            travelerCount,
            travelerNames: parseNames(r.travelerNames, travelerCount),
          };
          map[key] = meta;
          // Rewrite the row under its new key so the migration only runs once.
          if (key !== r.planKey) {
            upsertPlanMeta({
              planKey: key,
              targetBudget: meta.targetBudget,
              notes: meta.notes,
              items: JSON.stringify(meta.items),
              title: meta.title,
              origin: meta.origin,
              departureAt: meta.departureAt,
              destinationName: meta.destinationName,
              travelerCount: meta.travelerCount,
              travelerNames: JSON.stringify(meta.travelerNames),
            }).catch(() => {});
          }
        }
        setMetas(map);
      } catch {
        // DB unavailable — continue in-memory only.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setMeta = useCallback((planKey: string, patch: Partial<PlanMeta>) => {
    setMetas((prev) => {
      const current = prev[planKey] ?? EMPTY_META;
      const merged: PlanMeta = { ...current, ...patch };
      // Whichever of the two the caller changed, the other follows — a patch
      // that only bumps the count still gets a matching list of names.
      const travelerCount = Math.max(
        1,
        patch.travelerNames && patch.travelerCount === undefined
          ? patch.travelerNames.length
          : merged.travelerCount
      );
      const next: PlanMeta = {
        ...merged,
        travelerCount,
        travelerNames: withTravelerNames(merged.travelerNames, travelerCount),
      };
      upsertPlanMeta({
        planKey,
        targetBudget: next.targetBudget,
        notes: next.notes,
        items: JSON.stringify(next.items),
        title: next.title,
        origin: next.origin,
        departureAt: next.departureAt,
        destinationName: next.destinationName,
        travelerCount: next.travelerCount,
        travelerNames: JSON.stringify(next.travelerNames),
      }).catch(() => {});
      return { ...prev, [planKey]: next };
    });
  }, []);

  const value = useMemo<PlansContextValue>(
    () => ({
      getMeta: (planKey: string) => metas[planKey] ?? EMPTY_META,
      setMeta,
    }),
    [metas, setMeta]
  );

  return <PlansContext.Provider value={value}>{children}</PlansContext.Provider>;
}

export function usePlans(): PlansContextValue {
  const ctx = useContext(PlansContext);
  if (!ctx) throw new Error('usePlans must be used within PlansProvider');
  return ctx;
}

export function budgetSpent(meta: PlanMeta): number {
  return meta.items.reduce((sum, i) => sum + (Number.isFinite(i.amount) ? i.amount : 0), 0);
}

/** What this traveller is responsible for after shared items are split. */
export function budgetPersonalShare(meta: PlanMeta): number {
  const people = Math.max(1, meta.travelerCount);
  return meta.items.reduce(
    (sum, item) => sum + (Number.isFinite(item.amount) ? item.amount / (item.shared ? people : 1) : 0),
    0
  );
}

export interface TravelerShare {
  name: string;
  amount: number;
}

/**
 * What each named traveller owes. Shared lines are split evenly; personal lines
 * have no owner in the data model, so they stay with the traveller keeping the
 * plan — which is what `budgetPersonalShare` has always assumed.
 */
export function budgetSplit(meta: PlanMeta): TravelerShare[] {
  const people = Math.max(1, meta.travelerCount || 1);
  let personal = 0;
  let sharedEach = 0;
  for (const item of meta.items ?? []) {
    if (!Number.isFinite(item.amount)) continue;
    if (item.shared) sharedEach += item.amount / people;
    else personal += item.amount;
  }
  return Array.from({ length: people }, (_, i) => ({
    name: travelerLabel(meta.travelerNames, i),
    amount: sharedEach + (i === 0 ? personal : 0),
  }));
}

export function tripTitle(meta: PlanMeta): string {
  return meta.title?.trim() || 'Bohol Trip';
}
