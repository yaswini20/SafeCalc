# TravelSafetySOS Backend

## Environment
Copy `.env.example` to `.env` and fill in the MongoDB Atlas URI and a new JWT secret.

`AUTO_SOS_ON_TIMEOUT=false` keeps SOS manual-only. Set it to `true` only if you want an unattended journey timeout to escalate to SOS.

## Run locally

```bash
npm install
npm run dev
```

API: `http://localhost:5000`

## Important
The MongoDB Atlas database does not run the API. The frontend needs either this backend running locally or the deployed backend URL in `frontend/.env`.
