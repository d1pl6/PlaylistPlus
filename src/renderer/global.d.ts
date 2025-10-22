declare global {
  interface SpotifyTokens {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  }
  interface LoginStatus {
    spotify: boolean;
  }
  interface SpotifyPlaylistsResponse {
    items: SpotifyPlaylist[];
    total: number;
    limit: number;
    offset: number;
    next: string | null;
    previous: string | null;
  }
  interface SpotifyArtist {
    id: string;
    name: string;
  }
  interface SpotifyAlbum {
    id: string;
    name: string;
    images: { url: string; height: number; width: number }[];
  }
  interface SpotifyApiTrack {
    id: string;
    name: string;
    duration_ms: number;
    artists: SpotifyArtist[];
    album: SpotifyAlbum;
  }
  interface SpotifyTrack {
    id: string;
    name: string;
    duration_ms: number;
    artists: SpotifyArtist[];
    album_image: string;
    exists?: boolean;
  }
  interface SpotifyPlaylistTracksResponse {
    items: { track: SpotifyApiTrack }[];
    next: string | null;
  }
  export type ManifestEntry = {
    playlistId: string;
    name: string;
    keybind?: string | null;
  };
  interface Window {
    api: {
      onLoadPlaylists(callback: () => void): void;
      spotifyLogin(): Promise<{ access_token: string; refresh_token: string } | null>;
      hideToTray(): void;
      refreshSpotifyToken(refresh_token: string): Promise<string | null>;
      spotifyLogout(): Promise<boolean>;
      getSpotifyAccessToken(): Promise<{ access_token: string; refresh_token: string } | null>;
      onLoginStatus(callback: (status: { spotify?: boolean }) => void): void;
      getUserPlaylists(): Promise<SpotifyPlaylist[] | null>;
      getManifest: () => Promise<Record<string, { playlistId: string; name: string, keybind?: string | null }>>;
      selectPlaylist: (playlistId: string) => Promise<boolean>;
      getPlaylists(): Promise<{ id: string; name: string }[]>;
      getTracks(playlistId: string): Promise<{
        id: string;
        name: string;
        duration_ms: number;
        artists: string;
        album_image: string;
        exists?: boolean;
      }[]>;
      deletePlaylist(index: number): Promise<boolean>;
      reloadPlaylist(index: number): Promise<boolean>;
      getDbPath: (index: number) => string;
      setPlaylistKeybind: (playlistId: string, keybind: string | null) => Promise<boolean>;
      onPlaylistUpdated: (callback: (playlistIndex: number) => void) => void;
      onTrackAlreadyExists(callback: (playlistIndex: number, trackName: string) => void): void;
    };
  }
}
export { };
