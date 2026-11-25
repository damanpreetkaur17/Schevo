# Schevo unified backend

The unified Express API runs on `PORT` (default `4000`) and serves both API
contracts:

- `/api/v1` provides session-based authentication, workspaces, projects, and
  activity.
- `/api/auth` preserves the legacy JWT authentication endpoints.

## Configure and run

Install dependencies from this directory:

```sh
npm install
```

Configure `backend/.env` with:

- `DATABASE_URL`: PostgreSQL connection string for the existing Schevo
  database. Existing credentials and data should be retained.
- `PORT`: optional; defaults to `4000`.
- `CLIENT_ORIGIN` and/or `FRONTEND_URL`: allowed frontend origins.
- `JWT_SECRET`: long random secret required by the legacy JWT routes.
- `JWT_EXPIRES_IN`: optional JWT lifetime (default `1d`).
- `BCRYPT_SALT_ROUNDS`: retained for environment compatibility; new passwords
  use Argon2id, while existing bcrypt hashes are upgraded at login.
- `NODE_ENV`: set to `production` for secure cookies and production behavior.

Keep `.env` local and do not commit it. The Vite proxy uses the origin in
`frontend/.env`'s `VITE_API_URL`; if unset, it targets `http://localhost:4000`.
For a deployed frontend, set its `VITE_API_URL` build environment variable to
the backend origin (for example, `https://schevo.onrender.com`) so API requests
go to the backend rather than the frontend host.

For an existing database, run:

```sh
npm run migrate
npm run dev
```

The server also runs pending migrations on startup. Migrations add the platform
tables and reconcile legacy `name` with platform `display_name`; they do not
drop tables or delete existing users. `npm run init-db` remains available for
initializing the legacy users table before applying migrations on a new
database.

## Tests

```sh
npm test
```

The test runner creates and uses a separate `schevo_test` database based on
`DATABASE_URL`. The database account must be allowed to connect to the
PostgreSQL `postgres` database and create that isolated test database. Tests
never run against the configured development database.
