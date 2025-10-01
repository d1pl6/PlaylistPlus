import keytar from "keytar";

const SERVICE = "PlaylistPlusTS";
const ACCOUNT = "spotify_user";

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// Save token and expiration
export async function saveSpotifyTokens(
  access_token: string,
  refresh_token: string,
  expires_in: number
): Promise<void> {
  const expires_at = Date.now() + expires_in * 1000;
  const data: StoredTokens = { access_token, refresh_token, expires_at };
  await keytar.setPassword(SERVICE, ACCOUNT, JSON.stringify(data));
}

export async function getStoredSpotifyTokens(): Promise<StoredTokens | null> {
  const saved = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!saved) return null;
  return JSON.parse(saved) as StoredTokens;
}

// Get full token data
export async function getSpotifyAccessToken(): Promise<StoredTokens | null> {
  const saved = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!saved) return null;

  try {
    const data = JSON.parse(saved) as StoredTokens;
    return data;
  } catch {
    return null;
  }
}

// Clear tokens on logout
export async function clearSpotifyTokens(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
