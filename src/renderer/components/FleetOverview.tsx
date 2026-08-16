import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, Calendar, Cloud, Server, AlertTriangle, Search, Zap, Plus, Play,
} from 'lucide-react';
import { SyeSession } from '../../types';
import { useFxRates, convertFromUsd, SYMBOL, SUPPORTED, DisplayCurrency } from '../fxRates';

interface Props {
  sessions: SyeSession[];
  onEditSession: (session: SyeSession) => void;
  onConnect: (session: SyeSession) => void;
  onNewSession: () => void;
  onOpenPalette: () => void;
}

const PER_MONTH: Record<string, number> = { monthly: 1, yearly: 1 / 12, hourly: 730, 'one-time': 0 };

function fmt(currency: DisplayCurrency, amount: number | null) {
  const sym = SYMBOL[currency] || currency + ' ';
  if (amount == null) return `${sym}—`;
  return `${sym}${amount.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function daysUntil(ts: number): number {
  return Math.ceil((ts - Date.now()) / 86400000);
}

const DISPLAY_CURRENCY_KEY = 'syella.fleetDisplayCurrency';

export default function FleetOverview({ sessions, onEditSession, onConnect, onNewSession, onOpenPalette }: Props) {
  const [search, setSearch] = useState('');
  const [display, setDisplay] = useState<DisplayCurrency>(() => {
    try { return (localStorage.getItem(DISPLAY_CURRENCY_KEY) as DisplayCurrency) || 'USD'; } catch { return 'USD'; }
  });
  const setDisplayPersist = (c: DisplayCurrency) => {
    setDisplay(c);
    try { localStorage.setItem(DISPLAY_CURRENCY_KEY, c); } catch {}
  };
  const { rates, loading: fxLoading, updatedAt: fxUpdatedAt } = useFxRates();

  const priced = useMemo(
    () => sessions.filter(s => s.costAmount != null || s.expiresAt != null || s.provider),
    [sessions]
  );
  const hasFleet = priced.length > 0;

  const filtered = useMemo(() => {
    if (!search) return priced;
    const q = search.toLowerCase();
    return priced.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.host.toLowerCase().includes(q) ||
      (s.provider || '').toLowerCase().includes(q)
    );
  }, [priced, search]);

  // Costs are stored as USD (only). Roll up to a single monthly USD total,
  // then convert to whatever display currency the user picked.
  const monthlyUsd = useMemo(() => {
    let sum = 0;
    for (const s of priced) {
      if (s.costAmount == null || !s.costPeriod || s.costPeriod === 'one-time') continue;
      sum += s.costAmount * (PER_MONTH[s.costPeriod] || 0);
    }
    return sum;
  }, [priced]);
  const monthly = convertFromUsd(monthlyUsd, display, rates);
  const yearly = monthly != null ? monthly * 12 : null;
  const daily = monthly != null ? monthly * 12 / 365 : null;
  const fxUnavailable = display !== 'USD' && monthly == null && monthlyUsd > 0;

  const providerBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of priced) {
      const p = s.provider || 'Unspecified';
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [priced]);

  const upcoming = useMemo(
    () => priced
      .filter(s => s.expiresAt != null && daysUntil(s.expiresAt) <= 7)
      .sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0))
      .slice(0, 5),
    [priced]
  );
  const expiringSoon = useMemo(
    () => priced.filter(s => s.expiresAt != null && daysUntil(s.expiresAt) <= 7).length,
    [priced]
  );

  const sortedList = useMemo(
    () => filtered.slice().sort((a, b) => {
      const ea = a.expiresAt || Infinity;
      const eb = b.expiresAt || Infinity;
      if (ea !== eb) return ea - eb;
      return a.name.localeCompare(b.name);
    }),
    [filtered]
  );

  if (!hasFleet) return <EmptyState onNewSession={onNewSession} onOpenPalette={onOpenPalette} sessionCount={sessions.length} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 0.9, 0.28, 1] }}
      style={{
        position: 'absolute', inset: 0,
        overflowY: 'auto',
        padding: '48px 56px 64px',
      }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

        <header style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: 3, color: 'var(--text-faint)',
              textTransform: 'uppercase', marginBottom: 8,
            }}>Fleet</div>
            <h1 style={{
              fontSize: 30, fontWeight: 300, color: 'var(--text-primary)',
              letterSpacing: -0.4, lineHeight: 1.1, margin: 0,
            }}>
              {priced.length} server{priced.length === 1 ? '' : 's'} under watch
            </h1>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              {sessions.length - priced.length > 0
                ? `${sessions.length - priced.length} untracked · add cost or expiry in the Billing tab to include them`
                : 'Every session is tracked.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionBtn Icon={Plus} label="New" onClick={onNewSession} />
            <ActionBtn Icon={Zap} label="Connect" onClick={onOpenPalette} primary />
          </div>
        </header>

        <section style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -10 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}>Show in</div>
          <div style={{
            display: 'flex', gap: 2, padding: 3, borderRadius: 9,
            background: 'rgba(15,21,36,0.5)', border: '1px solid var(--border-subtle)',
          }}>
            {SUPPORTED.map(c => (
              <button key={c}
                onClick={() => setDisplayPersist(c)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                  fontFamily: 'var(--font-mono)', letterSpacing: 0.4,
                  background: display === c ? 'var(--accent-gradient-soft)' : 'transparent',
                  color: display === c ? 'var(--accent-light)' : 'var(--text-muted)',
                  border: display === c ? '1px solid rgba(90,162,255,0.28)' : '1px solid transparent',
                  cursor: 'pointer',
                }}>
                {c}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
            {fxLoading ? 'fetching rates…'
              : display === 'USD' ? 'stored values (no conversion)'
              : fxUpdatedAt ? `live · updated ${new Date(fxUpdatedAt).toLocaleDateString()}`
              : 'offline · showing raw USD'}
          </div>
        </section>

        <section style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14,
        }}>
          {monthlyUsd === 0 ? (
            <StatTile
              label="Recurring spend"
              value="—"
              hint="No cost set on any session"
              Icon={DollarSign}
            />
          ) : (
            <>
              <StatTile
                label="Daily burn"
                value={fmt(display, daily)}
                hint={daily != null ? `${fmt(display, daily * 7)} per week` : 'Rates unavailable'}
                Icon={DollarSign}
              />
              <StatTile
                label="Monthly"
                value={fmt(display, monthly)}
                hint={fxUnavailable ? 'FX rates unavailable — switch to USD' : 'Recurring only'}
                Icon={DollarSign}
                accent
                warning={fxUnavailable}
              />
              <StatTile
                label="Yearly"
                value={fmt(display, yearly)}
                hint={yearly != null ? 'At current rates' : 'Rates unavailable'}
                Icon={DollarSign}
              />
            </>
          )}
          <StatTile
            label="Expiring · 7d"
            value={String(expiringSoon)}
            hint={expiringSoon > 0 ? 'Review below' : 'Nothing this week'}
            Icon={AlertTriangle}
            warning={expiringSoon > 0}
          />
          <StatTile
            label="Providers"
            value={String(providerBreakdown.length)}
            hint={providerBreakdown.slice(0, 2).map(([p]) => p).join(' · ') || '—'}
            Icon={Cloud}
          />
        </section>

        {providerBreakdown.length > 0 && (
          <section>
            <SectionHeading>Providers</SectionHeading>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {providerBreakdown.map(([p, n]) => (
                <div key={p} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px', borderRadius: 999, fontSize: 12,
                  background: 'rgba(90,162,255,0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}>
                  <Cloud size={11} color="var(--accent-light)" />
                  <span style={{ fontWeight: 500 }}>{p}</span>
                  <span style={{
                    color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 11,
                  }}>{n}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section>
            <SectionHeading>Upcoming renewals</SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {upcoming.map(s => {
                const d = daysUntil(s.expiresAt!);
                const color = d < 0 ? 'var(--danger)' : d <= 7 ? 'var(--warning)' : 'var(--text-secondary)';
                return (
                  <div key={s.id}
                    onClick={() => onEditSession(s)}
                    style={{
                      padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                      background: 'rgba(15,21,36,0.4)',
                      border: '1px solid var(--border-subtle)',
                      transition: 'background 140ms, border-color 140ms',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(90,162,255,0.06)';
                      e.currentTarget.style.borderColor = 'rgba(90,162,255,0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(15,21,36,0.4)';
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</span>
                      <span style={{ fontSize: 11, color, fontFamily: 'var(--font-mono)' }}>
                        {d < 0 ? `${-d}d ago` : d === 0 ? 'today' : `${d}d`}
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(s.expiresAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {s.provider && <> · {s.provider}</>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <SectionHeading noMargin>All servers</SectionHeading>
            <div style={{ flex: 1 }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 9,
              background: 'rgba(140,170,230,0.04)', border: '1px solid var(--border-subtle)',
              width: 240,
            }}>
              <Search size={12} color="var(--text-faint)" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search fleet…"
                style={{ flex: 1, background: 'none', color: 'var(--text-primary)', fontSize: 12 }}
              />
            </div>
          </div>

          <div style={{
            borderRadius: 14, overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(10,15,26,0.35)',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 40px',
              gap: 12, padding: '11px 18px', fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 1.4, color: 'var(--text-faint)',
              background: 'rgba(15,21,36,0.5)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <span>Server</span>
              <span>Provider</span>
              <span>Cost</span>
              <span>Expires</span>
              <span></span>
            </div>
            {sortedList.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
                No servers match “{search}”.
              </div>
            )}
            {sortedList.map((s, i) => {
              const days = s.expiresAt ? daysUntil(s.expiresAt) : null;
              const expiring = days != null && days <= 7;
              const overdue = days != null && days < 0;
              return (
                <div key={s.id}
                  onClick={() => onConnect(s)}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 40px',
                    gap: 12, padding: '13px 18px', fontSize: 12.5, alignItems: 'center',
                    borderBottom: i < sortedList.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    cursor: 'pointer', transition: 'background 120ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(90,162,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent-gradient-soft)',
                      border: '1px solid var(--border-medium)',
                    }}>
                      <Server size={12} color="var(--accent-light)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        color: 'var(--text-primary)', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{s.name}</div>
                      <div style={{
                        color: 'var(--text-faint)', fontSize: 10.5, fontFamily: 'var(--font-mono)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1,
                      }}>{s.username}@{s.host}</div>
                    </div>
                  </div>
                  <span style={{ color: s.provider ? 'var(--text-secondary)' : 'var(--text-faint)' }}>
                    {s.provider || '—'}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ color: s.costAmount != null ? 'var(--text-primary)' : 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {s.costAmount != null ? fmt(display, convertFromUsd(s.costAmount, display, rates)) : '—'}
                    </span>
                    {s.costPeriod && (
                      <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>{s.costPeriod}</span>
                    )}
                  </div>
                  <span style={{
                    color: overdue ? 'var(--danger)' : expiring ? 'var(--warning)' : 'var(--text-secondary)',
                    fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)',
                  }}>
                    {s.expiresAt ? (
                      <>
                        <Calendar size={10} />
                        {overdue ? `${-days!}d ago` : days === 0 ? 'today' : `${days}d`}
                      </>
                    ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditSession(s); }}
                    title="Edit billing"
                    style={{
                      width: 26, height: 26, borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)', background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                    }}>
                    <Play size={10} style={{ transform: 'rotate(-90deg)' }} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </motion.div>
  );
}

function SectionHeading({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
      color: 'var(--text-faint)', marginBottom: noMargin ? 0 : 14,
    }}>{children}</div>
  );
}

function StatTile({ label, value, hint, Icon, accent, warning }: {
  label: string; value: string; hint: string;
  Icon: React.ComponentType<any>; accent?: boolean; warning?: boolean;
}) {
  const border = warning ? 'rgba(251,191,36,0.28)' : accent ? 'rgba(90,162,255,0.22)' : 'var(--border-subtle)';
  const iconColor = warning ? 'var(--warning)' : accent ? 'var(--accent-light)' : 'var(--text-muted)';
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 14,
      background: 'rgba(15,21,36,0.4)',
      border: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column', gap: 8,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.4,
        color: iconColor,
      }}>
        <Icon size={11} />
        {label}
      </div>
      <div style={{
        fontSize: 26, fontWeight: 300, letterSpacing: -0.5,
        color: warning ? 'var(--warning)' : 'var(--text-primary)',
        fontFamily: 'var(--font-mono)', lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{hint}</div>
    </div>
  );
}

function ActionBtn({ Icon, label, onClick, primary }: {
  Icon: React.ComponentType<any>; label: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '9px 15px', borderRadius: 10, fontSize: 12, fontWeight: 500,
        background: primary ? 'var(--accent-gradient-soft)' : 'rgba(15,21,36,0.5)',
        border: `1px solid ${primary ? 'rgba(90,162,255,0.35)' : 'var(--border-subtle)'}`,
        color: primary ? 'var(--accent-light)' : 'var(--text-secondary)',
        letterSpacing: 0.3,
      }}>
      <Icon size={12} />
      {label}
    </motion.button>
  );
}

function EmptyState({ onNewSession, onOpenPalette, sessionCount }: {
  onNewSession: () => void; onOpenPalette: () => void; sessionCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 0.9, 0.28, 1] }}
      style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        gap: 22, padding: 32, textAlign: 'center', userSelect: 'none',
      }}>
      <img src="assets/icon.png" alt="Syella" style={{ width: 68, height: 68, opacity: 0.2 }} />
      <div style={{ fontSize: 24, fontWeight: 200, color: 'var(--text-faint)', letterSpacing: 6 }}>SYELLA</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 380, lineHeight: 1.6 }}>
        {sessionCount === 0
          ? 'Add your first server to get started.'
          : 'Add cost, provider, or expiry to any session and this screen will track your fleet spend and renewals.'}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <ActionBtn Icon={Plus} label="New session" onClick={onNewSession} />
        {sessionCount > 0 && <ActionBtn Icon={Zap} label="Connect" onClick={onOpenPalette} primary />}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
        or press{' '}
        <kbd style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          padding: '2px 7px', borderRadius: 5,
          background: 'rgba(140,170,230,0.08)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--accent-light)',
        }}>Ctrl+K</kbd>
      </div>
    </motion.div>
  );
}
