# Android App Signing Setup

This document explains how to set up signing for release builds of the Serika.art Android app.

## Creating a Keystore

If you don't have a keystore yet, create one:

```bash
keytool -genkey -v -keystore serika-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias serika
```

You'll be prompted to:
1. Create a keystore password
2. Enter your name, organization, etc.
3. Create a key password (can be the same as keystore password)

**⚠️ IMPORTANT: Keep your keystore file and passwords safe! If you lose them, you won't be able to update your app.**

## Setting up GitHub Secrets

For automated builds, you need to add the following secrets to your GitHub repository:

### 1. KEYSTORE_BASE64

Convert your keystore to base64:

```bash
base64 -i serika-release-key.jks | tr -d '\n'
```

Copy the output and add it as a secret named `KEYSTORE_BASE64`.

### 2. KEYSTORE_PASSWORD

The password you used when creating the keystore.

### 3. KEY_ALIAS

The alias you used (e.g., `serika`).

### 4. KEY_PASSWORD

The key password (often the same as keystore password).

## Adding Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:
   - `KEYSTORE_BASE64`
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`

## Creating a Release

To create a new release:

1. Update the version in `android/app/build.gradle.kts`:
   ```kotlin
   versionCode = 2  // Increment this
   versionName = "1.1.0"  // Update version name
   ```

2. Commit and push your changes

3. Create and push a tag:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

4. The GitHub Action will automatically:
   - Build the signed APK
   - Create a GitHub release
   - Upload the APK to the release

## Local Signing (Development)

For local release builds, create a `local.properties` file in the `android` directory:

```properties
storeFile=path/to/your/keystore.jks
storePassword=your_store_password
keyAlias=your_key_alias
keyPassword=your_key_password
```

Then update `app/build.gradle.kts` to use these properties for signing.

**⚠️ Never commit `local.properties` or your keystore file to version control!**

## Verifying APK Signature

To verify an APK is signed correctly:

```bash
apksigner verify --verbose app-release.apk
```

Or using jarsigner:

```bash
jarsigner -verify -verbose -certs app-release.apk
```
