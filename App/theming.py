import urllib.request
import logging
from pathlib import Path
from PyQt5 import QtWidgets
from styles import DEFAULT_DARK_QSS
from config import APPDATA

THEMES_DIR = APPDATA / "themes"
DEFAULT_THEME_URL = "https://raw.githubusercontent.com/d1pl6/PlaylistPlus/heads/main/dark.qss"
DEFAULT_THEME_FILENAME = "dark.qss"
LIGHT_THEME_URL = "https://raw.githubusercontent.com/d1pl6/PlaylistPlus/heads/main/light.qss"
LIGHT_THEME_FILENAME = "light.qss"

def download_light_theme():
    ensure_themes_dir()
    theme_path = THEMES_DIR / LIGHT_THEME_FILENAME

    if not theme_path.exists():
        try:
            urllib.request.urlretrieve(LIGHT_THEME_URL, theme_path)
            logging.info(f"Downloaded light theme to {theme_path}")
        except Exception as e:
            logging.error(f"Failed to download light theme: {e}")

    return theme_path

def ensure_themes_dir():
    THEMES_DIR.mkdir(parents=True, exist_ok=True)

def download_default_theme():
    ensure_themes_dir()
    theme_path = THEMES_DIR / DEFAULT_THEME_FILENAME

    if not theme_path.exists():
        try:
            urllib.request.urlretrieve(DEFAULT_THEME_URL, theme_path)
            logging.info(f"Downloaded default theme to {theme_path}")
        except Exception as e:
            logging.error(f"Failed to download default theme: {e}")

    return theme_path

def apply_qss_from_file(path: Path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            qss = f.read()
            if app := QtWidgets.QApplication.instance():
                app.setStyleSheet(qss)
                logging.debug(f"Applied QSS theme from {path}")
            else:
                raise RuntimeError("No QApplication instance found")
    except Exception as e:
        logging.error(f"Failed to apply QSS from {path}: {e}")
        if app := QtWidgets.QApplication.instance():
            app.setStyleSheet(DEFAULT_DARK_QSS)
            logging.info("Fallback to built-in dark theme.")
        else:
            logging.critical("Failed to apply fallback QSS – no QApplication.")

def apply_theme(config: dict):
    ensure_themes_dir()

    theme_name = "dark.qss" if config.get("dark_theme") else "light.qss"
    theme_path = THEMES_DIR / theme_name

    if not theme_path.exists():
        if theme_name == "dark.qss":
            theme_path = download_default_theme()
        elif theme_name == "light.qss":
            theme_path = download_light_theme()

    apply_qss_from_file(theme_path)
