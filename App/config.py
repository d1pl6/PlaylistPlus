import json
import logging
from pathlib import Path
import os
from spotipy.oauth2 import SpotifyOAuth
import urllib.request
from dotenv import load_dotenv
load_dotenv()

APP_NAME = "PlaylistPlus"
APPDATA = Path(os.getenv('APPDATA')) / APP_NAME
CONFIG_PATH = APPDATA / 'config.json'
TOKEN_CACHE_PATH = APPDATA / '.spotify_token_cache'

APPDATA.mkdir(parents=True, exist_ok=True)

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = 'http://127.0.0.1:8888/callback'
SCOPE = 'user-read-playback-state playlist-modify-public playlist-read-private'
ICON_PATH = APPDATA / 'icon.ico'
ICON_URL = 'https://raw.githubusercontent.com/d1pl6/PlaylistPlus/heads/main/App/resources/icon.ico'

def load_config():
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, dict):
                return data
            else:
                logging.warning("Config file is not a dict")
        except json.JSONDecodeError:
            logging.warning("Config file is corrupted")
    return {}

def save_config(data):
    try:
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logging.error(f"save_config() failed: {e}", exc_info=True)

def get_auth_manager():
    return SpotifyOAuth(
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        redirect_uri=REDIRECT_URI,
        scope=SCOPE,
        cache_path=str(TOKEN_CACHE_PATH)
    )
def ensure_icon():
    if not ICON_PATH.exists():
        try:
            urllib.request.urlretrieve(ICON_URL, ICON_PATH)
        except Exception as e:
            logging.debug(f"Error downloading icon: {e}")
ensure_icon()