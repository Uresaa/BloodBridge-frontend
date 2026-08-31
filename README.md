# BloodBridge frontend

Static web interface for BloodBridge. It lets donors, patients, and hospitals
register, sign in, create blood requests, manage profiles, and respond to
donor offers.

## Requirements

- Node.js 18 or newer (no npm packages are required)
- A running [BloodBridge backend](https://github.com/adnaslani/BloodBridge-backend)
- PostgreSQL, configured through the backend only

The frontend uses only browser APIs and Node's built-in modules. Therefore it
has no `package.json`, `requirements.txt`, or dependency-installation step.

## Run locally

1. Clone both repositories next to each other:

   ```bash
   git clone https://github.com/Uresaa/BloodBridge-frontend.git
   git clone https://github.com/adnaslani/BloodBridge-backend.git
   ```

2. Start the backend first. Follow its README, using these local values in
   `BloodBridge-backend/.env`:

   ```dotenv
   PORT=5000
   FRONTEND_ORIGIN=http://localhost:3000
   ```

3. The application automatically uses `http://localhost:5000/api` when it is
   opened on `localhost`. In deployment, it uses a same-origin `/api` route.
   To target a different API, define `window.BLOODBRIDGE_API_URL` before
   `js/api.js` loads.

4. Start the static development server:

   ```bash
   cd BloodBridge-frontend
   node server.mjs
   ```

5. Open [http://localhost:3000/html/index.html](http://localhost:3000/html/index.html).

## Useful commands

```bash
# Start the frontend server
node server.mjs

# Stop the server
Ctrl + C
```

## Project structure

- `html/` — application pages
- `css/` — styles
- `js/` — browser logic and API client
- `images/` — visual assets
- `server.mjs` — minimal static development server

## Security notes

- Never commit backend `.env` files, database passwords, API keys, or access
  tokens.
- Configure the backend `FRONTEND_ORIGIN` with the exact frontend origin.
- Browser access tokens are stored in local storage and are cleared on logout
  or when the API returns `401 Unauthorized`.
