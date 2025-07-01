
import os
import json
import logging
import urllib.request
from pathlib import Path
import threading
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from PyQt5.QtCore import QThread, pyqtSignal
from config import get_auth_manager
from helpers import extract_playlist_id
from dotenv import load_dotenv
# For Windows notifications
try:
    from win10toast import ToastNotifier
    toaster = ToastNotifier()
except ImportError:
    toaster = None

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

class PlaylistLoader(QThread):
    finished = pyqtSignal(dict, bytes)

    def __init__(self, playlist_url):
        super().__init__()
        self.playlist_url = playlist_url
        self.auth_manager = get_auth_manager()

    def run(self):
        try:
            playlist_id = extract_playlist_id(self.playlist_url)
            sp = spotipy.Spotify(auth_manager=self.auth_manager)
            data = sp.playlist(playlist_id)

            image_data = None
            images = data.get("images")
            if images:
                try:
                    url = images[0]["url"]
                    image_data = urllib.request.urlopen(url, timeout=5).read()
                except Exception:
                    image_data = None

            self.finished.emit(data, image_data)
        except Exception as e:
            print(f"[PlaylistLoader Error] {e}")
            self.finished.emit({}, b"")

def load_config():
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            logging.warning("Config file is corrupted")
    return {}

def save_config(data):
    try:
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logging.error(f"Failed to save config: {e}", exc_info=True)

def load_cache():
    if CACHE_PATH.exists():
        try:
            with open(CACHE_PATH, 'r') as f:
                return set(json.load(f))
        except json.JSONDecodeError:
            pass
    return set()

def save_cache(track_ids):
    try:
        with open(CACHE_PATH, 'w') as f:
            json.dump(list(track_ids), f)
    except Exception as e:
        logging.error(f"Failed to save cache: {e}")

def build_initial_cache(playlist_id):
    track_ids = set()
    try:
        results = sp.playlist_items(playlist_id, fields='items.track.id,next', additional_types=['track'])
        while results:
            for item in results['items']:
                if item['track'] and item['track']['id']:
                    track_ids.add(item['track']['id'])
            if results['next']:
                results = sp.next(results)
            else:
                break
    except Exception as e:
        logging.error(f"Error building initial cache: {e}")
    save_cache(track_ids)
    return track_ids

def get_current_track():
    try:
        playback = sp.current_playback()
        if playback and playback.get('is_playing'):
            return playback['item']
    except Exception as e:
        logging.error(f"Failed to get current track: {e}")
    return None

def add_track_to_playlist(playlist_id, track_id):
    try:
        sp.playlist_add_items(playlist_id, [track_id])
    except Exception as e:
        logging.error(f"Failed to add track to playlist: {e}")

def get_album_art(track):
    try:
        images = track.get('album', {}).get('images', [])
        if images:
            url = images[0]['url']
            return urllib.request.urlopen(url, timeout=5).read()
    except Exception as e:
        logging.warning(f"Failed to load album art: {e}")
    return None

playlist_cache = set()
playlist_cache_lock = threading.Lock()
def update_cache_in_thread(playlist_id):
    global playlist_cache
    logging.info(f"update_cache_in_thread called with: {playlist_id}")
    try:
        logging.info(f"Starting cache update for playlist: {playlist_id}")
        print(f"Updating cache for playlist_id: {playlist_id}")
        track_ids = build_initial_cache(playlist_id)
        with playlist_cache_lock:
            playlist_cache = track_ids
        logging.info(f"Cache updated: {len(track_ids)} tracks")
        if toaster:
            try:
                toaster.show_toast(
                    "PlaylistPlus",
                    f"Playlist cache updated: {len(track_ids)} tracks",
                    threaded=True
                )
            except Exception as notify_err:
                logging.warning(f"Failed to show Windows notification: {notify_err}")
            return 0
    except Exception as e:
        logging.critical(f"update_cache_in_thread failed: {e}", exc_info=True)