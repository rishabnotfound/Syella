import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { SyeSession, SyeSettings } from '../../types';

const SYELLA_BANNER = [
  '\x1b[38;2;56;140;255m',
  '   ____            _ _       ',
  '  / ___| _   _  __| | | __ _ ',
  '  \\___ \\| | | |/ _\\ | |/ _` |',
  '   ___) | |_| |  __/ | | (_| |',
  '  |____/ \\__, |\\___|_|_|\\__,_|',
  '         |___/                ',
  '\x1b[0m',
  '',
  '\x1b[38;2;56;140;255m  \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\x1b[0m',
  '\x1b[38;2;90;112;144m  Portable SSH Workstation v1.0\x1b[0m',
  '\x1b[38;2;56;140;255m  \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\x1b[0m',
  '',
].join('\r\n');

interface Props {
  tabId: string;
  session: SyeSession;
  settings: SyeSettings | null;
  onConnected: () => void;
  onDisconnected: () => void;
  onError: (msg: string) => void;
}

export default function TerminalView({ tabId, session, settings, onConnected, onDisconnected, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

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

  useEffect(() => {
    if (!containerRef.current) return;
    const ts = settings?.terminal;
    const term = new XTerm({
      cursorBlink: ts?.cursorBlink ?? true,
      cursorStyle: ts?.cursorStyle ?? 'bar',
      fontFamily: ts?.fontFamily ?? "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize: ts?.fontSize ?? 14,
      lineHeight: 1.2,
      scrollback: ts?.scrollback ?? 10000,
      theme: {
        background: '#0c1018',
        foreground: '#c8d0e0',
        cursor: '#388CFF',
        cursorAccent: '#0c1018',
        selectionBackground: 'rgba(56,140,255,0.28)',
        selectionForeground: '#ffffff',
        black: '#1e2736',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#c8d0e0',
        brightBlack: '#4d5b75',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new SearchAddon());
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    try { term.loadAddon(new WebglAddon()); } catch {}
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    term.write(SYELLA_BANNER);
    term.writeln(`\x1b[38;2;80;100;130m  \u25B8 SSH session to \x1b[38;2;56;140;255m${session.username}\x1b[38;2;80;100;130m@\x1b[38;2;80;190;255m${session.host}\x1b[38;2;80;100;130m:\x1b[38;2;139;233;253m${session.port}\x1b[0m`);
    term.writeln(`\x1b[38;2;80;100;130m  \u25B8 Establishing connection...\x1b[0m\r\n`);

    term.onData(data => window.syella.send('ssh:data', tabId, data));
    term.onResize(({ cols, rows }) => window.syella.send('ssh:resize', tabId, cols, rows));

    const unsubs: (() => void)[] = [];
    unsubs.push(window.syella.on(`ssh:data:${tabId}`, (data: any) => term.write(data)));
    unsubs.push(window.syella.on(`ssh:connected:${tabId}`, () => {
      onConnected();
    }));
    unsubs.push(window.syella.on(`ssh:disconnected:${tabId}`, () => onDisconnected()));
    unsubs.push(window.syella.on(`ssh:error:${tabId}`, (msg: any) => {
      term.writeln(`\r\n\x1b[38;2;255;85;85m  \u2718 Error: ${msg}\x1b[0m`);
      onError(msg);
    }));

    const onResize = () => { try { fit.fit(); } catch {} };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    connect();

    return () => {
      unsubs.forEach(u => u());
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      term.dispose();
    };
  }, [tabId]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0c1018', padding: 2 }} />;
}
