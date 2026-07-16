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
}

export interface PlanMeta {
  targetBudget: number | null;
  notes: string | null;
  items: BudgetItem[];
}

export const EMPTY_META: PlanMeta = { targetBudget: null, notes: null, items: [] };

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
          const meta: PlanMeta = {
            targetBudget: r.targetBudget ?? null,
            notes: r.notes ?? null,
            items: parseItems(r.items),
          };
          map[key] = meta;
          // Rewrite the row under its new key so the migration only runs once.
          if (key !== r.planKey) {
            upsertPlanMeta({
              planKey: key,
              targetBudget: meta.targetBudget,
              notes: meta.notes,
              items: JSON.stringify(meta.items),
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
      const next: PlanMeta = { ...current, ...patch };
      upsertPlanMeta({
        planKey,
        targetBudget: next.targetBudget,
        notes: next.notes,
        items: JSON.stringify(next.items),
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
