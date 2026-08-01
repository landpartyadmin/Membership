# Land Party Website + Membership Portal — Setup Guide

Three pieces: a Google Sheet (database), a Google Apps Script (backend/API),
and a set of HTML pages — the full public site plus the registration form
and admin dashboard. No paid hosting or database needed.

## Site pages
| Page | Purpose |
|---|---|
| `index.html` | Homepage |
| `manifesto.html` | Manifesto — Land / People / Services |
| `leader.html` | Chief Leader profile |
| `media.html` | News & media gallery |
| `support.html` | Donate / support the party |
| `contact.html` | Contact form (wired to the backend) |
| `register.html` | Member registration (wired to the backend) |
| `admin.html` | Password-protected admin dashboard |

All pages share `style.css` for consistent branding — edit that one
file to change colors/fonts sitewide. All files (HTML, CSS, and images) sit in one flat folder — no subfolders — so file paths inside the HTML are just filenames like `logo.png`, not `assets/logo.png`.

## 1. Create the Google Sheet
1. Go to sheets.google.com → **Blank spreadsheet**. Name it `Land Party Members`.
2. Leave it empty — the script creates the `Members` and `EmailLog` tabs
   automatically the first time it runs.

## 2. Add the Apps Script
1. In the sheet: **Extensions → Apps Script**.
2. Delete the placeholder code and paste in the contents of `Code.gs`.
3. Click the disk icon to save (name the project "Land Party Portal").

## 3. Set your admin password
1. In the Apps Script editor: **Project Settings** (gear icon, left sidebar).
2. Under **Script Properties**, click **Add script property**.
3. Property: `ADMIN_PASSWORD`, Value: choose a strong password. Save.
4. Add `ADMIN_EMAIL` with the address that should receive contact-form notifications and the weekly reminder email.

## 4. Deploy as a Web App
1. Back in the editor: **Deploy → New deployment**.
2. Click the gear next to "Select type" → **Web app**.
3. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**. Authorize the permissions it asks for (this is your own script, so it's safe to approve).
5. Copy the **Web app URL** — it ends in `/exec`. You'll need this next.

> Redeploy note: any time you edit `Code.gs`, you must go to **Deploy → Manage deployments → Edit (pencil) → New version → Deploy** for changes to go live. The URL stays the same.

## 5. Connect the frontend pages
Three pages talk to the backend and each needs the Web App URL pasted in:
`register.html`, `contact.html`, and `admin.html`. In each, find:
   ```js
   const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   ```
and replace it with the URL you copied in step 4. (`index.html`, `manifesto.html`, `leader.html`, `media.html`, and `support.html` are static and don't need it.)

## 6. Host the pages
Upload every file — all the `.html` pages plus every image and `style.css` — into the same folder on your host, keeping them flat (no subfolders). This can replace the hosting for landparty.org directly, or sit on a simple static host like GitHub Pages/Netlify. Keep `admin.html`'s URL out of the site nav in production (it already is) since it's protected only by the shared password, not a hidden URL.

## Social sharing (Open Graph)
Every public page has Open Graph and Twitter Card metadata in its `<head>`, so links shared on WhatsApp, Facebook, X, etc. show a proper preview card — title, description, and a branded image (`og-image.jpg`, generated to the recommended 1200×630 size). These currently point to `https://www.landparty.org/...` — if the site ends up hosted at a different domain, find-and-replace that domain across all the `.html` files.

## How it works
- **Registration** (`register.html`) → posts to the Apps Script → writes a row to the `Members` tab, generates a membership number like `LP2026-00001`, emails the new member a welcome message, and shows them a membership card with a referral code to share.
- **Admin dashboard** (`admin.html`) → password-gated, reads/writes the same sheet:
  - **Overview** — total members, provinces represented, bar chart by province.
  - **Ranking** — leaderboard of members by how many people they've referred (tracked via the "Referred by" field at registration).
  - **Members** — searchable, filterable by province.
  - **Send Email** — compose a message, filter by province/municipality, send to everyone matching. Logged in the `EmailLog` tab.

## Placeholders you still need to fill in
- **PayFast buttons** (`support.html`) — the R200 / R1000 / Custom buttons link to `#`. Once you have a PayFast merchant account, replace those `href` values with your PayFast payment links.
- **Deposit form download** (`support.html`) — the "Download Deposit Form" button also links to `#`. Upload the actual PDF form and point the link at it.
- **Social links** — Facebook/Twitter icons in the nav and footer link to `#` everywhere; swap in the party's real profile URLs.

## Known limits (Google's, not this build's)
- **Email quota**: a free Gmail account can send ~100 emails/day through Apps Script; a Google Workspace account ~1500/day. If the party has more members than that, send bulk emails in batches by province, or connect a Google Workspace account for higher limits.
- **Password protection is basic**: the admin password is checked on every request but isn't a full login system (no per-admin accounts, no audit trail of who sent what). Fine for a small trusted admin team; let me know if you later want individual admin logins.
- **Referral integrity**: referral codes are just membership numbers typed in at signup — there's no verification beyond "does this number exist." Someone could misattribute a referral by mistake, but there's no financial stake so it's low-risk.

## Next steps (not built yet, easy to add later)
- Full site replica in the same visual style, with `register.html` as the "Join" page.
- Municipal-level (ward) filtering, if you want emails to go even more local than municipality.
- CSV export of the members list from the admin dashboard.
