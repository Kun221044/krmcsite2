# KRMC website with built-in admin

This is the Kenyan Rotax Max Challenge website, with a password-protected **admin area at `/admin`**. One admin can edit **every** part of the site there: text, menus, events, calendar, news articles, classes, photos, logos, partners, links and footer. Changes go live the moment you click **Save & publish**. There is no redeploying.

## How it works

```
krmc-site/
├── index.html              ← the public page (builds itself from the site content)
├── assets/                 ← site styles + script
├── content/site.json       ← the ORIGINAL content (used until the first save in /admin)
├── admin/                  ← the admin editor (yoursite/admin)
├── netlify/functions/      ← small server functions: login, save, upload, history
├── netlify/lib/core.mjs    ← shared security + storage code
├── images/                 ← optional: images you add to the repo yourself
├── netlify.toml            ← Netlify settings (headers, caching)
├── package.json            ← one dependency: @netlify/blobs
├── 404.html, favicon.svg
```

- **Content and uploaded images live in Netlify Blobs**, Netlify's built-in storage. It's included with every site, with nothing extra to sign up for.
- The public page loads the latest saved content on every visit, so edits appear instantly.
- Every save keeps the previous version (the last 30). You can roll back from **Admin → History & restore**.

## 1. Deploy (one time)

> **Note:** Netlify's drag-and-drop "Drop" page **does not run server functions**, so the admin won't work if you deploy that way. Use GitHub (recommended) or the Netlify command-line tool. You only do this once. After that, all editing is in `/admin`.

### Option A: GitHub (recommended)
1. Create a free GitHub account and a new repository, e.g. `krmc-site`.
2. Upload everything **inside** this folder to the repository (on GitHub: *Add file → Upload files*, drag the contents in, *Commit*).
3. In Netlify: **Add new site → Import an existing project → GitHub**, then pick the repository.
4. Leave the build settings as they are (there's no build command; `netlify.toml` handles it). Click **Deploy**.

### Option B: Netlify command-line tool
```bash
npm install -g netlify-cli
cd krmc-site
npm install
netlify login
netlify deploy --prod      # first time: choose "Create & configure a new site"
```

## 2. Switch on the admin (one time)

1. In Netlify, open your site and go to **Site configuration → Environment variables → Add a variable**.
   - **Key:** `ADMIN_PASSWORD`
   - **Value:** a strong password of at least 8 characters. Use 14+ characters, ideally a passphrase like `kart-Nairobi-apex-2026!`.
   - *(Optional)* **Key:** `SESSION_SECRET`. **Value:** any long random text. Without it, sessions are signed using your password.
2. Go to **Deploys → Trigger deploy → Deploy site** so the functions pick up the password.
3. Visit **`https://your-site.netlify.app/admin`** and sign in.

**To change the password**, edit `ADMIN_PASSWORD` and trigger one deploy. Everyone currently signed in is signed out.

## 3. Using the admin

| Area | What you can edit |
|---|---|
| Site & logo | Browser title, Google/social description, main logo, link-preview image |
| Header & menu | Top-right links, main menu, drop-down items |
| Hero banner | Big photo, headline, subtitle, button |
| Upcoming events | Event tabs with live countdowns (add, reorder, delete) |
| Calendar | Season table; Completed / Next Up / Upcoming update automatically |
| News & articles | Cards and full article text; new articles are added at the top |
| Classes | Class tiles: name, ages, photo, link |
| Video | Paste any YouTube link |
| About, Getting started, Life lessons | All text |
| Photo strip | Square photos (optionally linked to Instagram posts) |
| App & social links | App store buttons and Facebook / Instagram / YouTube icons |
| Partners | Sponsor logos and links |
| Footer | Link columns, contact details, copyright |
| History & restore | Roll back to any of the last 30 saves, or reset to the original |

**Lists.** Use **+ Add**, **↑ ↓** to reorder, **⧉** to duplicate (handy for a new event or calendar row) and **✕** to delete.

**Images.** Click **Upload** next to any image. Large photos are automatically shrunk in your browser before uploading (max 2400 px; logos 600–800 px), so phone photos are fine. **Library** lets you reuse anything uploaded before. You can also paste the address of an image already online.

**Article text formatting:**
```
Leave a blank line between paragraphs.

## A sub-heading

- a bullet point
- another one

**bold text** and [a link](https://example.com)
```

**Saving.** Click **Save & publish** (or press Ctrl/Cmd + S). The status bar shows when there are unsaved changes, and the browser warns you before you leave with unsaved work.

## 4. Security

- One admin password, kept only in Netlify's environment variables and never in the code or the browser.
- Sessions use a signed, HttpOnly, Secure, SameSite=Strict cookie that expires after 8 hours.
- Login locks for 15 minutes after 8 wrong attempts from the same connection.
- All admin actions are checked on the server. Cross-site requests are blocked.
- Uploads must be real JPG, PNG, WebP or GIF files (checked by content, not file name), up to 4 MB.
- Links starting with `javascript:` are refused. Article text is escaped, so it can't inject code.
- The admin pages are excluded from search engines and can't be embedded in other sites.

## 5. Testing on your own computer (optional)

```bash
npm install
npm install -g netlify-cli
netlify dev          # opens http://localhost:8888 with the admin working
```
For local testing, create a file called `.env` containing `ADMIN_PASSWORD=your-test-password`. The `.env` file is git-ignored.

## 6. Good to know

- **Content not showing your edits?** Hard-refresh the page (Ctrl/Cmd + Shift + R).
- **Image check:** add `?slots` to the site address (e.g. `/?slots`) to see every image area labelled, with a list of any that fail to load.
- **News photos and partner logos.** These currently load from the Wix blog and from kart.co.za. Upload your own copies through the admin when you can, so they can't disappear if those sites change. Check that partners are happy for their logos to appear.
- **Costs.** Each visit makes one small content request, and uploaded images are cached by Netlify's network after the first view. A site of this size should fit within Netlify's free allowance. You can check usage under **Usage & billing** in Netlify.
