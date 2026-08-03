# Itinerary

A private travel itinerary: month calendar, one panel per day, tickets and
vouchers attached to the entries they belong to. One shared login — an ID and a
PIN — that everyone on the trip uses.

**The site is already built.** The `docs` folder is the finished website. You do
not need Node, npm, or a terminal. Everything below happens in a browser.

---

## Part 1 — Supabase (your data)

1. supabase.com → **New project**. Region: Mumbai or Singapore.
2. **SQL Editor** → **New query** → paste all of `supabase/schema.sql` → **Run**.
   That creates the tables, the security rules and the private `docs` bucket.
3. **Authentication → Sign In / Providers → Email**
   - Set **Minimum password length** to `8`
   - Turn **off** "Allow new users to sign up"
   - Save
4. **Authentication → Users → Add user → Create new user**
   - Email: `aarusha@trip.local` — any name before the `@`, keep `@trip.local`.
     No mail is ever sent there. Remember the part before the `@`; it goes into
     `config.json` in Part 3.
   - Password: your PIN.
   - Tick **Auto Confirm User**. Skip this and the login will refuse you.
5. **Project Settings → API Keys** → copy the **Project URL** and the
   **anon / public** key. Keep the tab open.

## Part 2 — GitHub (the website)

1. github.com → **New repository**. Name it `itinerary`, set it to **Public**,
   **Create repository**.
2. On the empty repo page click **uploading an existing file**.
3. Unzip this project and drag *everything inside* the folder onto the page —
   the `docs` folder, `src`, `supabase`, `index.html`, all of it. Wait for the
   uploads to finish, then **Commit changes**.
4. **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main`, folder: **/docs** → **Save**
5. Wait a minute, then reload that page. Your link appears at the top:
   `https://<your-username>.github.io/itinerary/`

## Part 3 — Paste your keys in

1. In the repo, open `docs/config.json` and click the pencil icon.
2. Replace the two `PASTE-…` placeholders with the Project URL and anon key.
3. Set `travellerId` to the name you used before the `@` in Part 1, step 4.
4. Change the trip name, dates and code while you're in there.
5. **Commit changes**. GitHub republishes in about a minute.

Open the link. You should see the navy cover screen with a single PIN box.

To change the trip details later, edit `docs/config.json` again. That's the only
file you ever need to touch.

## Part 4 — On your phone

It's a website, so there's nothing to install. Open the same link, log in once,
and it stays logged in. Then **Share → Add to Home Screen** to give it an icon
that opens without the browser bars.

---

## Worth knowing

- **The repo has to be public.** GitHub Pages on a free account only publishes
  from public repositories. That means your Supabase URL and anon key are visible
  to anyone. That's expected — the anon key is a public key, and the security
  rules block everything without a login. But it does mean the PIN is the only
  thing standing between a stranger and your vouchers, so **use 8+ characters,
  not a 4-digit PIN**. Letters are fine; you only type it once per device.
  `travellerId` in `config.json` is public too — treat it as a label, not a secret.
- **Never commit the `service_role` key.** That one bypasses everything.
- **Idle projects pause.** A free Supabase project pauses after a week with no
  requests. Open the app once before you leave, or restore it from the dashboard.
- **Free limits:** 500 MB database, 1 GB files. Boarding passes are a few hundred
  KB, so you won't come close.
- **Offline:** this needs a connection. Keep the critical PDFs in your phone's
  downloads too, for airports with dead Wi-Fi.
- **After the trip:** delete the Supabase project. That removes the documents,
  which carry your names and booking references.

## If you ever want to change the code

You'd need Node installed, then:

```bash
npm install
npm run build     # rewrites the docs folder
```

Commit the changed `docs` folder. Not needed for normal use.

## Files

```
docs/                 the finished website — this is what GitHub serves
docs/config.json      your keys and trip details (the only file you edit)
supabase/schema.sql   tables, security rules, storage bucket
src/                  source code, kept for reference and future edits
```
