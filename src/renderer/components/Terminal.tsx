import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { SyeSession, SyeSettings } from '../../types';

export interface TerminalHandle {
  zoom: (delta: number) => void;
  resetZoom: () => void;
  runCommand: (cmd: string) => void;
  copySelection: () => void;
  pasteFromClipboard: () => void;
  selectAll: () => void;
  focus: () => void;
}

interface Props {
  tabId: string;
  session: SyeSession;
  settings: SyeSettings | null;
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (msg: string) => void;
}

const TerminalView = forwardRef<TerminalHandle, Props>(function TerminalView(
  { tabId, session, settings, onConnected, onDisconnected, onError }, ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const baseFontRef = useRef<number>(settings?.terminal?.fontSize ?? 14);
  // The connecting overlay lives OUTSIDE xterm so xterm's buffer only ever
  // contains real server bytes — that's what keeps the MOTD pristine.
  const [showIntro, setShowIntro] = useState(true);
  const [errText, setErrText] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const creds = await window.syella.invoke('db:getCredentials', session.id);
    const term = termRef.current!;
    const fit = fitRef.current!;
    // Wait for the container to actually have layout — on first mount the
    // tab panel isn't laid out yet, so an immediate fit() latches xterm at
    // 80×24 and the PTY is opened at that tiny size.
    const waitForLayout = () => new Promise<void>(resolve => {
      let tries = 0;
      const tick = () => {
        const el = containerRef.current;
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return resolve();
        if (++tries > 30) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await waitForLayout();
    try { fit.fit(); } catch {}
    await window.syella.invoke('ssh:connect', {
      tabId, session, credentials: creds || { sessionId: session.id },
      cols: term.cols, rows: term.rows,
    });
  }, [tabId, session]);

  const fitIfVisible = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
    try { fitRef.current?.fit(); } catch {}
  }, []);

  useImperativeHandle(ref, () => ({
    zoom: (delta: number) => {
      const term = termRef.current; if (!term) return;
      const next = Math.max(8, Math.min(28, (term.options.fontSize ?? baseFontRef.current) + delta));
      term.options.fontSize = next;
      fitIfVisible();
    },
    resetZoom: () => {
      const term = termRef.current; if (!term) return;
      term.options.fontSize = baseFontRef.current;
      fitIfVisible();
    },
    runCommand: (cmd: string) => {
      window.syella.send('ssh:data', tabId, cmd + '\r');
    },
    copySelection: () => {
      const term = termRef.current; if (!term) return;
      const sel = term.getSelection();
      if (sel) navigator.clipboard.writeText(sel).catch(() => {});
    },
    pasteFromClipboard: () => {
      navigator.clipboard.readText().then(text => {
        if (text) window.syella.send('ssh:data', tabId, text);
      }).catch(() => {});
    },
    selectAll: () => { termRef.current?.selectAll(); },
    focus: () => { termRef.current?.focus(); },
  }), [tabId, fitIfVisible]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ts = settings?.terminal;
    baseFontRef.current = ts?.fontSize ?? 14;
    const term = new XTerm({
      cursorBlink: ts?.cursorBlink ?? true,
      cursorStyle: ts?.cursorStyle ?? 'bar',
      fontFamily: ts?.fontFamily ?? "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize: ts?.fontSize ?? 14,
      lineHeight: 1.2,
      scrollback: ts?.scrollback ?? 10000,
      theme: {
        background: '#0a0f1a',
        foreground: '#d0d7e6',
        cursor: '#5aa2ff',
        cursorAccent: '#0a0f1a',
        selectionBackground: 'rgba(90,162,255,0.28)',
        selectionForeground: '#ffffff',
        black: '#1e2736',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#67e8f9',
        white: '#d0d7e6',
        brightBlack: '#4d5b75',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde68a',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#a5f3fc',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new SearchAddon());
    // Route xterm link clicks straight to the OS browser via IPC —
    // WebLinksAddon's default `window.open` is silently blocked by our CSP,
    // which is why clicks appeared to do nothing.
    term.loadAddon(new WebLinksAddon((_e, url) => {
      window.syella.invoke('shell:openExternal', url);
    }));
    term.open(containerRef.current);

    // WebGL renderer: if it fails or loses context, dispose and let xterm
    // fall back to its DOM renderer. Without this, a lost WebGL context
    // makes xterm busy-loop trying to repaint at 100% CPU on packaged
    // macOS builds — the "npm start smooth / installed .app melts" bug.
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => { webgl.dispose(); });
      term.loadAddon(webgl);
    } catch {}

    termRef.current = term;
    fitRef.current = fit;

    term.onData(data => window.syella.send('ssh:data', tabId, data));
    term.onResize(({ cols, rows }) => window.syella.send('ssh:resize', tabId, cols, rows));

    // Standard clipboard shortcuts: Cmd+C / Ctrl+Shift+C copies iff selection
    // exists (otherwise falls through so Ctrl+C still sends SIGINT), and
    // Cmd+V / Ctrl+Shift+V pastes clipboard content into the shell.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      const mac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const primary = mac ? e.metaKey : (e.ctrlKey && e.shiftKey);
      if (primary && (e.key === 'c' || e.key === 'C')) {
        const sel = term.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel).catch(() => {});
          return false;
        }
      }
      if (primary && (e.key === 'v' || e.key === 'V')) {
        navigator.clipboard.readText().then(text => {
          if (text) window.syella.send('ssh:data', tabId, text);
        }).catch(() => {});
        return false;
      }
      if (primary && (e.key === 'a' || e.key === 'A')) {
        term.selectAll();
        return false;
      }
      return true;
    });

    const unsubs: (() => void)[] = [];
    unsubs.push(window.syella.on(`ssh:data:${tabId}`, (data: any) => {
      if (data instanceof Uint8Array) term.write(data);
      else if (data && typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) term.write(new Uint8Array(data.data));
      else term.write(data);
    }));
    unsubs.push(window.syella.on(`ssh:connected:${tabId}`, () => {
      setShowIntro(false);
      onConnected();
      // Force a refit once the intro overlay is dismissed. xterm's renderer
      // may have latched onto stale dimensions during the mount race; without
      // this the terminal stays a tiny box in the corner until the user
      // Cmd +/- to trigger a resize themselves.
      const refitBurst = () => {
        const el = containerRef.current;
        if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
        try {
          fit.fit();
          const { cols, rows } = term;
          window.syella.send('ssh:resize', tabId, cols, rows);
          lastCols = cols; lastRows = rows;
        } catch {}
      };
      requestAnimationFrame(() => {
        refitBurst();
        requestAnimationFrame(refitBurst);
        setTimeout(refitBurst, 120);
      });
    }));
    unsubs.push(window.syella.on(`ssh:disconnected:${tabId}`, () => onDisconnected()));
    unsubs.push(window.syella.on(`ssh:error:${tabId}`, (msg: any) => {
      setErrText(String(msg));
      setShowIntro(false);
      onError(msg);
    }));

    // Skip fit when the container is hidden (display:none → 0×0) or when the
    // effective cols/rows haven't actually changed. Prevents the shell from
    // receiving a spurious SIGWINCH on tab switch, which would redraw the
    // prompt on a fresh line mid-typing.
    let lastCols = 0, lastRows = 0;
    const safeFit = () => {
      const el = containerRef.current;
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
      try {
        const dims = fit.proposeDimensions();
        if (!dims || !dims.cols || !dims.rows) return;
        if (dims.cols === lastCols && dims.rows === lastRows) return;
        fit.fit();
        lastCols = term.cols; lastRows = term.rows;
      } catch {}
    };
    window.addEventListener('resize', safeFit);
    const ro = new ResizeObserver(safeFit);
    ro.observe(containerRef.current);

    connect();

    return () => {
      unsubs.forEach(u => u());
      window.removeEventListener('resize', safeFit);
      ro.disconnect();
      term.dispose();
    };
  }, [tabId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0a0f1a', padding: 2 }} />
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute', inset: 0,
              background: '#0a0f1a',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 18,
              pointerEvents: 'none', userSelect: 'none',
            }}>
            <motion.img
              src="assets/icon.png" alt=""
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 0.9, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ width: 56, height: 56 }} />
            <div style={{
              fontSize: 12, color: '#8ba2c9', fontFamily: 'var(--font-mono)',
              letterSpacing: 0.4, textAlign: 'center',
            }}>
              Connecting to{' '}
              <span style={{ color: '#5aa2ff' }}>{session.username}</span>
              <span style={{ color: '#5a6a85' }}>@</span>
              <span style={{ color: '#8bdcff' }}>{session.host}</span>
              <span style={{ color: '#5a6a85' }}>:</span>
              <span style={{ color: '#8be9fd' }}>{session.port}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5a6a85', fontSize: 11 }}>
              <Loader2 size={12} className="spin" />
              Establishing SSH session…
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {errText && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 14px', borderRadius: 8, fontSize: 11.5,
          background: 'rgba(248,113,113,0.12)',
          border: '1px solid rgba(248,113,113,0.3)',
          color: '#fca5a5', pointerEvents: 'none',
        }}>
          {errText}
        </div>
      )}
    </div>
  );
});

export default TerminalView;
