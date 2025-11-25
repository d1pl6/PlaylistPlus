import fetch from "node-fetch";
import { getSpotifyAccessToken } from "./tokenManager";
import { refreshSpotifyToken } from "./spotifyAuth";


export async function getCurrentPlayingTrack(): Promise<SpotifyTrack | null> {
  try {
    let tokenData = await getSpotifyAccessToken();
    if (!tokenData) return null;

    let res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (res.status === 204) {
      // Nothing is playing
      return null;
    }
    // If token expired, refresh it and retry once
    if (res.status === 401) {
      console.warn("Access token expired, refreshing...");
      const newAccessToken = await refreshSpotifyToken(tokenData.refresh_token);
      if (!newAccessToken) return null;

      // Update tokenData for retry
      tokenData = await getSpotifyAccessToken();
      if (!tokenData) return null;

      // Retry the same endpoint we originally called
      res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
    }
    if (!res.ok) {
      console.error("Failed to fetch currently playing track:", await res.text());
      return null;
    }

    const data = await res.json() as any;
    const t = data.item;
    if (!t) return null;

    return {
      id: t.id,
      name: t.name,
      duration_ms: t.duration_ms,
      artists: t.artists,
      album_image: t.album?.images?.[0]?.url || "assets/icons/default_track.png",
    } as SpotifyTrack;
  } catch (err) {
    console.error("Error fetching currently playing track:", err);
    return null;
  }
}