# Aware Life

*Live aware.* A personal life space: projects, reminders, to-dos and day summaries, with a walk-in VR room (the Time Chamber).

Live at **https://aguayoa.github.io/**

## How data is stored

- **Signed in:** everything is saved in Supabase (Postgres) with row-level security. Each account can only read and write its own rows. See [`supabase/schema.sql`](supabase/schema.sql).
- **Not signed in:** visitors get a sandbox with a sample project, reminders and to-dos. Their changes stay in their own browser.
- Signing in is by emailed link (no password). Every sign-in creates or uses that person's own private space, and admins can see the visitor list on the homepage.

## Setup (one time)

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql`.
3. In **Authentication → URL Configuration**, set Site URL to `https://aguayoa.github.io` and add `https://aguayoa.github.io/**` to Redirect URLs.
4. Copy **Project URL** and the **anon public** key from **Project Settings → API** into `assets/config.js`.
5. Sign in on the site once, then make yourself admin in SQL Editor:
   `insert into admins (user_id) select id from auth.users where email = 'YOUR EMAIL';`

## Pages

| Page | URL | Files |
|---|---|---|
| Homepage: projects (zoom in to edit), visitors (admin) | `/` | `index.html`, `assets/home.js`, `assets/home.css` |
| The Time Chamber: calendar, reminders, to-do, projects tool bag | `/calendar/` | `calendar/` |

Shared: `assets/config.js` (settings), `assets/store.js` (data layer), `assets/account.js` (sign-in), `assets/sample.js` (visitor sample content).

## The Time Chamber

- **Click the calendar** for its toolbar: **Year**, **Month list**, **Reminders**, **To-do**, **Bring to front**, **−** / **+**, **Reset**, and a corner handle to drag-resize.
- **Click a day** to open its summary full screen. **Enter** saves, **Shift + Enter** adds a new line. You can add reminders for that day there too.
- **Reminder dots** show on days with reminders. Click the dots for an iMessage-style bubble.
- **Home** view brings your projects flying out of the 1960s tool bag.
- VR: open the page in your headset browser and press **VR**. Typing isn't possible in VR, so add things from a phone or computer and they sync.
