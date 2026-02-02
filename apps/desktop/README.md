# Manchengo Smart ERP - Desktop Application

Native desktop application for Windows and macOS built with Tauri.

## Architecture

- **Frontend**: Next.js (shared with web)
- **Backend**: Rust (Tauri)
- **Local Database**: SQLite
- **Sync**: Event-based with central PostgreSQL server

## Features

- ✅ Offline-first operation
- ✅ SQLite local storage
- ✅ File system access (PDF/Excel exports)
- ✅ Native printing
- ✅ Device registration
- ✅ License validation
- ✅ Sync with central server

## Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (18+)
- [Tauri CLI](https://tauri.app/): `cargo install tauri-cli`

### Windows Additional
- Visual Studio Build Tools 2019+
- WebView2 Runtime

### macOS Additional
- Xcode Command Line Tools
- For notarization: Apple Developer Account

## Development

```bash
# Install dependencies
cd ../web && npm install && cd ../desktop

# Start development server
cargo tauri dev
```

## Building

### Windows
```powershell
# Debug build
.\scripts\build-windows.ps1

# Release build with signing
.\scripts\build-windows.ps1 -Release -Sign
```

### macOS
```bash
# Debug build
./scripts/build-macos.sh

# Release build with notarization
./scripts/build-macos.sh --release --notarize
```

## Distribution

### Windows
- **MSI**: `target/release/bundle/msi/`
- **NSIS**: `target/release/bundle/nsis/`

### macOS
- **App**: `target/release/bundle/macos/`
- **DMG**: Created during notarization

## Configuration

### tauri.conf.json
- `devPath`: Frontend dev server URL
- `distDir`: Built frontend path
- `bundle.identifier`: App identifier
- `bundle.windows`: Windows-specific config
- `bundle.macOS`: macOS-specific config

### Environment Variables

For notarization:
- `APPLE_ID`: Apple Developer email
- `APPLE_TEAM_ID`: Team ID
- `APPLE_APP_PASSWORD`: App-specific password

For signing:
- Windows: Certificate thumbprint in tauri.conf.json

## Device Registration

The desktop app automatically:
1. Generates unique device ID (hardware-based)
2. Detects platform (WINDOWS/MACOS)
3. Registers with central server on first sync
4. Validates license on each sync

## Sync Protocol

Uses same event-based sync as mobile:
1. **Push**: Local events → Server
2. **Pull**: Server events → Local
3. **Device validation**: On every sync
4. **License check**: Read-only if expired

## File Structure

```
apps/desktop/
├── Cargo.toml          # Rust dependencies
├── tauri.conf.json     # Tauri configuration
├── build.rs            # Build script
├── src/
│   ├── main.rs         # App entry point
│   ├── commands.rs     # Tauri commands
│   ├── database.rs     # SQLite operations
│   ├── device.rs       # Device identification
│   └── sync.rs         # Server synchronization
├── migrations/
│   └── 001_init.sql    # Database schema
├── scripts/
│   ├── build-windows.ps1
│   └── build-macos.sh
└── icons/              # App icons
```

## License

Proprietary - Manchengo Smart ERP
