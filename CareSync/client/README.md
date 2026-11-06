# CareSync client

React + Vite frontend for the CareSync Smart Healthcare Coordination Platform.

## Run locally

From the project root, install frontend dependencies and start the frontend:

```powershell
npm install --prefix client
npm run dev --prefix client
```

The Vite development server runs on `http://localhost:5173` by default.

Configure `VITE_API_BASE_URL` in a local `client/.env.local` file if the backend API
is not available at `http://localhost:5000/api/v1`. See `.env.example` for the
placeholder format.

The backend runs separately with `npm run dev --prefix server`; configure
`server/.env` from the backend's `.env.example` before starting it.

## Checks

```powershell
npm run lint --prefix client
npm run build --prefix client
```
