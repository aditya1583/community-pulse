# 🍎 iOS Signing Guide (Windows Edition)

Since you don't have a Mac, we need to generate a Certificate Signing Request (CSR) manually or use a workaround. 

## Step 1: Generate a CSR (Certificate Signing Request)

You need to override the lack of Keychain Access.

**Option A: Cloud CSR Generator (Easiest)**
1. Go to [match.fastlane.tools](https://match.fastlane.tools) (or use any online CSR generator, but be careful with privacy).
2. **BETTER OPTION:** If you have `git` installed, you likely have `openssl`.
   - Open **"Git Bash"** (not PowerShell, not Command Prompt).
   - Type this:
     ```bash
     openssl genrsa -out ios_dist.key 2048
     openssl req -new -key ios_dist.key -out ios_dist.csr -subj "/CN=Voxlo Distribution"
     ```
   - This creates `ios_dist.csr` (upload this to Apple) and `ios_dist.key` (KEEP THIS SAFE!).

## Step 2: Create Certificate on Apple Developer Portal

1. Go to [Apple Developer Account](https://developer.apple.com/account).
2. Click **Certificates, Identifiers & Profiles**.
3. **Identifiers**:
   - Click `+`.
   - Select **App IDs** -> **App**.
   - Description: `Voxlo`.
   - Bundle ID: `app.voxlo` (Must match your Capacitor config!).
   - Capabilities: Enable "Push Notifications" if you need them.
   - Click **Register**.
4. **Certificates**:
   - Click `+`.
   - Select **iOS Distribution (App Store and Ad Hoc)**.
   - Choose the `ios_dist.csr` file you created in Step 1.
   - Download the resulting `.cer` file (e.g., `distribution.cer`).

## Step 3: Convert to .p12 (The Tricky Part)

GitHub needs a `.p12` file, which contains both the Cert + Private Key.

1. Open **Git Bash** again.
2. Run this command (replace filenames as needed):
   ```bash
   openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM
   openssl pkcs12 -export -inkey ios_dist.key -in distribution.pem -out ios_dist.p12
   ```
   - It will ask for a **password**. Create a strong one. **REMEMBER THIS PASSWORD**.

## Step 4: Create Provisioning Profile

1. Back to Apple Developer Portal -> **Profiles**.
2. Click `+`.
3. Select **App Store** (for TestFlight/Production).
4. Select the App ID you created (`app.voxlo`).
5. Select the Certificate you just created.
6. Name it `Voxlo App Store Profile`.
7. Download parameters (`.mobileprovision` file).
8. **Base64 Encode it**:
   - On Windows PowerShell:
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("Voxlo_App_Store_Profile.mobileprovision")) > profile_base64.txt
     ```
   - Or upload to a site like [base64encode.org](https://www.base64encode.org) (drag only the .mobileprovision file).

## Step 5: Add Secrets to GitHub

Go to your GitHub Repo -> **Settings** -> **Secrets and variables** -> **Actions**.

Add these 3 Repository Secrets:

| Name | Value |
|------|-------|
| `IOS_P12_BASE64` | The BASE64 CONTENT of your `.p12` file (use `openssl base64 -in ios_dist.p12` or an online tool) |
| `IOS_P12_PASSWORD` | The password you typed in Step 3 |
| `IOS_PROVISION_PROFILE_BASE64` | The BASE64 CONTENT of your `.mobileprovision` file (from Step 4) |

## Summary of Files You Need

1. `ios_dist.p12` (Encrypted cert + key)
2. `profile_base64.txt` (Text version of provisioning profile)
3. The Password for the P12.

Once these 3 secrets are in GitHub, tell me "Secrets Added", and I will update the Build Bot to sign the app!
