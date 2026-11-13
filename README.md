<p align="center">
  <img src="docs/logo.svg" alt="Weav-Tune Logo" width="120" height="100">
</p>

<h1 align="center">Weav-Tune</h1>

<p align="center">
  <b>A next-generation, open-source streaming music player with a stunning Liquid Glass UI.</b><br>
  Built for Web, Android, iOS, and Desktop.
</p>

<p align="center">
  <a href="https://github.com/alejandrokundrah/weav-tune"><img src="https://img.shields.io/badge/GitHub-weav--tune-25A0D4?logo=github&logoColor=white" alt="GitHub Repo"></a>
  <img src="https://img.shields.io/badge/UI-Liquid%20Glass-49C4E2" alt="Liquid Glass UI">
  <img src="https://img.shields.io/badge/Web-React%20%C2%B7%20Vite%20%C2%B7%20Tailwind-38BDF8?logo=react&logoColor=white" alt="Web Player">
  <img src="https://img.shields.io/badge/Android-8.0%2B-3DDC84?logo=android&logoColor=white" alt="Android 8.0+">
  <img src="https://img.shields.io/badge/iOS-16%2B%20%C2%B7%20SwiftUI-007AFF?logo=apple&logoColor=white" alt="iOS 16+">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-25A0D4" alt="GPL-3.0 License"></a>
</p>

<p align="center">
  <a href="#highlights">Highlights</a>
  &nbsp;·&nbsp;
  <a href="#liquid-glass-ui">Liquid Glass UI</a>
  &nbsp;·&nbsp;
  <a href="#platforms">Platforms</a>
  &nbsp;·&nbsp;
  <a href="#features">Features</a>
  &nbsp;·&nbsp;
  <a href="#screenshots">Screenshots</a>
  &nbsp;·&nbsp;
  <a href="#building--running-locally">Building & Running</a>
  &nbsp;·&nbsp;
  <a href="#license">License</a>
</p>

---

## Overview

**Weav-Tune** is a privacy-first music player that communicates directly with streaming endpoints via YouTube Music's internal Innertube API. It requires **no API keys, no mandatory user accounts, and no proprietary tracking servers**. 

Enjoy seamless, ad-free music with high-fidelity audio, synchronized lyrics, lossless audio add-ons, and a fluid, crystalline **Liquid Glass UI** powered by modern CSS, React, Jetpack Compose, and SwiftUI.

---

## Highlights

- 💎 **Liquid Glass UI**: Translucent glass surfaces, specular rim highlights, refractive lens displacement, and an ambient animated fluid aura in Weav Blue (`#25A0D4`) and Cyan (`#49C4E2`).
- 🚫 **No Ads & Privacy-Focused**: Direct stream parsing without third-party tracking or injected advertisements.
- 🔓 **Account Optional**: Start listening immediately. Optionally connect YouTube Music or Spotify to carry over your personal library, playlists, and favorites.
- 🎵 **Lossless Audio Add-ons**: Built-in support for BitChord and direct FLAC audio sources with automatic fallback and quality upgrading.
- 🎧 **Audiophile Sound Engine**: 15-band ISO equalizer, 8,000+ AutoEq headphone corrections, bit-perfect USB DAC output, loudness normalization, gapless playback, and equal-power crossfade.
- 🎙️ **Synchronized Lyrics**: Word-by-word synced lyrics powered by LRCLIB, accessible both online and with downloaded offline tracks.
- 👥 **Listen Together**: Peer-to-peer real-time synced playback rooms with end-to-end encrypted chat over Nostr relays.
- 📻 **Live Radio & Podcasts**: Instant access to 50,000+ radio stations from Radio Browser, music video integration, and podcast subscriptions.

---

## Liquid Glass UI

Weav-Tune is engineered around a cohesive, modern **Liquid Glass** aesthetic:

- **Atmospheric Fluid Backdrop**: Real-time animated radiant nebulae drifting behind the app layer, generating natural depth and dynamic refraction under glass surfaces.
- **Specular Rim Highlights**: Multi-layered inner specular strokes catch light at container perimeters, giving buttons, cards, and panels the appearance of curved optical glass.
- **Translucent Prismatic Controls**: Floating glass player pill, glass search capsule, and translucent sidebar navigation that blend smoothly with content.
- **High-Saturation Blur**: `backdrop-filter: blur(28px) saturate(200%)` delivers vivid colors through frosted panels without sacrificing readability or high text contrast.

---

## Screenshots

<div align="center">
  <table>
    <tr>
      <td width="33%"><img src="docs/screenshots/01-player.jpg" alt="Player with artwork-matched glow"><br><sub><b>Now Playing</b> · Glass Player with dynamic wash</sub></td>
      <td width="33%"><img src="docs/screenshots/02-lyrics.jpg" alt="Synced lyrics word-by-word"><br><sub><b>Synced Lyrics</b> · Real-time word-by-word timing</sub></td>
      <td width="33%"><img src="docs/screenshots/03-explore.jpg" alt="Explore Moods and Genres"><br><sub><b>Explore</b> · Curated moods, charts, and new releases</sub></td>
    </tr>
    <tr>
      <td width="33%"><img src="docs/screenshots/04-radio.jpg" alt="Live Internet Radio"><br><sub><b>Live Radio</b> · 50,000+ worldwide stations</sub></td>
      <td width="33%"><img src="docs/screenshots/05-together.jpg" alt="Listen Together Room"><br><sub><b>Listen Together</b> · Encrypted peer-to-peer rooms</sub></td>
      <td width="33%"><img src="docs/screenshots/06-podcasts.jpg" alt="Podcasts"><br><sub><b>Podcasts</b> · Full episode feeds and subscriptions</sub></td>
    </tr>
  </table>
</div>

---

## Platforms

### 🌐 Web Player & Companion Extension

The modern web player is built with **React 19**, **Vite**, and **Tailwind CSS**:
- Works seamlessly on modern Chromium, Firefox, and Safari browsers.
- Includes a companion **WXT browser extension** for Chrome and Firefox to enable authenticated YouTube Music and Spotify integration while keeping authentication cookies isolated in the browser sandbox.
- Supports direct FLAC lossless streaming via CORS-enabled audio add-on services.

### 📱 Android

Native Android application built with **Kotlin**, **Jetpack Compose**, and **AndroidX Media3**:
- Runs on Android 8.0 (API 26) through Android 15+.
- System sound effects support (Dolby Atmos, Samsung SoundAlive).
- Bit-perfect USB DAC output for external DAC hardware.
- Android Auto and Android TV integration with QR-code phone sign-in.

### 🍏 iOS & iPadOS

Native iOS build written in **Swift** and **SwiftUI**:
- Runs on iOS / iPadOS 16 or newer.
- Lock screen playback controls, AirPlay integration, background playback, and LRCLIB synced lyrics.
- Sideloadable via **SideStore**, **AltStore**, or **Sideloadly**.

---

## Features

### Audio & Playback
- **Lossless Audio Add-ons**: Connect custom HTTPS service endpoints or BitChord manifests in *Settings → Audio → Audio add-ons* for automated FLAC quality upgrades.
- **Adaptive Stream Resolver**: Automated switching between high-speed Innertube streams, raw client walk, and fallback resolvers.
- **15-Band Equalizer & AutoEq**: Comprehensive frequency management with presets and AutoEq profiles for over 8,000 headphone models.
- **Equal-Power Crossfade**: Smooth 1–12 second transitions between tracks.
- **Loudness Normalization**: Prevents sudden volume spikes across disparate albums and sources.
- **Spatial 3D & 8D Audio**: Real-time HRTF-inspired audio circling and directional acoustic expansion for headphones.
- **SponsorBlock**: Automatically skip non-music segments, sponsor plugs, and intro banter in music videos.

### Library & Discovery
- **Smart Recommendations**: Choose recommendations powered by YouTube Music, Spotify public algorithms, or JioSaavn.
- **Listen Together**: Spin up ephemeral Nostr listening rooms to share playback with friends with end-to-end encryption.
- **Shazam Song Recognition**: Identify music playing in your surroundings via built-in audio fingerprinting.
- **Offline Downloads**: Download individual tracks or complete playlists with embedded synced lyrics.

---

## Building & Running Locally

### Prerequisites
- **Node.js** 20+ (Node 22 or 24 recommended)
- **pnpm** (enabled via `corepack enable`)
- **JDK** 17 or 21 (for Android builds)
- **Android SDK** with Platform 36/37 (for Android builds)

### 1. Web Player & Extension

```bash
# Clone the repository
git clone https://github.com/alejandrokundrah/weav-tune.git
cd weav-tune/web

# Install workspace dependencies
pnpm install

# Run the Web Player development server (starts on http://localhost:5173)
pnpm dev

# Run the browser extension development server
pnpm dev:ext

# Typecheck and run tests
pnpm typecheck
pnpm test

# Build for production
pnpm --filter @weavtune/app build
pnpm --filter @weavtune/extension build
```

### 2. Android App

```bash
# Debug build (generates APK in app/build/outputs/apk/debug/)
./gradlew assembleDebug

# Release build
./gradlew assembleRelease

# Run unit tests & lint
./gradlew testDebugUnitTest
./gradlew lintDebug
```

### 3. iOS App

```bash
cd ios
# Generate Xcode project using XcodeGen
xcodegen generate

# Open in Xcode
open WeavTune.xcodeproj
```

---

## Project Structure

```text
weav-tune/
├── web/
│   ├── app/              # Vite + React web player with Liquid Glass styling
│   ├── extension/        # WXT browser extension (Chrome, Edge, Firefox)
│   ├── desktop/          # Desktop app: the web player in an Electron window
│   └── shared/           # Shared types, RPC bridge, and protocol schemas
├── app/                  # Native Android app (Kotlin, Jetpack Compose, Media3)
├── ios/                  # Native iOS app (SwiftUI, WeavTuneCore)
├── docs/                 # Documentation, specifications, and screenshots
└── services/             # Lossless audio add-on microservices
```

---

## Disclaimer

Weav-Tune is an independent, open-source project and is not affiliated with, endorsed by, or associated with YouTube, Google, Spotify, or any artists or record labels shown. All artist names, track titles, and album covers belong to their respective copyright holders.

---

## License

Weav-Tune is open-source software licensed under the **[GNU General Public License v3.0 (GPL-3.0)](LICENSE)**. Third-party software notices and licenses are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
