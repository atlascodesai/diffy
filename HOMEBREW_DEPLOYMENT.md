# Homebrew Deployment Guide

Complete guide for deploying a Tauri macOS app to Homebrew with automated releases, code signing, and notarization.

## Prerequisites

- [ ] macOS application built with Tauri
- [ ] GitHub repository for your app
- [ ] Apple Developer Account ($99/year)
- [ ] GitHub account

## Step 1: Apple Developer Setup

### 1.1 Create Developer ID Application Certificate

1. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Click the **+** button to create a new certificate
3. Select **Developer ID Application** (for distribution outside the Mac App Store)
4. Click **Continue**

### 1.2 Generate Certificate Signing Request (CSR)

On your Mac:
```bash
# Generate private key and CSR
openssl genrsa -out signing-key.key 2048
openssl req -new -key signing-key.key -out app.certSigningRequest -subj "/emailAddress=your-email@example.com/CN=Your Name/C=US"
```

Upload the `.certSigningRequest` file to Apple Developer portal and download the certificate (`.cer` file).

### 1.3 Create .p12 Bundle

```bash
# Convert .cer to .pem
openssl x509 -in developerID_application.cer -inform DER -out cert.pem

# Create .p12 bundle with password
openssl pkcs12 -export -out certificate.p12 -inkey signing-key.key -in cert.pem -password pass:YOUR_PASSWORD -legacy

# Convert to base64 for GitHub Secrets
base64 -i certificate.p12 -o certificate.p12.base64
```

**Important**: Use the `-legacy` flag to ensure compatibility with macOS security tools.

### 1.4 Create App-Specific Password

1. Go to [Apple ID Account Management](https://appleid.apple.com/account/manage)
2. Sign in with your Apple Developer account
3. Under **Sign-In and Security** → **App-Specific Passwords**
4. Click **Generate Password**
5. Name it "App Notarization" and save the password (format: `xxxx-xxxx-xxxx-xxxx`)

## Step 2: Configure Your Tauri App

### 2.1 Update tauri.conf.json

Set macOS-only targets:
```json
{
  "bundle": {
    "active": true,
    "targets": ["dmg", "app"],
    "icon": ["icons/icon.icns"]
  }
}
```

### 2.2 Update Version Numbers

Before each release, update version in **all** these files:
- `src-tauri/Cargo.toml` - `version = "X.Y.Z"`
- `src-tauri/tauri.conf.json` - `"version": "X.Y.Z"`
- `package.json` - `"version": "X.Y.Z"`
- Any UI files showing version (e.g., `index.html`)

## Step 3: GitHub Setup

### 3.1 Add GitHub Secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:
- `APPLE_CERTIFICATE_BASE64` - Contents of `certificate.p12.base64`
- `APPLE_CERTIFICATE_PASSWORD` - Password you used creating .p12
- `APPLE_ID` - Your Apple Developer email
- `APPLE_TEAM_ID` - Found in Apple Developer account (10-character ID)
- `APPLE_APP_PASSWORD` - App-specific password from Step 1.4
- `HOMEBREW_TAP_TOKEN` - GitHub PAT with `repo` scope (for updating Homebrew tap)

### 3.2 Create GitHub Actions Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-macos:
    strategy:
      matrix:
        include:
          - runner: macos-13
            target: x86_64-apple-darwin
          - runner: macos-14
            target: aarch64-apple-darwin

    runs-on: ${{ matrix.runner }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: npm install

      - name: Import Code Signing Certificate
        env:
          CERTIFICATE_BASE64: ${{ secrets.APPLE_CERTIFICATE_BASE64 }}
          CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          CERTIFICATE_PATH=$RUNNER_TEMP/build_certificate.p12
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db

          echo -n "$CERTIFICATE_BASE64" | base64 --decode -o $CERTIFICATE_PATH

          security create-keychain -p "$CERTIFICATE_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$CERTIFICATE_PASSWORD" $KEYCHAIN_PATH

          security import $CERTIFICATE_PATH -P "$CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security list-keychain -d user -s $KEYCHAIN_PATH

          security set-key-partition-list -S apple-tool:,apple: -s -k "$CERTIFICATE_PASSWORD" $KEYCHAIN_PATH

      - name: Build Tauri app
        run: npm run tauri build
        env:
          APPLE_SIGNING_IDENTITY: "Developer ID Application: YOUR_NAME (TEAM_ID)"

      - name: Code Sign App
        run: |
          codesign --force --options runtime --deep --sign "Developer ID Application: YOUR_NAME (TEAM_ID)" src-tauri/target/release/bundle/macos/YourApp.app

      - name: Notarize App
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_APP_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
        run: |
          ditto -c -k --keepParent src-tauri/target/release/bundle/macos/YourApp.app YourApp.zip

          xcrun notarytool submit YourApp.zip \
            --apple-id "$APPLE_ID" \
            --team-id "$APPLE_TEAM_ID" \
            --password "$APPLE_APP_PASSWORD" \
            --wait

          xcrun stapler staple src-tauri/target/release/bundle/macos/YourApp.app

      - name: Get version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Package app
        run: |
          tar -czf yourapp-${{ matrix.target }}.tar.gz -C src-tauri/target/release/bundle/macos YourApp.app
          shasum -a 256 yourapp-${{ matrix.target }}.tar.gz > yourapp-${{ matrix.target }}.tar.gz.sha256

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: yourapp-${{ matrix.target }}
          path: |
            yourapp-${{ matrix.target }}.tar.gz
            yourapp-${{ matrix.target }}.tar.gz.sha256

  create-release:
    needs: build-macos
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Create release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            artifacts/yourapp-x86_64-apple-darwin/yourapp-x86_64-apple-darwin.tar.gz
            artifacts/yourapp-x86_64-apple-darwin/yourapp-x86_64-apple-darwin.tar.gz.sha256
            artifacts/yourapp-aarch64-apple-darwin/yourapp-aarch64-apple-darwin.tar.gz
            artifacts/yourapp-aarch64-apple-darwin/yourapp-aarch64-apple-darwin.tar.gz.sha256
          draft: false
          prerelease: false
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  update-homebrew-formula:
    needs: create-release
    runs-on: ubuntu-latest

    steps:
      - name: Checkout homebrew-yourapp
        uses: actions/checkout@v4
        with:
          repository: yourusername/homebrew-yourapp
          token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
          path: homebrew-yourapp

      - name: Get version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Download SHA256 files
        run: |
          curl -sL https://github.com/yourusername/yourapp/releases/download/v${{ steps.version.outputs.VERSION }}/yourapp-x86_64-apple-darwin.tar.gz.sha256 -o x86_64.sha256
          curl -sL https://github.com/yourusername/yourapp/releases/download/v${{ steps.version.outputs.VERSION }}/yourapp-aarch64-apple-darwin.tar.gz.sha256 -o aarch64.sha256

      - name: Extract SHA256 hashes
        id: sha256
        run: |
          echo "X86_64_SHA=$(cut -d' ' -f1 x86_64.sha256)" >> $GITHUB_OUTPUT
          echo "AARCH64_SHA=$(cut -d' ' -f1 aarch64.sha256)" >> $GITHUB_OUTPUT

      - name: Update cask
        run: |
          cat > homebrew-yourapp/Casks/yourapp.rb << 'EOF'
          cask "yourapp" do
            version "${{ steps.version.outputs.VERSION }}"
            sha256 arm:   "${{ steps.sha256.outputs.AARCH64_SHA }}",
                   intel: "${{ steps.sha256.outputs.X86_64_SHA }}"

            arch arm: "aarch64", intel: "x86_64"

            url "https://github.com/yourusername/yourapp/releases/download/v#{version}/yourapp-#{arch}-apple-darwin.tar.gz"
            name "YourApp"
            desc "Your app description"
            homepage "https://github.com/yourusername/yourapp"

            app "YourApp.app"

            binary "#{appdir}/YourApp.app/Contents/MacOS/yourapp"

            zap trash: [
              "~/Library/Application Support/com.yourcompany.yourapp",
              "~/Library/Caches/com.yourcompany.yourapp",
              "~/Library/Preferences/com.yourcompany.yourapp.plist",
            ]
          end
          EOF

      - name: Commit and push
        run: |
          cd homebrew-yourapp
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Casks/yourapp.rb
          git commit -m "Update yourapp to v${{ steps.version.outputs.VERSION }}"
          git push
```

## Step 4: Create Homebrew Tap

### 4.1 Create Tap Repository

1. Create a new GitHub repository named `homebrew-yourapp` (must start with `homebrew-`)
2. Clone it locally:
   ```bash
   git clone https://github.com/yourusername/homebrew-yourapp.git
   cd homebrew-yourapp
   ```

### 4.2 Create Cask Directory and Formula

```bash
mkdir -p Casks
```

Create `Casks/yourapp.rb`:
```ruby
cask "yourapp" do
  version "0.1.0"
  sha256 arm:   "PLACEHOLDER_ARM64_SHA",
         intel: "PLACEHOLDER_X86_64_SHA"

  arch arm: "aarch64", intel: "x86_64"

  url "https://github.com/yourusername/yourapp/releases/download/v#{version}/yourapp-#{arch}-apple-darwin.tar.gz"
  name "YourApp"
  desc "Your app description"
  homepage "https://github.com/yourusername/yourapp"

  app "YourApp.app"

  binary "#{appdir}/YourApp.app/Contents/MacOS/yourapp"

  zap trash: [
    "~/Library/Application Support/com.yourcompany.yourapp",
    "~/Library/Caches/com.yourcompany.yourapp",
    "~/Library/Preferences/com.yourcompany.yourapp.plist",
  ]
end
```

### 4.3 Create README

Create `README.md`:
```markdown
# Homebrew Tap for YourApp

## Installation

```bash
brew install --cask yourusername/yourapp/yourapp
```

## Updating

```bash
brew upgrade --cask yourapp
```
\```
```

Commit and push:
```bash
git add .
git commit -m "Initial Homebrew tap setup"
git push
```

### 4.4 Create GitHub Personal Access Token

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Name: "Homebrew Tap Update"
4. Scopes: Check `repo` (full control of private repositories)
5. Click **Generate token** and save it
6. Add as `HOMEBREW_TAP_TOKEN` secret in your main app repository

## Step 5: Release Your App

### 5.1 Create a Release

```bash
# Update version numbers in all files (see Step 2.2)

# Commit changes
git add .
git commit -m "Bump version to v0.1.0"
git push

# Create and push tag
git tag v0.1.0
git push origin v0.1.0
```

### 5.2 Monitor Release

1. Go to your repository → **Actions** tab
2. Watch the workflow run
3. Check that all jobs complete successfully:
   - ✅ Build for both architectures
   - ✅ Code signing
   - ✅ Notarization
   - ✅ GitHub Release created
   - ✅ Homebrew tap updated

## Step 6: Test Installation

### 6.1 Install on Fresh Machine

```bash
brew install --cask yourusername/yourapp/yourapp
```

### 6.2 Verify Installation

```bash
# Check app launches without security warnings
open -a YourApp

# Verify code signature
codesign -dv /Applications/YourApp.app

# Check notarization
spctl -a -vvv -t install /Applications/YourApp.app
```

Should show:
```
/Applications/YourApp.app: accepted
source=Notarized Developer ID
```

## Troubleshooting

### "Damaged" Error on Launch

This usually means notarization failed or quarantine needs removal:

```bash
# Check notarization status
spctl -a -vvv -t install /Applications/YourApp.app

# If notarized but still showing error, remove quarantine
xattr -d com.apple.quarantine /Applications/YourApp.app
```

### Certificate Import Fails in CI

Make sure you used the `-legacy` flag when creating .p12:
```bash
openssl pkcs12 -export -out certificate.p12 -inkey signing-key.key -in cert.pem -password pass:YOUR_PASSWORD -legacy
```

### Notarization Fails

Check the notarization log:
```bash
xcrun notarytool log SUBMISSION_ID --apple-id "your@email.com" --team-id "TEAM_ID" --password "xxxx-xxxx-xxxx-xxxx"
```

Common issues:
- App not properly signed with `--options runtime`
- Missing entitlements for hardened runtime
- Unsigned dylibs or frameworks

### Homebrew Formula Not Updating

1. Check `HOMEBREW_TAP_TOKEN` has `repo` scope
2. Verify repository name in workflow matches actual tap repo
3. Check workflow logs for git push errors

## Security Checklist

After setup, delete these local files:
- ✅ `signing-key.key` (private key)
- ✅ `certificate.p12` (contains private key)
- ✅ `certificate.p12.base64` (contains private key)
- ✅ `app.certSigningRequest` (no longer needed)
- ✅ Any `.pem` certificate files (optional, but not needed)

Keep secure:
- ✅ Certificate in macOS Keychain (for local development)
- ✅ All secrets in GitHub repository secrets (for CI/CD)

## Future Releases

For each new version:

1. Update version numbers in 4 files
2. Commit and push changes
3. Create and push git tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
4. Everything else is automated! ✨

Users can upgrade with:
```bash
brew upgrade --cask yourapp
```
