# Clinic System — Frontend (React + Vite)

React port of the clinic-system UI. Same API contracts as the original
vanilla frontend (`/api/v1/...`), same role panels (admin, doctor,
receptionist, owner, patient).

## Dev

```sh
npm install
npm run dev      # http://localhost:5173, /api proxied to http://localhost:5001
```

Run the backend separately from `clinic-backend/` (`npm start`).

## Production

```sh
npm run build    # emits frontend/dist/
```

The Express backend serves `frontend/dist/` (with an SPA fallback) when
present, so no extra deploy step is needed beyond building.
