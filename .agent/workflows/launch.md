---
description: Procedures for deploying Voxlo to Vercel and preparing for iOS submission.
---

# Voxlo Launch Workflow

## 1. Technical Audit (Local)
- [ ] Run `npm run lint` and fix any critical warnings.
- [ ] Ensure `manifest.webmanifest` contains your final app name ("Voxlo").
- [ ] Verify `src/lib/constants/radius.ts` is set to exactly 10 miles.

## 2. Visual Assets (in /public)
- [ ] `favicon.ico`
- [ ] `icon-192.png`
- [ ] `icon-512.png`
- [ ] `apple-touch-icon.png`

## 3. Vercel Deployment
1. **Push to Git**: `git push origin main`
2. **Setup Vercel**: Connect repo to Vercel.
3. **Env Vars**: Mirror all keys from `.env.local` to Vercel Dashboard.
4. **Domain**: Link `voxlo.app` in Vercel settings.

## 4. Search & Discovery
- [ ] Verify `https://voxlo.app/robots.txt` is accessible.
- [ ] Verify `https://voxlo.app/sitemap.xml` is rendering correctly.
- [ ] Register the site on **Google Search Console**.

## 5. iOS Packaging (Native Wrapper)
1. `npm install @capacitor/core @capacitor/ios`
2. `npx cap init`
3. `npm run build`
4. `npx cap add ios`
5. `npx cap open ios` (In Xcode, configure Bundle ID `com.voxlo.app`)
