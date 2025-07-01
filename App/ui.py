from PyQt5 import QtWidgets, QtGui, QtCore
from PyQt5.QtCore import pyqtSignal, QTimer
import os
from pathlib import Path
from config import load_config, save_config
from theming import apply_theme
from spotify import update_cache_in_thread, PlaylistLoader
from hotkeys import register_hotkey, get_key_char_win
from utils_helpers import add_current_track
from helpers import extract_playlist_id

def run_app():
    import sys
    app = QtWidgets.QApplication(sys.argv)
    dialog = ConfigDialog()
    dialog.show()
    sys.exit(app.exec_())

class ConfigDialog(QtWidgets.QDialog):
    feedback_signal = pyqtSignal(str, bytes)
    already_added_signal = pyqtSignal()

    def __init__(self, playlist_url="", hotkey=""):
        super().__init__()
        self.loader_thread = None

        self.setWindowTitle("PlaylistPlus Settings")
        self.setFixedSize(400, 350)
        self.initial_playlist_url = playlist_url
        self.initial_hotkey = hotkey

        self._setup_ui()
        self.reset_fields()
        self.restore_last_feedback()

    def restore_last_feedback(self):
        from config import load_config
        import urllib.request

        config = load_config()
        text = config.get("last_added_track")
        image_url = config.get("last_added_image_url")

        if text:
            image_data = None
            if image_url:
                try:
                    image_data = urllib.request.urlopen(image_url, timeout=5).read()
                except Exception as e:
                    print(f"Failed to load saved album art: {e}")

            self.show_feedback(text, image_data)

    def _setup_ui(self):
        layout = QtWidgets.QVBoxLayout()

        self.setWindowIcon(QtGui.QIcon(str(self._get_icon_path())))

        self.already_added_label = QtWidgets.QLabel("")
        self.already_added_label.setObjectName("alreadyAddedLabel")
        self.already_added_label.setVisible(False)
        self.already_added_label.setAlignment(QtCore.Qt.AlignVCenter)
        self.already_added_signal.connect(self.show_already_added)

        self.playlist_image_label = QtWidgets.QLabel()
        self.playlist_image_label.setFixedSize(64, 64)
        self.playlist_image_label.setScaledContents(True)

        self.playlist_name_label = QtWidgets.QLabel("Playlist name will appear here")
        self.playlist_name_label.setStyleSheet("font-weight: bold")
        self.playlist_name_label.setAlignment(QtCore.Qt.AlignVCenter)

        playlist_info_layout = QtWidgets.QHBoxLayout()
        playlist_info_layout.addWidget(self.playlist_image_label)
        playlist_info_layout.addWidget(self.playlist_name_label)

        self.playlist_input = QtWidgets.QLineEdit()
        self.playlist_input.setPlaceholderText("Paste link to playlist")
        self.playlist_input.setText(self.initial_playlist_url)
        self.playlist_input.textChanged.connect(self.load_playlist_info)

        hotkey_layout = QtWidgets.QHBoxLayout()
        self.hotkey_input = HotkeyLineEdit()
        self.hotkey_input.setPlaceholderText("Press a keybind, example: Ctrl+Alt+S")

        self.clear_hotkey_btn = QtWidgets.QToolButton()
        self.clear_hotkey_btn.setText("\u2715")
        self.clear_hotkey_btn.setToolTip("Reset keybind")
        self.clear_hotkey_btn.clicked.connect(self.hotkey_input.clear)

        hotkey_layout.addWidget(self.hotkey_input)
        hotkey_layout.addWidget(self.clear_hotkey_btn)

        self.ok_button = QtWidgets.QPushButton("Save and run")
        self.ok_button.clicked.connect(self.save_and_hide)

        self.recently_added_widget = self._build_recently_added_block()

        # Layout setup
        layout.addLayout(playlist_info_layout)
        layout.addWidget(self.already_added_label)
        layout.addWidget(self.recently_added_widget)
        layout.addWidget(QtWidgets.QLabel("Link to playlist:"))
        layout.addWidget(self.playlist_input)
        layout.addWidget(QtWidgets.QLabel("Keybind:"))
        layout.addLayout(hotkey_layout)
        layout.addWidget(self.ok_button)

        self.setLayout(layout)

    def _build_recently_added_block(self):
        wrapper = QtWidgets.QWidget()
        layout = QtWidgets.QVBoxLayout(wrapper)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(3)

        self.recently_added_label = QtWidgets.QLabel("Recently added:")
        self.recently_added_label.setStyleSheet("font-weight: bold;")
        layout.addWidget(self.recently_added_label)

        self.album_art_label = QtWidgets.QLabel()
        self.album_art_label.setFixedSize(48, 48)
        self.album_art_label.setScaledContents(True)

        self.track_info_label = QtWidgets.QLabel()
        self.track_info_label.setWordWrap(True)
        self.track_info_label.setSizePolicy(QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Preferred)
        self.track_info_label.setContentsMargins(10, 0, 0, 0)

        h_layout = QtWidgets.QHBoxLayout()
        h_layout.addWidget(self.album_art_label)
        h_layout.addWidget(self.track_info_label)

        layout.addLayout(h_layout)

        wrapper.setProperty("class", "recently-added")
        return wrapper
    def get_data(self):
        return self.playlist_input.text().strip(), self.hotkey_input.text().strip()

    def reset_fields(self):
        self.playlist_input.setText(self.initial_playlist_url)
        self.hotkey_input.setText(self.initial_hotkey)
        self.load_playlist_info()

    def closeEvent(self, event):
        if self.loader_thread and self.loader_thread.isRunning():
            QtWidgets.QMessageBox.information(
                self, "Please wait", "Caching is still running. The window will close when done."
            )
            self.setEnabled(False)
            def check_thread():
                if not self.loader_thread.isRunning():
                    self.loader_thread.wait()  # Wait for thread cleanup
                    self.setEnabled(True)
                    self.reset_fields()
                    QtWidgets.QDialog.accept(self)
                else:
                    QTimer.singleShot(200, check_thread)
            QTimer.singleShot(200, check_thread)
            event.ignore()
        else:
            self.reset_fields()
            QtWidgets.QDialog.accept(self)

    def save_and_hide(self):
        self.initial_playlist_url = self.playlist_input.text()
        self.initial_hotkey = self.hotkey_input.text()
        self.close()  # This will trigger closeEvent

    def show_feedback(self, text, image_data=None):
        self.track_info_label.setText(text)
        self.track_info_label.setVisible(True)

        if image_data:
            pixmap = QtGui.QPixmap()
            pixmap.loadFromData(image_data)
            self.album_art_label.setPixmap(pixmap)
            self.album_art_label.setVisible(True)
        else:
            self.album_art_label.clear()
            self.album_art_label.setVisible(False)

    def load_playlist_info(self):
        url = self.playlist_input.text().strip()
        if not url or "open.spotify.com" not in url:
            self.playlist_name_label.setText("No playlist loaded")
            self.playlist_image_label.clear()
            return

        self.playlist_name_label.setText("Loading...")

        self.loader_thread = PlaylistLoader(url)
        self.loader_thread.finished.connect(self._on_playlist_loaded)
        self.loader_thread.start()
    def _on_playlist_loaded(self, data, image_data):
        if not data or not data.get('name'):
            self.playlist_name_label.setText("Invalid or private playlist")
            self.playlist_image_label.clear()
            return

        self.playlist_name_label.setText(data['name'])

        if image_data:
            pixmap = QtGui.QPixmap()
            pixmap.loadFromData(image_data)
            self.playlist_image_label.setPixmap(pixmap)
        else:
            self.playlist_image_label.clear()

    def _get_icon_path(self):
        return Path(os.getenv('APPDATA')) / 'PlaylistPlus' / 'icon.ico'
    
    # Show a temporary message that a track is already in the playlist
    def show_already_added(self):
        self.already_added_label.setText("Track is already in playlist")
        self.already_added_label.setVisible(True)
        QTimer.singleShot(5000, self.hide_already_added)

    def hide_already_added(self):
        self.already_added_label.clear()
        self.already_added_label.setVisible(False)

# === Hotkey line edit ===
class HotkeyLineEdit(QtWidgets.QLineEdit):
    def __init__(self):
        super().__init__()
        self.setReadOnly(True)
        self._modifiers = QtCore.Qt.KeyboardModifiers()
        self._key = None

    def keyPressEvent(self, event):
        self._modifiers = event.modifiers()
        self._key = event.key()

        vk_code = event.nativeVirtualKey()
        # Normalize 0-9 keys regardless of layout
        if 0x30 <= vk_code <= 0x39:
            char = str(vk_code - 0x30)
        else:
            char = get_key_char_win(vk_code)
        mods = []
        if self._modifiers & QtCore.Qt.ControlModifier:
            mods.append('ctrl')
        if self._modifiers & QtCore.Qt.AltModifier:
            mods.append('alt')
        if self._modifiers & QtCore.Qt.ShiftModifier:
            mods.append('shift')
        if self._modifiers & QtCore.Qt.MetaModifier:
            mods.append('meta')
        if char:
            mods.append(char.lower())
        self.setText('+'.join(mods))

    def keyReleaseEvent(self, event):
        pass

# === Gui tray ===
class TrayApp(QtWidgets.QSystemTrayIcon):
    def __init__(self, icon, parent=None):
        super().__init__(icon, parent)
        self.menu = QtWidgets.QMenu(parent)

        self.settings_action = self.menu.addAction("Settings")
        self.settings_action.triggered.connect(self.open_settings)

        self.theme_action = self.menu.addAction("Toggle Dark Theme")
        self.theme_action.triggered.connect(self.toggle_theme)

        self.menu.addSeparator()
        exit_action = self.menu.addAction("Quit")
        exit_action.triggered.connect(QtWidgets.qApp.quit)
        self.setContextMenu(self.menu)
        self.setToolTip("PlaylistPlus works in the background")

        self.dialog = None
        self.dark_theme_enabled = False

        config = load_config()
        if config.get('dark_theme'):
            self.dark_theme_enabled = True
            self.theme_action.setText("Toggle Light Theme")
        else:
            self.theme_action.setText("Toggle Dark Theme")
    def open_settings(self):
        if self.dialog is None:
            config = load_config()
            self.dialog = ConfigDialog(
                config.get("playlist_url", ""),
                config.get("hotkey", "")
            )
            self.dialog.feedback_signal.connect(self.dialog.show_feedback)
            self.dialog.finished.connect(self.on_dialog_closed)
        self.dialog.show()
        self.dialog.raise_()
        self.dialog.activateWindow()

    def on_dialog_closed(self):
        print("on_dialog_closed called")
        if self.dialog and self.dialog.result() == QtWidgets.QDialog.Accepted:
            new_url, new_hotkey = self.dialog.get_data()
            if not new_url.strip():
                return
            playlist_id = extract_playlist_id(new_url)
            if not playlist_id:
                return
            old_config = load_config()
            old_url = old_config.get("playlist_url", "")
            old_hotkey = old_config.get("hotkey", "")

            if new_url != old_url or new_hotkey != old_hotkey:
                updated_config = {
                    "playlist_url": new_url,
                    "playlist_id": playlist_id,
                    "hotkey": new_hotkey,
                    "dark_theme": old_config.get("dark_theme", False)
                }
                save_config(updated_config)
                update_cache_in_thread(playlist_id)
                register_hotkey(new_hotkey, add_current_track)

        if self.dialog:
            self.dialog.deleteLater()
            self.dialog = None

    def toggle_theme(self):
        config = load_config()
        dark = not config.get("dark_theme", False)
        config["dark_theme"] = dark
        save_config(config)

        apply_theme(config)

        self.dark_theme_enabled = dark
        self.theme_action.setText("Toggle Light Theme" if dark else "Toggle Dark Theme")