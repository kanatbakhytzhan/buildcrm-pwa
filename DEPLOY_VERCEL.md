# Deploy BuildCRM PWA on Vercel

This guide covers deploying the BuildCRM frontend (Vite + React PWA) to Vercel. No backend or app logic changes are required.

---

## 1. Prerequisites

- **GitHub**: Push the repo to GitHub so Vercel can import it.
- **Backend**: Ensure the API (e.g. `https://crm-api-5vso.onrender.com`) is running and **CORS allows your Vercel domain** (e.g. `https://your-project.vercel.app`). Otherwise login and API calls will fail.

---

## 2. Import project on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub recommended).
2. Click **Add New** → **Project**.
3. Import your GitHub repository (BuildCRM frontend repo).
4. Configure the project:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install` (default)
5. Do **not** deploy yet if you want to set env vars first (see below).

---

## 3. Environment variables

In the Vercel project: **Settings** → **Environment Variables**. Add:

| Name | Value | Notes |
|------|--------|------|
| `VITE_API_BASE_URL` | `https://crm-api-5vso.onrender.com` | API base URL (required for all requests). |
| `VITE_SUPPORT_WHATSAPP` | `+77768776637` | Optional; used for “Contact us” / support links if you read it from config. |

- Apply to **Production**, **Preview**, and **Development** as needed.
- If you omit these, the app uses the built-in fallbacks (same Render URL and WhatsApp number). Setting them in Vercel is recommended for clarity and future changes.

---

## 4. Deploy

- **First deploy**: Click **Deploy** after saving env vars (or deploy first and add env vars, then redeploy).
- **Later**: Every push to the connected branch triggers a new deployment.

---

## 5. What to test after deploy

1. **Login** – Manager login at `/login`, redirect to `/leads`.
2. **Leads** – Tabs (Новые / Успешные / Отказные), list loads, pull-to-refresh.
3. **Open lead** – Click a lead → `/leads/:id`, details load.
4. **Status update** – “Взять в работу” / “Отказать” → lead moves to the correct tab.
5. **Delete** – Three-dots → Удалить лид → confirm → lead disappears from list.
6. **Admin** – `/admin/login` → `/admin/users` (if you use admin).
7. **Deep links / refresh** – Open or refresh `/leads`, `/profile`, `/leads/123`, `/admin/users` – all should load the app (no 404). Assets (e.g. `/assets/...`) must load; only HTML routes should be rewritten to `index.html`.

---

## 6. Backend CORS

The backend must allow the Vercel origin in CORS, for example:

- `https://your-project.vercel.app`
- `https://your-project-*.vercel.app` (preview deployments)

Otherwise the browser will block API requests (login, leads, etc.). Configure this on the API server (e.g. Render), not in this frontend repo.

---

## 7. Build output (reference)

- **Output directory**: `dist/`
- **Build**: `npm run build` produces `dist/index.html` and `dist/assets/` (JS, CSS, etc.).
- **PWA**: `dist/buildCRM.png` and generated manifest/service worker are included; no localhost URLs are baked into the build when using env vars.
