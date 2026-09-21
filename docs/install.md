---
title: Install guides
order: 2
---

# Install guides

Before installing, host your images (see [Getting started](/docs/getting-started/)). Then in the builder open **Install**.

> These steps reflect the mail apps as of 2026. Menus change often, so every release re-checks them on real devices (see [Compatibility](/compat/)). If a step differs, tell us with an issue.

## Gmail

**Gmail on the web**

1. In the builder click **Copy formatted signature**.
2. Gmail → Settings (gear) → **See all settings** → **General**.
3. Under **Signature** choose _Create new_ (or edit one), paste with Ctrl/Cmd+V.
4. Under **Signature defaults** select it for new emails and replies. **Save Changes**.

Gmail limits a signature to 10,000 characters. The builder blocks the copy button when you are over, and offers fixes ("use text links instead of icons", "remove the disclaimer", and so on).

**Gmail app (iOS and Android).** The app can only set a plain-text mobile signature. Turn the mobile signature **off** (Menu → Settings → your account → Mobile Signature) and the app uses your web signature for Google accounts.

## Outlook

**Outlook on the web and new Outlook.** Copy the formatted signature, then Settings → Accounts → Signatures (new Outlook) or Settings → Mail → Compose and reply (outlook.com), _New signature_, paste, save.

**Classic Outlook for Windows.** Download the **.htm** file, put it in `%APPDATA%\Microsoft\Signatures`, restart Outlook, then File → Options → Mail → Signatures. Outlook 2016 and 2019 show only frame 1 of each GIF; Microsoft 365 builds animate.

**Outlook for Mac.** Copy the formatted signature; Outlook → Settings → Signatures → **+**, paste.

**Outlook on iOS and Android.** Use _Send to my phone_ in the builder: scan the QR code, tap **Copy signature**, then in Outlook go to Settings → your account → Signature and paste. Formatting support in the mobile signature box varies by version.

## Apple Mail

**Mail on macOS.** Download the **.mailsignature** file. In Mail create a placeholder signature (Settings → Signatures → +), quit Mail, replace the placeholder file in `~/Library/Mail/V10/MailData/Signatures/` with the downloaded one, lock it (Get Info → Locked), and reopen Mail. Pasting also works for simple designs.

**Mail on iPhone and iPad.** Open the _Send to my phone_ link, tap **Copy signature**, then Settings → Apps → Mail → Signature, and paste. If the formatting looks lost, shake the phone and choose **Undo Change Attributes**.

**iCloud Mail on the web** has a limited signature editor; send from the Mail apps instead.

## Send yourself a test

**Download test email (.eml)** opens as an editable draft in Outlook (and as a message in Apple Mail), so you can send it to yourself and see how it arrives on each device.
