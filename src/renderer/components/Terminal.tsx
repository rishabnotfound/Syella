import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { SyeSession, SyeSettings } from '../../types';

const SYELLA_BANNER = [
  '\x1b[38;2;90;162;255m',
  '   ____            _ _       ',
  '  / ___| _   _  __| | | __ _ ',
  '  \\___ \\| | | |/ _\\ | |/ _` |',
  '   ___) | |_| |  __/ | | (_| |',
  '  |____/ \\__, |\\___|_|_|\\__,_|',
  '         |___/                ',
  '\x1b[0m',
  '',
  '\x1b[38;2;90;162;255m  \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\x1b[0m',
  '\x1b[38;2;120;140;170m  Portable SSH Workstation v1.0\x1b[0m',
  '\x1b[38;2;90;162;255m  \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\x1b[0m',
  '',
].join('\r\n');

export interface TerminalHandle {
  zoom: (delta: number) => void;
  resetZoom: () => void;
  runCommand: (cmd: string) => void;
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

  const connect = useCallback(async () => {
    const creds = await window.syella.invoke('db:getCredentials', session.id);
    const term = termRef.current!;
    const fit = fitRef.current!;
    fit.fit();
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
    term.loadAddon(new WebLinksAddon());
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

    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    term.write(SYELLA_BANNER);
    term.writeln(`\x1b[38;2;120;140;170m  \u25B8 SSH session to \x1b[38;2;90;162;255m${session.username}\x1b[38;2;120;140;170m@\x1b[38;2;139;220;255m${session.host}\x1b[38;2;120;140;170m:\x1b[38;2;139;233;253m${session.port}\x1b[0m`);
    term.writeln(`\x1b[38;2;120;140;170m  \u25B8 Establishing connection...\x1b[0m\r\n`);

    term.onData(data => window.syella.send('ssh:data', tabId, data));
    term.onResize(({ cols, rows }) => window.syella.send('ssh:resize', tabId, cols, rows));

    const unsubs: (() => void)[] = [];
    unsubs.push(window.syella.on(`ssh:data:${tabId}`, (data: any) => {
      if (data instanceof Uint8Array) term.write(data);
      else if (data && typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) term.write(new Uint8Array(data.data));
      else term.write(data);
    }));
    unsubs.push(window.syella.on(`ssh:connected:${tabId}`, () => {
      onConnected();
    }));
    unsubs.push(window.syella.on(`ssh:disconnected:${tabId}`, () => onDisconnected()));
    unsubs.push(window.syella.on(`ssh:error:${tabId}`, (msg: any) => {
      term.writeln(`\r\n\x1b[38;2;248;113;113m  \u2718 Error: ${msg}\x1b[0m`);
      onError(msg);
    }));

    // Skip fit when the container is hidden (display:none → 0×0) or when the
    // effective cols/rows haven't actually changed. Prevents the shell from
    // receiving a spurious SIGWINCH on tab switch, which would redraw the
    // prompt on a fresh line mid-typing.
    let lastCols = term.cols, lastRows = term.rows;
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

  return <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0a0f1a', padding: 2 }} />;
});

export default TerminalView;
