<p align="center">
  <img src="assets/icon.png" width="120" alt="Syella" />
</p>

<h1 align="center">Syella</h1>

<p align="center">Your portable SSH workstation.</p>

<p align="center">
  <img src="assets/banner.png" alt="Syella" />
</p>

<p align="center">
  <a href="https://github.com/rishabnotfound/Syella/releases"><img src="https://img.shields.io/github/v/release/rishabnotfound/Syella?style=flat-square&color=388CFF" alt="Latest release" /></a>
  <a href="https://github.com/rishabnotfound/Syella/blob/main/LICENSE"><img src="https://img.shields.io/github/license/rishabnotfound/Syella?style=flat-square&color=388CFF" alt="License" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-388CFF?style=flat-square" alt="Platforms" />
</p>

---

## Why Syella

Every serious engineer ends up managing more than one server. The existing options force a compromise: bare `ssh` gives you nothing to organize with, PuTTY feels like 2003, and the polished commercial clients want a subscription for basic session storage.

Syella is a single native desktop app that gives you the terminal, the file browser, the credential vault, the cost dashboard, and the session manager — all in one keyboard-first workspace. Free, offline-first, and open source.

## Features

### Terminal

- Multi-tab SSH terminal built on **xterm.js** with WebGL rendering for buttery-smooth scroll
- **Split panes** — horizontal and vertical, unlimited depth
- **WebGL fallback** — automatically drops to the DOM renderer if the GPU context is lost
- **Configurable everything** — font, size, cursor style, cursor blink, scrollback, bell
- Clickable URLs open in your default browser (never inside the app)
- Search inside the terminal buffer

### SFTP file management

- Side-by-side **file browser** that slides in over the terminal
- Browse, upload, download, rename, delete — all with keyboard and mouse
- **Drag and drop uploads** for files *and* folders (recursive)
- **Full-panel upload progress overlay** with real-time byte counter and cancel button
- Recursive delete with a live progress overlay
- Show/hide dotfiles
- Breadcrumb navigation with click-to-jump
- Inline file viewer powered by **Monaco Editor** — syntax highlighting for 80+ languages

### Session management

- Organize connections into **groups** with drag-to-reorder
- **Tags**, **favorites**, and **notes** per session
- **Quick Connect** command palette (⌘K / Ctrl+K) — fuzzy search across every server
- **Reconnect overlay** with retry when a connection drops
- Password *or* private-key authentication (with optional passphrase)
- Session-level overrides for keepalive, timeout, and startup command

### Credential security

- All passwords, private keys, and passphrases stored **encrypted at rest** using **AES-256-GCM**
- Encryption key derived per-installation with **PBKDF2** (200,000 iterations, SHA-512)
- **Stealth Connect** mode — masks your SSH client fingerprint from hostile servers (generic OpenSSH identity string, no agent forwarding, no forwarded env vars, stripped public-key comment)
- **Auto-lock** after N minutes of inactivity
- Optional password prompt for sessions with no stored credentials

### Fleet Overview

A dashboard that appears the moment you attach cost or expiry data to any server:

- **Daily / monthly / yearly** aggregate spend across your entire fleet
- **Live currency conversion** — view your spend in USD, EUR, INR, GBP, JPY, CAD, or AUD
- FX rates fetched from live public APIs, cached for 6 hours, revalidated in the background
- **7-day expiry warnings** — see exactly which servers renew this week and which are overdue
- Per-server monthly cost, expiry countdown, and provider tag
- Sortable, sorted by soonest-to-expire by default

### Snippets

- Store frequently-used commands as **one-click snippets**
- Bar at the bottom of the terminal for instant execution
- Perfect for `docker ps`, `systemctl status`, or your custom deploy incantation

### Backup and restore

- One-click **encrypted backup** — a `.syella` file containing every session, group, credential, and setting
- Password-protected using the same AES-256-GCM scheme as the database
- **Non-destructive import** — restores merge with existing data, nothing gets deleted

### Design

- **Native feel** on macOS (traffic lights inline with custom titlebar), Windows, and Linux
- Framer Motion transitions everywhere — never a jarring cut
- Glass-morphic dark UI with configurable accent color and transparency
- Full **keyboard-first** navigation with a shortcuts overlay (⌘/)

---

## Install

Download the latest build for your platform from the [Releases](https://github.com/rishabnotfound/Syella/releases) page.

| Platform | File | Notes |
|---|---|---|
| **macOS Apple Silicon** | `Syella-x.y.z-arm64.dmg` | M1 / M2 / M3 / M4 |
| **macOS Intel** | `Syella-x.y.z.dmg` | Pre-2020 Macs |
| **Windows** | `Syella.Setup.x.y.z.exe` | Standard installer |
| **Windows portable** | `Syella-Portable-x.y.z.exe` | No install — single file |
| **Linux** | `Syella-x.y.z.AppImage` | Universal — any distro |
| **Debian / Ubuntu** | `syella_x.y.z_amd64.deb` | `sudo dpkg -i syella_*.deb` |

### macOS quarantine

Syella is not signed with an Apple Developer certificate. On first open, mount the DMG and **double-click `Install Syella.command`** — it installs the app and clears the quarantine flag in one step.

If you dragged the app manually and see *"Syella is damaged"*, run:

```bash
xattr -cr /Applications/Syella.app
```

The app is fine — it's just unsigned.

### Windows SmartScreen

Click **More info** → **Run anyway** on first launch. One-time prompt.

---

## Build from source

```bash
git clone https://github.com/rishabnotfound/Syella.git
cd Syella
npm install
npm start
```

To produce distributable installers for your OS:

```bash
npm run dist
```

---

## Stack

**Electron 43** · **React 19** · **TypeScript** · **xterm.js** · **ssh2** · **sql.js** · **Monaco Editor** · **Framer Motion** · **Lucide**

---

## License

MIT — see [LICENSE](LICENSE).

## Author

Built by [rishabnotfound](https://github.com/rishabnotfound). Issues, ideas, PRs welcome.
