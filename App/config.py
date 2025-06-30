import json
import logging
from pathlib import Path
import os
from spotipy.oauth2 import SpotifyOAuth
import urllib.request

APP_NAME = "PlaylistPlus"
APPDATA = Path(os.getenv('APPDATA')) / APP_NAME
CONFIG_PATH = APPDATA / 'config.json'
TOKEN_CACHE_PATH = APPDATA / '.spotify_token_cache'

APPDATA.mkdir(parents=True, exist_ok=True)

CLIENT_ID = 'd706eaaa15ce48dabb9cc33ff2e2a9e4'
CLIENT_SECRET = '839c34d9e4a647e7a5437cc38e0bf5ac'
REDIRECT_URI = 'http://127.0.0.1:8888/callback'
SCOPE = 'user-read-playback-state playlist-modify-public playlist-read-private'
ICON_PATH = APPDATA / 'icon.ico'
ICON_URL = 'https://raw.githubusercontent.com/d1pl6/PlaylistPlus/main/icon.ico'

def load_config():
    logging.debug("load_config() called")
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
    logging.debug(f"save_config() called with data: {data}")
    try:
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logging.info("Config saved successfully")
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
            logging.debug("Icon successfully downloaded")
        except Exception as e:
            logging.debug(f"Error downloading icon: {e}")
ensure_icon()