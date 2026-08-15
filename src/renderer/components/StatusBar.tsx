import React, { useState, useEffect, useRef } from 'react';
import { SyeTab } from '../../types';

interface Stats {
  hostname: string; cpu: string; memUsed: string; memTotal: string;
  diskUsed: string; diskTotal: string; netUp: string; netDown: string;
  uptime: string; user: string; mounts: string[];
}

interface Props { activeTab: SyeTab | null; }

const Ico = ({ d, color, size = 12 }: { d: string; color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ flexShrink: 0 }}>
    <path d={d} />
  </svg>
);

const ICONS = {
  server: 'M2 3a1 1 0 011-1h10a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm0 5a1 1 0 011-1h10a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V8zm1 5a1 1 0 00-1 1v0a1 1 0 001 1h10a1 1 0 001-1v0a1 1 0 00-1-1H3z',
  cpu: 'M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v1h1a1 1 0 010 2H2v1a2 2 0 002 2h1v1a1 1 0 102 0v-1h2v1a1 1 0 102 0v-1h1a2 2 0 002-2V9h-1a1 1 0 110-2h1V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H7a1 1 0 01-1-1V7z',
  mem: 'M3 4a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1H3zm2 2h2v4H5V6zm4 0h2v4H9V6z',
  disk: 'M2 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm10 4a1 1 0 11-2 0 1 1 0 012 0z',
  up: 'M8 3l4 4h-3v6H7V7H4l4-4z',
  down: 'M8 13l-4-4h3V3h2v6h3l-4 4z',
  clock: 'M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm0 1v4l3 2-.5.8L7 8.5V4h1z',
  user: 'M8 2a3 3 0 100 6 3 3 0 000-6zM4 10a2 2 0 00-2 2v1h12v-1a2 2 0 00-2-2H4z',
  mount: 'M2 4a1 1 0 011-1h3l1 1h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z',
};

export default function StatusBar({ activeTab }: Props) {
  const connected = activeTab?.status === 'connected';
  const [stats, setStats] = useState<Stats | null>(null);
  const prevNet = useRef<{ rx: number; tx: number; ts: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined as any);

  useEffect(() => {
    if (!activeTab || activeTab.status !== 'connected') {
      setStats(null);
      prevNet.current = null;
      return;
    }
    const tabId = activeTab.id;

    const fetchStats = async () => {
      try {
        const raw: string = await window.syella.invoke('ssh:exec', tabId,
          "hostname; echo '|||'; " +
          "grep 'cpu ' /proc/stat 2>/dev/null | awk '{u=$2+$4; t=$2+$4+$5; printf \"%.0f\", u*100/t}' || echo '-'; echo '|||'; " +
          "free -m 2>/dev/null | awk 'NR==2{print $3\"|\"$2}' || echo '-|-'; echo '|||'; " +
          "df -BG / 2>/dev/null | awk 'NR==2{gsub(/G/,\"\",$3);gsub(/G/,\"\",$2);print $3\"|\"$2}' || echo '-|-'; echo '|||'; " +
          "cat /proc/net/dev 2>/dev/null | awk 'NR>2{rx+=$2;tx+=$10}END{print rx\"|\"tx}' || echo '0|0'; echo '|||'; " +
          "uptime -p 2>/dev/null | sed 's/up //' || echo '-'; echo '|||'; " +
          "whoami 2>/dev/null || echo '-'; echo '|||'; " +
          "df -h 2>/dev/null | awk 'NR>1 && $6~/^\\// && $6!~/snap/{printf \"%s:%s|\",$6,$5}' || echo ''"
        );
        const parts = raw.split('|||').map((s: string) => s.trim());
        if (parts.length < 8) return;

        const memParts = parts[2].split('|');
        const diskParts = parts[3].split('|');
        const netParts = parts[4].split('|');
        const now = Date.now();
        const rxBytes = parseInt(netParts[0]) || 0;
        const txBytes = parseInt(netParts[1]) || 0;

        let netUp = '0 B/s', netDown = '0 B/s';
        if (prevNet.current) {
          const dt = (now - prevNet.current.ts) / 1000;
          if (dt > 0) {
            const rxDiff = Math.max(0, rxBytes - prevNet.current.rx);
            const txDiff = Math.max(0, txBytes - prevNet.current.tx);
            netDown = fmtSpeed(rxDiff / dt);
            netUp = fmtSpeed(txDiff / dt);
          }
        }
        prevNet.current = { rx: rxBytes, tx: txBytes, ts: now };

        const mountStr = parts[7] || '';
        const mounts = mountStr.split('|').filter(Boolean).map((m: string) => m.trim());

        setStats({
          hostname: parts[0] || '-',
          cpu: parts[1] || '-',
          memUsed: memParts[0] || '-', memTotal: memParts[1] || '-',
          diskUsed: diskParts[0] || '-', diskTotal: diskParts[1] || '-',
          netUp, netDown,
          uptime: parts[5] || '-',
          user: parts[6] || '-',
          mounts,
        });
      } catch {}
    };

    fetchStats();
    intervalRef.current = setInterval(fetchStats, 1500);
    return () => clearInterval(intervalRef.current);
  }, [activeTab?.id, activeTab?.status]);

  const fmtSpeed = (bps: number): string => {
    if (bps < 1024) return `${bps.toFixed(0)} B/s`;
    if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`;
    return `${(bps / 1048576).toFixed(2)} MB/s`;
  };

  const sep = <span style={{ color: '#0d1525', margin: '0 1px', fontSize: 10 }}>|</span>;

  const cpuNum = stats ? parseInt(stats.cpu) : 0;
  const cpuColor = cpuNum > 80 ? '#ff5f57' : cpuNum > 50 ? '#f3f99d' : '#22c55e';

  return (
    <div style={{
      height: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 10px', background: '#060a14', borderTop: '1px solid rgba(56,140,255,0.06)',
      fontSize: 11, color: '#546178', userSelect: 'none', flexShrink: 0,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {activeTab && connected && stats ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(56,140,255,0.06)', borderRadius: 3 }}>
              <Ico d={ICONS.server} color="#388CFF" size={11} />
              <span style={{ color: '#7a8ba8' }}>{stats.hostname}</span>
            </div>
            {sep}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(34,197,94,0.06)', borderRadius: 3 }}>
              <Ico d={ICONS.cpu} color={cpuColor} size={11} />
              <span style={{ color: cpuColor }}>{stats.cpu}%</span>
              <div style={{ width: 30, height: 4, background: '#1a2030', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, cpuNum)}%`, height: '100%', background: cpuColor, borderRadius: 2, transition: 'width 300ms' }} />
              </div>
            </div>
            {sep}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(87,199,255,0.06)', borderRadius: 3 }}>
              <Ico d={ICONS.disk} color="#57c7ff" size={11} />
              <span style={{ color: '#57c7ff' }}>{stats.diskUsed} / {stats.diskTotal} GB</span>
            </div>
            {sep}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(90,247,142,0.05)', borderRadius: 3 }}>
              <Ico d={ICONS.up} color="#5af78e" size={10} />
              <span style={{ color: '#5af78e' }}>{stats.netUp}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(154,237,254,0.05)', borderRadius: 3 }}>
              <Ico d={ICONS.down} color="#9aedfe" size={10} />
              <span style={{ color: '#9aedfe' }}>{stats.netDown}</span>
            </div>
            {sep}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ico d={ICONS.clock} color="#546178" size={10} />
              <span>{stats.uptime}</span>
            </div>
            {sep}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ico d={ICONS.user} color="#546178" size={10} />
              <span>{stats.user}</span>
            </div>
            {stats.mounts.length > 0 && (
              <>
                {sep}
                {stats.mounts.slice(0, 4).map((m, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Ico d={ICONS.mount} color="#3d5070" size={9} />
                    <span style={{ color: '#3d5070' }}>{m}</span>
                  </span>
                ))}
              </>
            )}
          </>
        ) : activeTab ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: connected ? '#22c55e' : activeTab.status === 'connecting' ? '#f59e0b' : '#1a2540',
              boxShadow: connected ? '0 0 4px rgba(34,197,94,0.4)' : 'none',
            }} />
            <span style={{ color: connected ? '#22c55e' : activeTab.status === 'connecting' ? '#f59e0b' : '#3d5070' }}>
              {connected ? 'Connected' : activeTab.status === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
            {sep}
            <span>{activeTab.session.username}@{activeTab.session.host}</span>
          </div>
        ) : (
          <span>Ready</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#253050' }}>
        {activeTab && <span>:{activeTab.session.port}</span>}
        <span>Ctrl+K</span>
      </div>
    </div>
  );
}
