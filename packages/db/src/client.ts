import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');

let db: Database.Database;
let dbDir = join(PROJECT_ROOT, 'cve-cache', 'db');

export const setDbDir = (dir: string) => { dbDir = dir; };

export const DB_PATH = () => join(dbDir, 'cve.db');

export const getDb = (): Database.Database => {
  if (!db) {
    mkdirSync(dbDir, { recursive: true });
    db = new Database(DB_PATH());
    db.pragma('journal_mode = WAL');
    db.pragma('cache_size = -64000');
    initSchema(db);
  }
  return db;
};

export const closeDb = (): void => { if (db) { db.close(); db = undefined as unknown as Database.Database; } };

const initSchema = (d: Database.Database) => {
  d.exec(`
    CREATE TABLE IF NOT EXISTS cves (
      cve_id TEXT PRIMARY KEY,
      description TEXT NOT NULL DEFAULT '',
      cwe_id TEXT,
      vendor TEXT,
      product TEXT,
      affected_versions TEXT,
      cvss_score REAL,
      cvss_severity TEXT,
      published_date TEXT,
      updated_date TEXT,
      json_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS cve_fts USING fts5(
      cve_id UNINDEXED, description, vendor, product, cwe_id,
      content='cves', content_rowid='rowid'
    );

    CREATE TABLE IF NOT EXISTS references_ (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cve_id TEXT NOT NULL REFERENCES cves(cve_id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      source TEXT,
      tags TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_refs_cve ON references_(cve_id);

    CREATE TABLE IF NOT EXISTS embeddings (
      cve_id TEXT PRIMARY KEY REFERENCES cves(cve_id) ON DELETE CASCADE,
      vector BLOB,
      model TEXT DEFAULT 'qwen3-embedding:0.6b',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hashes (
      cve_id TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS cve_ai AFTER INSERT ON cves BEGIN
      INSERT INTO cve_fts(rowid, cve_id, description, vendor, product, cwe_id)
      VALUES (new.rowid, new.cve_id, new.description, new.vendor, new.product, new.cwe_id);
    END;

    CREATE TRIGGER IF NOT EXISTS cve_ad AFTER DELETE ON cves BEGIN
      INSERT INTO cve_fts(cve_fts, rowid, cve_id, description, vendor, product, cwe_id)
      VALUES ('delete', old.rowid, old.cve_id, old.description, old.vendor, old.product, old.cwe_id);
    END;

    CREATE TRIGGER IF NOT EXISTS cve_au AFTER UPDATE ON cves BEGIN
      INSERT INTO cve_fts(cve_fts, rowid, cve_id, description, vendor, product, cwe_id)
      VALUES ('delete', old.rowid, old.cve_id, old.description, old.vendor, old.product, old.cwe_id);
      INSERT INTO cve_fts(rowid, cve_id, description, vendor, product, cwe_id)
      VALUES (new.rowid, new.cve_id, new.description, new.vendor, new.product, new.cwe_id);
    END;
  `);
};
