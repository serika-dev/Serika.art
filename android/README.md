# Serika.art Android App

Native Android app for [Serika.art](https://serika.art) - an image sharing platform.

## Features

- 📱 Native Android experience with Material 3 design
- 🖼️ Browse images with infinite scrolling
- 🔍 Search images by tags, artists, and keywords
- 🏷️ Browse tags by category (General, Artist, Character, Copyright, Meta)
- 👤 View artist and user profiles
- ❤️ Favorite images
- 👍👎 Vote on images
- 🎨 Support for light/dark themes
- 🔞 Content rating filters (Safe/Questionable/Explicit)
- 🤖 AI-generated content filter
- 🔐 User authentication

## Tech Stack

- **Language**: Kotlin
- **UI**: Jetpack Compose with Material 3
- **Architecture**: MVVM with Repository pattern
- **DI**: Hilt
- **Networking**: Retrofit + OkHttp + Kotlin Serialization
- **Image Loading**: Coil
- **Navigation**: Navigation Compose
- **Paging**: Paging 3
- **Local Storage**: DataStore Preferences

## Requirements

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34
- Minimum Android version: 8.0 (API 26)

## Setup

1. Open the `/android` directory in Android Studio
2. Sync Gradle files
3. Run on an emulator or physical device

## Building

### Debug Build
```bash
./gradlew assembleDebug
```

### Release Build
```bash
./gradlew assembleRelease
```

## Project Structure

```
app/
├── src/main/
│   ├── java/art/serika/app/
│   │   ├── data/
│   │   │   ├── local/          # DataStore preferences
│   │   │   ├── model/          # Data models
│   │   │   ├── remote/         # API service
│   │   │   └── repository/     # Repositories
│   │   ├── di/                 # Hilt modules
│   │   ├── navigation/         # Navigation setup
│   │   └── ui/
│   │       ├── components/     # Reusable UI components
│   │       ├── screens/        # Screen composables & ViewModels
│   │       └── theme/          # Theme, colors, typography
│   └── res/                    # Resources (strings, colors, etc.)
```

## API Configuration

The app connects to `https://serika.art/api/` by default. To use a different server, modify the `API_BASE_URL` in `app/build.gradle.kts`:

```kotlin
buildConfigField("String", "API_BASE_URL", "\"https://your-server.com/api/\"")
```

## License

This project is part of Serika.art. See the main project's LICENSE file for details.
