import logging

def extract_playlist_id(url_or_id: str) -> str | None:
    if "open.spotify.com/playlist/" in url_or_id:
        pid = url_or_id.split("playlist/")[-1].split("?")[0]
        logging.debug(f"Extracted playlist ID: {pid}")
        return pid
    return url_or_id.strip() if url_or_id else None
