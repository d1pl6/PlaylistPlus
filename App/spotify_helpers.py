import os
import json
import logging
from pathlib import Path
import threading
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
load_dotenv() 

# === Constants and Paths ===
APP_NAME = "PlaylistPlus"
APPDATA = Path(os.getenv('APPDATA')) / APP_NAME
CACHE_PATH = APPDATA / 'cache.json'
CONFIG_PATH = APPDATA / 'config.json'
TOKEN_CACHE_PATH = APPDATA / '.spotify_token_cache'

# === Spotify Auth ===
CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = 'http://127.0.0.1:8888/callback'
SCOPE = 'user-read-playback-state playlist-modify-public playlist-read-private'

if not CLIENT_ID or not CLIENT_SECRET:
    raise ValueError("Spotify credentials not found in .env file")

auth_manager = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=SCOPE,
    cache_path=str(TOKEN_CACHE_PATH)
)

sp = spotipy.Spotify(auth_manager=auth_manager)

playlist_cache = set()
playlist_cache_lock = threading.Lock()

def save_cache(track_ids):
    try:
        with open(CACHE_PATH, 'w') as f:
            json.dump(list(track_ids), f)
        print("Cache saved")
    except Exception as e:
        logging.error(f"Failed to save cache: {e}")
