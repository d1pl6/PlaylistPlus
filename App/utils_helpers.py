import logging
import urllib.request
from pathlib import Path
from config import load_config
import spotipy
from spotify_helpers import auth_manager, playlist_cache_lock, playlist_cache, save_cache
from spotify import load_cache

# === Adding current track ===
def add_current_track(tray_icon=None):
    track_name = None
    artists = None
    logging.info("add_current_track() triggered by hotkey")
    try:
        logging.debug("add_current_track() called")
        config = load_config()
        playlist_id = config.get('playlist_id')
        if not playlist_id:
            return

        sp = spotipy.Spotify(auth_manager=auth_manager)
        current = sp.current_playback()

        if not current or not current['is_playing']:
            logging.info("No track currently playing")
            return

        track = current['item']
        track_id = track['id']
        track_name = track['name']
        artists = ", ".join(artist['name'] for artist in track['artists'])

        # Load cache from disk, add new track, and save
        with playlist_cache_lock:
            disk_cache = load_cache()
            in_cache = track_id in disk_cache

        if in_cache:
            logging.debug(f"Already in playlist: {track_name}")
            if tray_icon and hasattr(tray_icon, "dialog") and tray_icon.dialog:
                tray_icon.dialog.already_added_signal.emit()
            return  # Do not add again

        sp.playlist_add_items(playlist_id, [track_id])
        with playlist_cache_lock:
            disk_cache.add(track_id)
            save_cache(disk_cache)
        logging.debug(f"Added: {track_name} - {artists}")
        logging.info("Hotkey pressed, adding track...")
    except Exception as e:
        logging.exception("[ERROR] Exception in add_current_track:")

    if tray_icon and tray_icon.dialog:
        image_data = None
        try:
            images = track.get('album', {}).get('images', [])
            if images:
                url = images[0]['url']
                image_data = urllib.request.urlopen(url, timeout=5).read()
        except Exception as e:
            logging.debug(f"[WARNING] Failed to load album art: {e}")

        tray_icon.dialog.feedback_signal.emit(f"{artists} - {track_name}", image_data)

# === Icons ===
def ensure_icon(icon_path: Path, icon_url: str):
    if not icon_path.exists():
        try:
            urllib.request.urlretrieve(icon_url, icon_path)
            logging.debug("Icon successfully downloaded")
        except Exception as e:
            logging.error(f"Error downloading icon: {e}")
