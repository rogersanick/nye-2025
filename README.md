# Virtual New Year’s 2025

A tiny virtual New Year’s celebration site where guests submit their **2025 goals**, and Greg (Nick’s dad, in Denver) posts a video + written update and reads goals aloud with commentary.

This project uses **React + Vite + Tailwind + r3f/drei** and **Supabase** for storage + database.

## Setup

1. Install deps:

```bash
npm install
```

2. Create a `.env` file with:

```bash
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_publishable_key  # (sb_publishable_...)

# Optional: enables password gate for #/greg (client-side only)
VITE_GREG_PAGE_PASSWORD=some_password
```

3. Supabase schema (SQL):

- Run [`supabase/migrations/20251231000100_init.sql`](supabase/migrations/20251231000100_init.sql) in the Supabase SQL editor.
- Then run [`supabase/migrations/20251231000200_storage_greg_videos.sql`](supabase/migrations/20251231000200_storage_greg_videos.sql).

Tables created:

- `public.goals_2025` (stores goal title + full text)
- `public.greg_updates` (stores Greg’s message + Storage video path)

Important note: this project intentionally uses **no RLS**. We hide full goal text in the public UI by only selecting `id, display_name, title, created_at` on the guest pages.

4. Storage bucket

- Create a Storage bucket named **`greg-videos`**
- Set it to **Public** so the site can play Greg’s video via a public URL.

5. Start dev server:

```bash
npm run dev
```

## How to use

- **Guests**: open the site, submit a goal, and see the goal title on the wall.\n- **Greg**: visit `#/greg`, enter the password (`VITE_GREG_PAGE_PASSWORD`), then:\n - see all goals including full text\n - upload a video + publish an update (writes to `greg_updates` and uploads into `greg-videos`)
