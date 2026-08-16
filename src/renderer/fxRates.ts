import { useEffect, useState } from 'react';

// USD → { EUR, INR, ... } rates. The renderer's CSP blocks external `fetch`,
// so the actual network call happens in the main process (see
// `fx:fetchUsdRates` handler in main.ts) and comes back via IPC. Cached in
// localStorage for 6h; we serve cache immediately and revalidate in the
// background so first paint is instant.
const CACHE_KEY = 'syella.fxRatesUsd.v3';
const CACHE_TTL = 6 * 60 * 60 * 1000;

export type FxRates = Record<string, number>;
interface CachedRates { rates: FxRates; ts: number; }

export const SUPPORTED = ['USD', 'EUR', 'INR', 'GBP', 'JPY', 'CAD', 'AUD'] as const;
export type DisplayCurrency = typeof SUPPORTED[number];

export const SYMBOL: Record<string, string> = {
  USD: '$', EUR: '€', INR: '₹', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$',
};

function isValidRates(r: any): r is FxRates {
  if (!r || typeof r !== 'object') return false;
  return typeof r.EUR === 'number' && typeof r.INR === 'number';
}

function readCache(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !isValidRates(parsed.rates)) return null;
    return parsed;
  } catch { return null; }
}

async function fetchViaMain(): Promise<CachedRates | null> {
  const api = (window as any).syella;
  if (!api) return null;
  try {
    const res = await api.invoke('fx:fetchUsdRates');
    if (!res || !isValidRates(res.rates)) return null;
    return { rates: res.rates, ts: res.ts || Date.now() };
  } catch {
    return null;
  }
}

export function useFxRates(): { rates: FxRates; loading: boolean; updatedAt: number | null } {
  const cached = readCache();
  const [rates, setRates] = useState<FxRates>(cached?.rates || {});
  const [updatedAt, setUpdatedAt] = useState<number | null>(cached?.ts || null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const stale = !cached || Date.now() - cached.ts > CACHE_TTL;
    if (!stale) return;
    let cancelled = false;
    fetchViaMain().then(fresh => {
      if (cancelled || !fresh) return;
      setRates(fresh.rates);
      setUpdatedAt(fresh.ts);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch {}
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rates, loading, updatedAt };
}

// USD → target. Returns null when the rate isn't available so the UI shows
// "—" instead of misleadingly displaying the raw USD amount with a foreign
// currency prefix (that was the old bug — silent no-op conversion).
export function convertFromUsd(amountUsd: number, target: DisplayCurrency, rates: FxRates): number | null {
  if (target === 'USD') return amountUsd;
  const rate = rates[target];
  if (!rate || !isFinite(rate)) return null;
  return amountUsd * rate;
}
