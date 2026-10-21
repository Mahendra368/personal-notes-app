# 📝 Tagged Notes (Full Stack)

A personal notes app with tags. Create, edit, delete, tag, filter and search notes. The frontend talks to a REST API backed by a real database, so notes are stored on the server and not just in your browser.

**Live demo:** _add your deployed link here_

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | HTML, CSS, vanilla JavaScript (`public/`) |
| Backend  | Node.js built-in `http` server, REST API (`server.js`) |
| Database | SQLite file locally (built-in `node:sqlite`), PostgreSQL when `DATABASE_URL` is set (`db.js`) |

No framework is required to run locally; the only npm dependency is `pg`, used only in Postgres mode.

## Features

- Add, edit, delete notes
- Tag notes (comma separated, e.g. `work, ideas`); tags are normalized to lowercase and de-duplicated
- Tag sidebar with counts, click a tag or a tag chip to filter
- Search by title, body or tag (server-side)
- Input validation and JSON error responses
- Responsive layout

## Project structure

```
├── server.js        # HTTP server + REST API routes + static file serving
├── db.js            # storage layer (SQLite or Postgres)
├── package.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js       # frontend, calls the API with fetch
```

## Run locally

Requires **Node.js 22.5 or newer** (`node --version`).

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm start
```

Open http://localhost:3000. Notes are saved in `notes.db` in the project folder (git-ignored).

Environment variables (all optional):

| Variable       | Purpose | Default |
|----------------|---------|---------|
| `PORT`         | Port to listen on | `3000` |
| `DB_PATH`      | SQLite file path | `notes.db` |
| `DATABASE_URL` | Postgres connection string. If set, Postgres is used instead of SQLite (run `npm install` first) | unset |

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/health` | Health check, shows which database is active |
| GET    | `/api/notes?tag=&q=` | List notes, optionally filtered by tag and/or search text |
| POST   | `/api/notes` | Create a note: `{ "title", "body", "tags": [] }` |
| PUT    | `/api/notes/:id` | Update a note (same body as POST) |
| DELETE | `/api/notes/:id` | Delete a note |
| GET    | `/api/tags` | All tags with counts |

Example:

```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Groceries","body":"milk, eggs","tags":["home"]}'
```

## Deploy for free (Render + Postgres)

Free web hosts have temporary disks, so use a free Postgres database to keep notes permanently.

1. Push this project to a public GitHub repository.
2. Create a free Postgres database (for example at [neon.tech](https://neon.tech) or a free Render PostgreSQL) and copy its connection string.
3. On [render.com](https://render.com): **New → Web Service**, connect your GitHub repo, then set:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
   - **Environment variables:** `DATABASE_URL` = your connection string, and `NODE_VERSION` = `22`
4. Deploy. Your app will be live at `https://<name>.onrender.com`. Open `/api/health` to confirm it reports `"db":"postgres"`.

Note: free Render services sleep after inactivity, so the first request can take around 30 seconds to wake up.

If you skip the database step, the app still works, but SQLite data on a free host can be lost when the service restarts or redeploys.
