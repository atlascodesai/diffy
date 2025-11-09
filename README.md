# Diffy

<img width="256" height="256" alt="128x128@2x" src="https://github.com/user-attachments/assets/73d89376-6e51-4c00-a785-a5dd8c931eb0" />

<img width="1792" height="1042" alt="image" src="https://github.com/user-attachments/assets/719d45dd-1ac7-47a9-8a4e-bb1f5b7630ba" />

A modern, native diff tool for macOS built with Tauri and TypeScript.

## Features

- Side-by-side text comparison
- Syntax highlighting for differences
- Drag & drop file support
- Text manipulation tools (lowercase, sort, trim)
- Diff history with configurable retention
- Keyboard shortcuts for productivity
- Native macOS app with system integration

## Installation

### Homebrew (Recommended)

Install with a single command:

```bash
brew install --cask atlascodesai/diffy/diffy
```

This automatically taps the repository and installs Diffy. No separate tap command needed!

**Alternative**: If you prefer to tap first:

```bash
brew tap atlascodesai/diffy
brew install --cask diffy
```

### Manual Installation

1. Download the latest release for your architecture:
   - **Apple Silicon (M1/M2/M3)**: [diffy-aarch64-apple-darwin.tar.gz](https://github.com/atlascodesai/diffy/releases/latest)
   - **Intel**: [diffy-x86_64-apple-darwin.tar.gz](https://github.com/atlascodesai/diffy/releases/latest)

2. Extract the archive and drag `Diffy.app` to your Applications folder

3. On first launch, if you see a security warning, go to **System Settings → Privacy & Security** and click "Open Anyway"

## Usage

Launch Diffy from Applications or run from terminal:

```bash
open -a Diffy
# or
diffy
```

### Keyboard Shortcuts

- `⌘ + Enter` or `⌘ + R` - Run comparison
- `⌘ + N` - New diff (clear all)
- `⌘ + H` - Toggle history sidebar
- `⌃ + ⌥ + S` - Switch left and right text
- `⌃ + ⌥ + R` - Clear all
- `ESC` - Close history sidebar

## Development

### Prerequisites

- Node.js 20+
- Rust (latest stable)
- Xcode Command Line Tools

### Setup

```bash
npm install
```

### Run Development Server

```bash
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

## Release Process

Releases are fully automated via GitHub Actions when a version tag is pushed.

### Creating a New Release

1. **Update version numbers** in all config files:
   - `src-tauri/Cargo.toml` - `version = "X.Y.Z"`
   - `src-tauri/tauri.conf.json` - `"version": "X.Y.Z"`
   - `package.json` - `"version": "X.Y.Z"`
   - `index.html` - version number in settings modal

2. **Commit changes**:
   ```bash
   git add .
   git commit -m "Bump version to vX.Y.Z"
   git push
   ```

3. **Create and push tag**:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. **Automated workflow will**:
   - Build for both Intel (x86_64) and Apple Silicon (aarch64)
   - Sign the app with Developer ID Application certificate
   - Notarize with Apple for Gatekeeper
   - Create GitHub Release with binaries and SHA256 checksums
   - Automatically update Homebrew cask formula

### GitHub Secrets Required

The following secrets must be set in the repository:

- `APPLE_CERTIFICATE_BASE64` - Base64-encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD` - Certificate password
- `APPLE_ID` - Apple Developer email
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `APPLE_APP_PASSWORD` - App-specific password for notarization
- `HOMEBREW_TAP_TOKEN` - GitHub PAT with repo access for homebrew-diffy

### Code Signing & Notarization

The app is signed with a Developer ID Application certificate and notarized with Apple to ensure it passes Gatekeeper checks. This happens automatically in CI.

For local signing setup:
1. Export certificate from Keychain as .p12
2. Convert to base64: `base64 -i certificate.p12 -o certificate.p12.base64`
3. Add to GitHub Secrets

## Architecture

- **Frontend**: Vanilla TypeScript + Vite
- **Backend**: Rust + Tauri 2.0
- **Diff Engine**: [jsdiff](https://github.com/kpdecker/jsdiff)
- **Styling**: Custom CSS with system fonts
- **Build**: GitHub Actions with matrix builds for multi-architecture support

## Repository Structure

- `src/` - TypeScript frontend code
- `src-tauri/` - Rust backend code
- `.github/workflows/` - CI/CD pipelines
- `public/` - Static assets

## Distribution

- **Primary**: Homebrew Cask via [homebrew-diffy](https://github.com/atlascodesai/homebrew-diffy)
- **Secondary**: Direct downloads from GitHub Releases
- **Platforms**: macOS only (Intel & Apple Silicon)

## License

MIT

## Credits

Built with:
- [Tauri](https://tauri.app)
- [jsdiff](https://github.com/kpdecker/jsdiff)
- [Vite](https://vitejs.dev)
- [TypeScript](https://www.typescriptlang.org)
