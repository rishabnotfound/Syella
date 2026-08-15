import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Server, Cpu, MemoryStick, HardDrive, ArrowUpCircle, ArrowDownCircle,
  Clock, User, HardDriveDownload, Wifi, WifiOff, Command,
} from 'lucide-react';
import { SyeTab } from '../../types';

interface Stats {
  hostname: string; cpu: string; memUsed: string; memTotal: string;
  diskUsed: string; diskTotal: string; netUp: string; netDown: string;
  uptime: string; user: string; mounts: string[];
}

interface Props { activeTab: SyeTab | null; }

const fmtSpeed = (bps: number): string => {
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1048576) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1048576).toFixed(2)} MB/s`;
};

function Pill({ Icon, color, children }: { Icon: React.ComponentType<any>; color: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6,
      background: 'rgba(140,170,230,0.04)', border: '1px solid var(--border-subtle)',
    }}>
      <Icon size={11} color={color} />
      {children}
    </div>
  );
}

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
    intervalRef.current = setInterval(fetchStats, 3000);
    return () => clearInterval(intervalRef.current);
  }, [activeTab?.id, activeTab?.status]);

  const cpuNum = stats ? parseInt(stats.cpu) : 0;
  const cpuColor = cpuNum > 80 ? '#f87171' : cpuNum > 50 ? '#fbbf24' : '#34d399';
  const memPct = stats && stats.memTotal !== '-' ? Math.min(100, (parseInt(stats.memUsed) / parseInt(stats.memTotal)) * 100) : 0;
  const memColor = memPct > 85 ? '#f87171' : memPct > 65 ? '#fbbf24' : '#60a5fa';

  return (
    <div
      className="glass"
      style={{
        height: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 11, color: 'var(--text-secondary)', userSelect: 'none', flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        background: 'linear-gradient(180deg, rgba(15,21,36,0.5), rgba(10,15,26,0.7))',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
        {activeTab && connected && stats ? (
          <>
            <Pill Icon={Server} color="var(--accent-light)"><span>{stats.hostname}</span></Pill>

            <Pill Icon={Cpu} color={cpuColor}>
              <span style={{ color: cpuColor }}>{stats.cpu}%</span>
              <div style={{ width: 34, height: 4, background: 'rgba(140,170,230,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: `${Math.min(100, cpuNum)}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  style={{ height: '100%', background: cpuColor, borderRadius: 2 }} />
              </div>
            </Pill>

            <Pill Icon={MemoryStick} color={memColor}>
              <span style={{ color: memColor }}>{stats.memUsed}/{stats.memTotal}M</span>
              <div style={{ width: 30, height: 4, background: 'rgba(140,170,230,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: `${memPct}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  style={{ height: '100%', background: memColor, borderRadius: 2 }} />
              </div>
            </Pill>

            <Pill Icon={HardDrive} color="#67e8f9">
              <span style={{ color: '#67e8f9' }}>{stats.diskUsed}/{stats.diskTotal}G</span>
            </Pill>

            <Pill Icon={ArrowUpCircle} color="#34d399"><span style={{ color: '#34d399' }}>{stats.netUp}</span></Pill>
            <Pill Icon={ArrowDownCircle} color="#60a5fa"><span style={{ color: '#60a5fa' }}>{stats.netDown}</span></Pill>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
              <Clock size={10} />
              <span>{stats.uptime}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
              <User size={10} />
              <span>{stats.user}</span>
            </div>
            {stats.mounts.length > 0 && stats.mounts.slice(0, 3).map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-faint)' }}>
                <HardDriveDownload size={9} />
                <span>{m}</span>
              </div>
            ))}
          </>
        ) : activeTab ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {connected
              ? <Wifi size={12} color="var(--success)" />
              : activeTab.status === 'connecting'
                ? <Wifi size={12} color="var(--warning)" />
                : <WifiOff size={12} color="var(--text-faint)" />}
            <span style={{ color: connected ? 'var(--success)' : activeTab.status === 'connecting' ? 'var(--warning)' : 'var(--text-muted)' }}>
              {connected ? 'Connected' : activeTab.status === 'connecting' ? 'Connecting…' : 'Disconnected'}
            </span>
            <span style={{ color: 'var(--text-faint)' }}>·</span>
            <span>{activeTab.session.username}@{activeTab.session.host}</span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Ready</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-faint)' }}>
        {activeTab && <span>:{activeTab.session.port}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Command size={10} />
          <span>K</span>
        </div>
      </div>
    </div>
  );
}
