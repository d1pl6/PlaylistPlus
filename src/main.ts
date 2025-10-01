import { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, Notification, shell } from "electron";
import * as path from "path";
import { clearSpotifyTokens, getSpotifyAccessToken } from "./main/tokenManager";
import { loginSpotify, refreshSpotifyToken } from "./main/spotifyAuth";
import fetch from "node-fetch";
import {
  savePlaylist, loadManifest, getPlaylists, getTracks, saveManifest,
  deletePlaylistDb, ManifestEntry, getDbPath, closeDb, clearPlaylist,
  openDb
} from "./main/db";
import { getCurrentPlayingTrack } from "./main/spotify"
import * as fs from "fs";

const currentVersion = app.getVersion();

interface GitHubRelease {
  tag_name: string;
  html_url: string;
}

async function checkForUpdates() {
  try {
    const res = await fetch("https://api.github.com/repos/d1pl6/PlaylistPlus/releases/latest");
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

    const release = (await res.json()) as GitHubRelease;

    const latestVersion = release.tag_name.replace(/^v/, "");
    const currentVersion = app.getVersion();

    if (compareVersions(latestVersion, currentVersion) > 0) {
      showUpdateNotification(latestVersion, release.html_url);
    } else {
      console.log("App is up to date");
    }
  } catch (err) {
    console.error("Update check failed:", err);
  }
}

// simple semver compare (ignores prereleases)
function compareVersions(v1: string, v2: string): number {
  const a = v1.split(".").map(Number);
  const b = v2.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function showUpdateNotification(latestVersion: string, url: string) {
  const notif = new Notification({
    title: "Update Available",
    body: `New version ${latestVersion} is available. Click to download.`,
  });

  notif.on("click", () => {
    shell.openExternal(url); // opens GitHub release page
  });

  notif.show();
}



let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let tokenRefreshInterval: NodeJS.Timeout | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      zoomFactor: 1.0,
      minimumFontSize: 12,
    },
    title: "Playlist Plus",
    icon: path.join(__dirname, "assets/icons/app_icon.ico"),
    resizable: false,
    hasShadow: false,
    // fullscreenable: false,
    titleBarOverlay: false,
    zoomToPageWidth: false,
    useContentSize: true,
    center: true,
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, "renderer/index.html"));
}

function sendToMainWindow(channel: string, data: any) {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

// Refresh Spotify token every 5 minutes in background if needed
ipcMain.handle("spotify-refresh-token", async (_, refresh_token: string) => {
  try {
    const newAccessToken = await refreshSpotifyToken(refresh_token);
    return newAccessToken;
  } catch (err) {
    console.error("Failed to refresh Spotify token:", err);
    return null;
  }
});

function startSpotifyTokenRefresher() {
  const intervalMs = 5 * 60 * 1000;
  tokenRefreshInterval = setInterval(async () => {
    try {
      const token = await getSpotifyAccessToken();
      if (!token) return;

      const now = Date.now();
      const expiresAt = token.expires_at; // store this when saving tokens
      if (now > expiresAt - 60_000) { // refresh 1 min before expiry
        await refreshSpotifyToken(token.refresh_token);
        console.log("Spotify token refreshed");
      }
    } catch (err) {
      console.error("Error refreshing Spotify token:", err);
    }
  }, intervalMs);
}

app.whenReady().then(async () => {
  createWindow();

  const spotifyTokens = await getSpotifyAccessToken();
  if (spotifyTokens) {
    startSpotifyTokenRefresher();
    console.log("User is already logged into Spotify");
  }

  // Wait for window to finish loading
  mainWindow?.webContents.once("did-finish-load", () => {
    // Send login status
    sendToMainWindow("login-status", { spotify: !!spotifyTokens });

    // Register keybinds if window exists
    if (mainWindow) {
      const manifest = loadManifest();
      registerAllKeybinds(mainWindow, manifest);
    }

    // Trigger showing playlists
    mainWindow?.webContents.send("load-playlists");
  });
  checkForUpdates();
  setInterval(checkForUpdates, 1000 * 60 * 60 * 24); // every 24h
});

app.on("will-quit", () => {
  tokenRefreshInterval && clearInterval(tokenRefreshInterval);
  tray = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// === BUTTONS + TRAY=== \\
// Get spotify token
ipcMain.handle("get-spotify-tokens", async () => {
  try {
    const tokens = await getSpotifyAccessToken();
    return tokens;
  } catch (err) {
    console.error("Failed to get Spotify tokens:", err);
    return null;
  }
});

// Login method
ipcMain.handle("spotify-login", async (): Promise<{ access_token: string; refresh_token: string } | null> => {
  try {
    return await loginSpotify();
  } catch (err) {
    console.error("Spotify login failed:", err);
    return null;
  }
});

// Hide in tray
function createTray() {
  if (tray) return;

  tray = new Tray(path.join(__dirname, "assets/icons/app_icon.ico"));
  tray.setToolTip("Playlist Plus");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: () => mainWindow?.show(),
    },
    {
      label: "Hide",
      click: () => mainWindow?.hide(),
    },
    { label: "Close", click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => mainWindow?.show());
}

function hideToTray() {
  createTray();
  mainWindow?.hide();
}

ipcMain.on("hide-to-tray", () => {
  hideToTray();
});

// Logout method
ipcMain.handle("spotify-logout", async () => {
  try {
    // 1. Clear Spotify tokens
    await clearSpotifyTokens();

    // 2. Stop token refresher
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }

    // 3. Load manifest
    const manifest = loadManifest();

    // 4. Close and delete all DBs
    for (const indexStr of Object.keys(manifest)) {
      const index = Number(indexStr);
      closeDb(index); // close if open
      const dbPath = getDbPath(index);
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }

    // 5. Clear manifest
    saveManifest({}); // overwrite with empty manifest

    console.log("Logged out, cleared databases and manifest");
    return true;
  } catch (err) {
    console.error("Failed to logout from Spotify:", err);
    return false;
  }
});

// Get user playlists
ipcMain.handle("get-user-playlists", async (): Promise<SpotifyPlaylist[] | null> => {
  try {
    let tokenData = await getSpotifyAccessToken();
    if (!tokenData) return null;

    let res = await fetch("https://api.spotify.com/v1/me/playlists", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    // If token expired, refresh it and retry once
    if (res.status === 401) {
      console.warn("Access token expired, refreshing...");
      const newAccessToken = await refreshSpotifyToken(tokenData.refresh_token);
      if (!newAccessToken) return null;

      // Update tokenData for retry
      tokenData = await getSpotifyAccessToken();
      if (!tokenData) return null;

      res = await fetch("https://api.spotify.com/v1/me/playlists", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
    }

    if (!res.ok) {
      console.error("Failed to fetch playlists:", await res.text());
      return null;
    }

    const data = (await res.json()) as SpotifyPlaylistsResponse;
    return data.items;
  } catch (err) {
    console.error("Failed to fetch playlists:", err);
    return null;
  }
});

ipcMain.handle("get-manifest", async () => {
  return loadManifest();
});

ipcMain.handle("select-playlist", async (_, playlistId: string) => {
  try {
    // fetch Spotify access token first
    const tokenData = await getSpotifyAccessToken();
    if (!tokenData) return false;

    let tracks: SpotifyTrack[] = [];
    let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!res.ok) {
        console.error("Failed to fetch tracks:", await res.text());
        return false;
      }

      const data = (await res.json()) as SpotifyPlaylistTracksResponse;

      const normalized = data.items.map((i) => {
        const t = i.track;
        return {
          id: t.id,
          name: t.name,
          duration_ms: t.duration_ms,
          artists: t.artists,
          album_image: t.album?.images?.[0]?.url || "assets/icons/default_track.png",
        } as SpotifyTrack;
      });

      tracks.push(...normalized);
      url = data.next;
    }

    // **Here tokenData is in scope**
    const resPl = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!resPl.ok) {
      console.error("Failed to fetch playlist info:", await resPl.text());
      return false;
    }

    const playlist = (await resPl.json()) as { name: string };

    // save to DB...
    savePlaylist(playlistId, playlist.name, tracks);
    console.log("tracks.length:", tracks.length, "playlist.name:", playlist.name);
    return true;
  } catch (err) {
    console.error("Error selecting playlist:", err);
    return false;
  }
});

ipcMain.handle("get-playlists", async () => {
  try {
    return getPlaylists(); // returns array of {id, name}
  } catch (err) {
    console.error("Failed to get playlists:", err);
    return [];
  }
});

ipcMain.handle("get-tracks", async (_, playlistId: string) => {
  try {
    return getTracks(playlistId);
  } catch (err) {
    console.error("Failed to get tracks:", err);
    return [];
  }
});

ipcMain.handle("delete-playlist", async (_, index: number) => {
  try {
    const manifest = loadManifest();
    if (!manifest[index]) return false;

    // 1. Delete DB file
    deletePlaylistDb(index);

    // 2. Remove from manifest
    delete manifest[index];

    // 3. Normalize indices
    const sortedIndices = Object.keys(manifest)
      .map(Number)
      .sort((a, b) => a - b); // ascending

    const newManifest: Record<number, ManifestEntry> = {};
    let newIndex = 1;

    for (const oldIndex of sortedIndices) {
      const entry = manifest[oldIndex];
      newManifest[newIndex] = entry;

      // Only rename DB if index changed
      if (oldIndex !== newIndex) {
        closeDb(oldIndex);
        const oldPath = getDbPath(oldIndex);
        const newPath = getDbPath(newIndex);
        if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
      }

      newIndex++;
    }

    // 4. Save normalized manifest
    saveManifest(newManifest);
    await showPlaylists();
    return true;
  } catch (err) {
    console.error("Failed to delete playlist:", err);
    return false;
  }
});

ipcMain.handle("reload-playlist", async (_, index: number) => {
  try {
    const manifest = loadManifest();
    const entry = manifest[index];
    if (!entry) return false;

    const playlistId = entry.playlistId;

    const tokenData = await getSpotifyAccessToken();
    if (!tokenData) return false;

    let tracks: SpotifyTrack[] = [];
    let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!res.ok) {
        console.error("Failed to fetch tracks:", await res.text());
        return false;
      }
      const data = (await res.json()) as SpotifyPlaylistTracksResponse;
      tracks.push(
        ...data.items.map((i) => ({
          id: i.track.id,
          name: i.track.name,
          duration_ms: i.track.duration_ms,
          artists: i.track.artists,
          album_image: i.track.album?.images?.[0]?.url || "assets/icons/default_track.png",
        }))
      );
      url = data.next;
    }

    // Clear old tracks from DB
    clearPlaylist(index);

    // Save new tracks
    const db = openDb(index);
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

    console.log(`Reloaded playlist "${entry.name}" with ${tracks.length} tracks`);
    return true;
  } catch (err) {
    console.error("Failed to reload playlist:", err);
    return false;
  }
});

ipcMain.handle("set-playlist-keybind", async (_, playlistId: string, keybind: string | null) => {
  const manifest = loadManifest();
  const entry = Object.values(manifest).find(e => e.playlistId === playlistId);
  if (!entry) return false;

  entry.keybind = keybind;
  saveManifest(manifest);

  if (mainWindow) {
    registerAllKeybinds(mainWindow, manifest);
  }

  return true;
});

export function registerAllKeybinds(win: BrowserWindow, manifest: Record<string, any>) {
  // Clear all previous keybinds first
  globalShortcut.unregisterAll();

  for (const [indexStr, entry] of Object.entries(manifest)) {
    if (!entry.keybind) continue;

    globalShortcut.register(entry.keybind, async () => {
      try {
        const tokens = await getSpotifyAccessToken();
        if (!tokens?.access_token) return;
        console.log(`Pressed ${entry.keybind} for playlist "${entry.name}"`);

        const track = await getCurrentPlayingTrack();
        if (!track?.id) {
          console.warn("No track currently playing");
          return;
        }

        const playlistIndex = Number(indexStr);
        const playlistId = entry.playlistId;

        // Check if track exists in DB
        const dbTracks = await getTracks(playlistId);
        const exists = dbTracks.some(t =>
          t.name === track.name &&
          t.artists === track.artists.map(a => a.name).join(", ") &&
          t.duration_ms === track.duration_ms
        );
        if (exists) {
          win.webContents.send("track-already-exists", Number(indexStr), track.name);

          return;
        }

        // Add track to Spotify
        const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${tokens.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ uris: [`spotify:track:${track.id}`] })
        });


        if (!res.ok) {
          console.error("Spotify add failed:", await res.text());
          return;
        }

        // Save track to local DB
        const db = openDb(playlistIndex);
        const insertTrack = db.prepare(`
          INSERT INTO tracks (id, playlist_id, name, duration_ms, artists, album_image)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertTrack.run(
          track.id,
          playlistId,
          track.name,
          track.duration_ms,
          track.artists.map(a => a.name).join(", "),
          track.album_image
        );

        console.log(`Added "${track.name}" to playlist "${entry.name}" (Spotify + DB)`);

        // Notify renderer to update UI
        win.webContents.send("playlist-updated", playlistIndex);
      } catch (err) {
        console.error("Failed to handle keybind:", err);
      }
    });
  }
}
