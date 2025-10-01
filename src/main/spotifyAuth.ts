import express from "express";
import * as dns from "dns";
import fetch from "node-fetch";
import open from "open";
import crypto from "crypto";
import { saveSpotifyTokens } from "./tokenManager";

const clientId = "e4856d1ad96c451688a72fcdb370ef38";
const redirectUri = "http://127.0.0.1:8888/callback";

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

function hasInternetConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    dns.lookup("google.com", (err) => {
      resolve(!err);
    });
  });
}

// PKCE helpers
function base64URLEncode(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64URLEncode(
    crypto.createHash("sha256").update(verifier).digest()
  );
}

export async function loginSpotify(): Promise<{ access_token: string; refresh_token: string }> {
  const online = await hasInternetConnection();
  if (!online) {
    throw new Error("No internet connection, cannot start Spotify server.");
  }

  const app = express();

  // Scopes
  const scopes = [
    "user-read-private",
    "playlist-read-private",
    "playlist-modify-private",
    "playlist-modify-public",
    "user-read-playback-state",
    "user-read-currently-playing",
  ].join(" ");

  // Create verifier + challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Build auth URL with PKCE params
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `response_type=code&client_id=${clientId}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code_challenge_method=S256&code_challenge=${codeChallenge}`;

  // Open browser
  open(authUrl);

  return new Promise((resolve, reject) => {
    const server = app.listen(8888, () => console.log("Spotify auth server is running"));

    // Auto-stop after 5 minutes
    const timeout = setTimeout(() => {
      server.close(() => console.log("Spotify auth server closed after 5 minutes (no login)."));
      reject("Timeout");
    }, 5 * 60 * 1000);

    app.get("/callback", async (req, res) => {
      clearTimeout(timeout); // stop timer

      const code = req.query.code as string;
      if (!code) {
        res.send("No code provided");
        reject("No code");
        server.close();
        return;
      }

      try {
        // Exchange code for token
        const response = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: codeVerifier,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Token exchange failed: ${errText}`);
        }

        const data = (await response.json()) as SpotifyTokenResponse;

        // Save securely
        await saveSpotifyTokens(data.access_token, data.refresh_token, data.expires_in);

        res.send(`
          <html>
            <body style="font-family:sans-serif;text-align:center;padding:40px;">
              <h2>✅ Login successful</h2>
              <p>You can close this tab and return to PlaylistPlus.</p>
            </body>
          </html>
        `);

        server.close(() => console.log("Server closed after finishing auth"));

        resolve({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      } catch (err) {
        console.error("Spotify auth error:", err);
        res.send("Error fetching token");
        reject(err);
        server.close();
      }
    });
  });
}

// Refresh flow
export async function refreshSpotifyToken(refresh_token: string) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
      client_id: clientId,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Refresh failed: ${errText}`);
  }

  const data = (await response.json()) as SpotifyTokenResponse;

  // If no new refresh_token, reuse the old one
  const newRefreshToken = data.refresh_token || refresh_token;

  await saveSpotifyTokens(
    data.access_token,
    newRefreshToken,
    data.expires_in
  );

  return data.access_token;
}
