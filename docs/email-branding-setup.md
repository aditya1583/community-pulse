# Voxlo - Branded Email Setup Guide

This guide walks you through setting up custom branded emails for authentication using **Resend** as the email provider.

## Why Custom Emails?

By default, Supabase sends emails from `noreply@mail.app.supabase.io` with generic branding. Users may not trust or recognize these emails. Custom emails:

- Send from `noreply@yourdomain.com`
- Include your branding and logo
- Build user trust
- Look professional

## Prerequisites

1. A domain you control (e.g., `voxlo.app`)
2. Access to your domain's DNS settings
3. Supabase project dashboard access

---

## Step 1: Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your email address
3. Navigate to **Domains** in the sidebar

## Step 2: Add and Verify Your Domain

1. Click **Add Domain**
2. Enter your domain (e.g., `voxlo.app`)
3. Resend will show you DNS records to add:
   - **SPF record** (TXT)
   - **DKIM records** (TXT)
   - **MX record** (optional, for receiving)

4. Add these records to your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.)
5. Click **Verify** - this may take a few minutes to propagate

## Step 3: Get SMTP Credentials from Resend

1. In Resend dashboard, go to **SMTP**
2. Note down the credentials:
   ```
   Host: smtp.resend.com
   Port: 465 (SSL) or 587 (TLS)
   Username: resend
   Password: re_xxxxxxxxxxxx (your API key)
   ```

## Step 4: Configure Supabase SMTP

1. Go to your **Supabase Dashboard**
2. Navigate to **Project Settings** → **Authentication**
3. Scroll to **SMTP Settings**
4. Enable **Custom SMTP**
5. Enter the following:

   | Field | Value |
   |-------|-------|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | Your Resend API key |
   | Sender email | `noreply@yourdomain.com` |
   | Sender name | `Voxlo` |

6. Click **Save**

## Step 5: Update Email Templates

In Supabase Dashboard → **Authentication** → **Email Templates**, update each template:

### Confirm Signup Template

**Subject:** `Welcome to Voxlo - Verify your email`

**Body:** (Copy from `email-templates/confirm-signup.html`)

### Reset Password Template

**Subject:** `Reset your Voxlo password`

**Body:** (Copy from `email-templates/reset-password.html`)

### Magic Link Template

**Subject:** `Your Voxlo sign-in link`

**Body:** (Copy from `email-templates/magic-link.html`)

---

## Step 6: Test Your Setup

1. Create a new test account in your app
2. Check your email inbox
3. Verify the email shows:
   - From: `Voxlo <noreply@yourdomain.com>`
   - Branded content with your colors/logo
   - No mention of Supabase

---

## Troubleshooting

### Emails not arriving?

1. Check spam/junk folder
2. Verify DNS records are propagated (`dig TXT yourdomain.com`)
3. Check Resend dashboard for delivery logs
4. Ensure Supabase SMTP settings are correct

### DNS propagation taking too long?

- DNS changes can take up to 48 hours
- Use [dnschecker.org](https://dnschecker.org) to verify propagation

### Email marked as spam?

1. Ensure SPF and DKIM records are correctly set
2. Avoid spam trigger words in subject/body
3. Include unsubscribe link (template includes this)

---

## Email Templates

The branded email templates are located in:
- `email-templates/confirm-signup.html`
- `email-templates/reset-password.html`
- `email-templates/magic-link.html`
- `email-templates/change-email.html`

Each template uses Voxlo branding with:
- Emerald/teal color scheme
- Dark mode aesthetic
- Mobile-responsive design
- Clear call-to-action buttons
