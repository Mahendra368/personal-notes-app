"use strict";
/**
 * Storage layer. Two interchangeable backends with the same async interface:
 *  - Postgres, when DATABASE_URL is set (needs `npm install`, uses the `pg` package)
 *  - SQLite file (Node's built-in node:sqlite), the default for local use
 */

function normalize(row) {
  return {
    id: Number(row.id),
    title: row.title,
    body: row.body,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags,
    created: Number(row.created),
    updated: Number(row.updated),
  };
}

function matches(note, tag, q) {
  if (tag && !note.tags.includes(tag)) return false;
  if (q) {
    const s = q.toLowerCase();
    const hit =
      note.title.toLowerCase().includes(s) ||
      note.body.toLowerCase().includes(s) ||
      note.tags.some((t) => t.includes(s));
    if (!hit) return false;
  }
  return true;
}

function sqliteStore(file) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  )`);

  const all = () => db.prepare("SELECT * FROM notes ORDER BY updated DESC").all().map(normalize);

  return {
    kind: "sqlite",
    async list({ tag, q } = {}) {
      return all().filter((n) => matches(n, tag, q));
    },
    async tags() {
      const counts = {};
      all().forEach((n) => n.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async create({ title, body, tags }) {
      const now = Date.now();
      const r = db
        .prepare("INSERT INTO notes (title, body, tags, created, updated) VALUES (?, ?, ?, ?, ?)")
        .run(title, body, JSON.stringify(tags), now, now);
      return normalize(db.prepare("SELECT * FROM notes WHERE id = ?").get(r.lastInsertRowid));
    },
    async update(id, { title, body, tags }) {
      const r = db
        .prepare("UPDATE notes SET title = ?, body = ?, tags = ?, updated = ? WHERE id = ?")
        .run(title, body, JSON.stringify(tags), Date.now(), id);
      if (!r.changes) return null;
      return normalize(db.prepare("SELECT * FROM notes WHERE id = ?").get(id));
    },
    async remove(id) {
      return db.prepare("DELETE FROM notes WHERE id = ?").run(id).changes > 0;
    },
  };
}

async function postgresStore(url) {
  const { Pool } = require("pg");
  const needsSsl = !/localhost|127\.0\.0\.1/.test(url);
  const pool = new Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]',
    created BIGINT NOT NULL,
    updated BIGINT NOT NULL
  )`);

  return {
    kind: "postgres",
    async list({ tag, q } = {}) {
      const { rows } = await pool.query("SELECT * FROM notes ORDER BY updated DESC");
      return rows.map(normalize).filter((n) => matches(n, tag, q));
    },
    async tags() {
      const { rows } = await pool.query("SELECT * FROM notes");
      const counts = {};
      rows.map(normalize).forEach((n) => n.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async create({ title, body, tags }) {
      const now = Date.now();
      const { rows } = await pool.query(
        "INSERT INTO notes (title, body, tags, created, updated) VALUES ($1,$2,$3,$4,$4) RETURNING *",
        [title, body, JSON.stringify(tags), now]
      );
      return normalize(rows[0]);
    },
    async update(id, { title, body, tags }) {
      const { rows } = await pool.query(
        "UPDATE notes SET title=$1, body=$2, tags=$3, updated=$4 WHERE id=$5 RETURNING *",
        [title, body, JSON.stringify(tags), Date.now(), id]
      );
      return rows[0] ? normalize(rows[0]) : null;
    },
    async remove(id) {
      const r = await pool.query("DELETE FROM notes WHERE id = $1", [id]);
      return r.rowCount > 0;
    },
  };
}

async function createStore() {
  if (process.env.DATABASE_URL) return postgresStore(process.env.DATABASE_URL);
  return sqliteStore(process.env.DB_PATH || "notes.db");
}

module.exports = { createStore };
