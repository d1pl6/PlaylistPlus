from PyQt5 import QtWidgets, QtGui
from ui import TrayApp
from config import load_config
from hotkeys import register_hotkey
from utils_helpers import add_current_track
from functools import partial
import sys
import os
from pathlib import Path

def main():
    app = QtWidgets.QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)

    icon_path = Path(os.getenv("APPDATA")) / "PlaylistPlus" / "icon.ico"
    icon = QtGui.QIcon(str(icon_path))

    tray = TrayApp(icon)
    tray.show()

    config = load_config()
    hotkey = config.get("hotkey")
    if hotkey:
        register_hotkey(hotkey, partial(add_current_track, tray_icon=tray))

    sys.exit(app.exec_())

if __name__ == "__main__":
    main()
