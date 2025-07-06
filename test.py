import sys
from PyQt5.QtWidgets import QApplication, QMainWindow, QPushButton, QVBoxLayout, QWidget, QListWidget, QListWidgetItem

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Spotify Playlist Manager")
        self.setMaximumSize(400, 300)

        # Disable manual resizing
        self.setFixedSize(self.size())

        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)

        self.layout = QVBoxLayout(self.central_widget)

        self.playlist_list = QListWidget()
        self.layout.addWidget(self.playlist_list)

        self.add_playlist_button = QPushButton("Add Playlist")
        self.add_playlist_button.clicked.connect(self.add_playlist)
        self.layout.addWidget(self.add_playlist_button)

    def add_playlist(self):
        # Add a new playlist item to the list
        item = QListWidgetItem(f"Playlist {self.playlist_list.count() + 1}")
        self.playlist_list.addItem(item)

        # Increase the window height to accommodate the new playlist
        new_width = self.width() + 50
        self.setFixedSize(self.height(), new_width)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())
