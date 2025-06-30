DEFAULT_DARK_QSS = """
QWidget {
    background-color: #1e1e1e;
    color: #dcdcdc;
    font-family: Segoe UI, sans-serif;
    font-size: 10pt;
}

QPushButton {
    background-color: #3a3a3a;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 4px;
}

QPushButton:hover {
    background-color: #444;
}

QLineEdit, QToolButton, QLabel {
    background-color: #2b2b2b;
    border: 1px solid #444;
    border-radius: 2px;
    padding: 2px;
}

QMenu {
    background-color: #2b2b2b;
    color: #ccc;
    border: 1px solid #555;
}

QMenu::item:selected {
    background-color: #444;
}
"""

# === Optional: paths or constants related to styling ===
THEME_FILENAME = 'dark.qss'
THEME_FOLDER_NAME = 'themes'
