import Database from "better-sqlite3";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs";

const playlistsPath = path.join(app.getPath("userData"), "PlaylistsDatabase");
const manifestPath = path.join(playlistsPath, "manifest.json");
const dbPath = path.join(app.getPath("userData"), "playlist.db");
const db = new Database(dbPath);

if (!fs.existsSync(playlistsPath)) {
  fs.mkdirSync(playlistsPath, { recursive: true });
}

// ensure manifest exists
if (!fs.existsSync(manifestPath)) {
  fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
}

export type ManifestEntry = {
  playlistId: string;
  name: string;
  keybind?: string | null;
};

export function loadManifest(): Record<string, ManifestEntry> {
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
}

export function saveManifest(manifest: Record<string, ManifestEntry>) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export function getDbPath(index: number): string {
  return path.join(playlistsPath, `${index}.db`);
}

function createDbSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      name TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      artists TEXT NOT NULL,
      album_image TEXT NOT NULL,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id)
    );
  `);
}

export function openDb(index: number): Database.Database {
  if (openDbs[index]) return openDbs[index];

  const db = new Database(getDbPath(index));
  createDbSchema(db);
  openDbs[index] = db;
  return db;
}

export function savePlaylist(
  playlistId: string,
  name: string,
  tracks: SpotifyTrack[]
) {
  // Load manifest
  const manifest = loadManifest();

  // Check if this playlist already exists
  const existingIndex = Object.keys(manifest).find(
    (key) => manifest[key].playlistId === playlistId
  );

  let index: number;
  if (existingIndex) {
    // Already exists → reuse the same db index
    index = Number(existingIndex);
  } else {
    // Doesn’t exist → find next free index
    const indices = Object.keys(manifest).map((k) => Number(k));
    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;
    index = nextIndex;

    // Save into manifest
    manifest[index] = { playlistId, name };
    saveManifest(manifest);
  }

  // Save into db (reuse or new one)
  const db = openDb(index);

  const insertPlaylist = db.prepare(
    "INSERT OR REPLACE INTO playlists (id, name) VALUES (?, ?)"
  );
  insertPlaylist.run(playlistId, name);

  const insertTrack = db.prepare(`
    INSERT OR REPLACE INTO tracks (id, playlist_id, name, duration_ms, artists, album_image)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((tracks: SpotifyTrack[]) => {
    for (const t of tracks) {
      insertTrack.run(
        t.id,
        playlistId,
        t.name,
        t.duration_ms,
        t.artists.map((a) => a.name).join(", "),
        t.album_image
      );
    }
  });

  insertMany(tracks);

  console.log(`Saved playlist "${name}" with ${tracks.length} tracks as ${index}.db`);
  console.log("savePlaylist done for index:", index);
}

export function getPlaylists(): { id: string; name: string }[] {
  const manifest = loadManifest();
  return Object.values(manifest).map((entry) => ({
    id: entry.playlistId,
    name: entry.name,
  }));
}

function getIndexByPlaylistId(playlistId: string): number | null {
  const manifest = loadManifest();
  const entry = Object.entries(manifest).find(([index, m]) => m.playlistId === playlistId);
  return entry ? Number(entry[0]) : null;
}

export function getTracks(playlistId: string): {
  id: string;
  name: string;
  duration_ms: number;
  artists: string;
  album_image: string;
  exists?: boolean;
}[] {
  const index = getIndexByPlaylistId(playlistId);
  if (index === null) return [];

  const db = openDb(index); // open the correct playlist db

  const stmt = db.prepare(`
    SELECT id, name, duration_ms, artists, album_image
    FROM tracks
    WHERE playlist_id = ?
    ORDER BY rowid ASC
  `);
  return stmt.all(playlistId) as {
    id: string;
    name: string;
    duration_ms: number;
    artists: string;
    album_image: string;
  }[];
}

const openDbs: Record<number, Database.Database> = {};

export function closeDb(index: number) {
  if (openDbs[index]) {
    openDbs[index].close();
    delete openDbs[index];
  }
}

export function deletePlaylistDb(index: number) {
  closeDb(index); // MUST close first
  const path = getDbPath(index);
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}

export function clearPlaylist(index: number) {
  const db = openDb(index);
  const stmt = db.prepare("DELETE FROM tracks WHERE playlist_id = ?");

  // get playlistId from manifest
  const manifest = loadManifest();
  const entry = manifest[index];
  if (!entry) return;

  stmt.run(entry.playlistId);
}
