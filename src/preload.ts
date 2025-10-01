import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  onLoadPlaylists: (callback: () => void) => {
    ipcRenderer.on("load-playlists", () => callback());
  },
  spotifyLogin: () => ipcRenderer.invoke("spotify-login"),
  hideToTray: () => ipcRenderer.send("hide-to-tray"),
  refreshSpotifyToken: (refresh_token: string) => ipcRenderer.invoke("spotify-refresh-token", refresh_token),
  spotifyLogout: () => ipcRenderer.invoke("spotify-logout"),
  getSpotifyAccessToken: () => ipcRenderer.invoke("get-spotify-tokens"),
  onLoginStatus: (callback: (status: any) => void) =>
    ipcRenderer.on("login-status", (_, status) => callback(status)),
  getUserPlaylists: () => ipcRenderer.invoke("get-user-playlists"),
  getManifest: () => ipcRenderer.invoke("get-manifest"),
  selectPlaylist: (playlistId: string) => ipcRenderer.invoke("select-playlist", playlistId),
  getPlaylists: () => ipcRenderer.invoke("get-playlists"),
  getTracks: (playlistId: string) => ipcRenderer.invoke("get-tracks", playlistId),
  deletePlaylist: (index: number) =>
    ipcRenderer.invoke("delete-playlist", index),
  reloadPlaylist: (index: number) => ipcRenderer.invoke("reload-playlist", index),
  setPlaylistKeybind: (playlistId: string, keybind: string | null) =>
    ipcRenderer.invoke("set-playlist-keybind", playlistId, keybind),
  getTrackInfo: (trackId: string) => ipcRenderer.invoke("get-track-info", trackId),
  getCurrentlyPlaying: () => ipcRenderer.invoke("get-currently-playing"),
  saveKeybind: (index: number, keybind: string) => ipcRenderer.invoke("save-keybind", index, keybind),
  onPlaylistUpdated: (callback: (playlistIndex: number) => void) => {
    ipcRenderer.on("playlist-updated", (_, playlistIndex: number) => {
      callback(playlistIndex);
    });
  },
  onTrackAlreadyExists: (callback: (playlistIndex: number, trackName: string) => void) =>
    ipcRenderer.on("track-already-exists", (_, playlistIndex, trackName) => callback(playlistIndex, trackName)),
});
