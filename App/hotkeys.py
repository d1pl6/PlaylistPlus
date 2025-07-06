import ctypes
import win32gui
import win32process
from pynput import keyboard
import logging

hotkey_listener = None

user32 = ctypes.windll.user32
keyboard_state = (ctypes.c_byte * 256)()
buf = ctypes.create_unicode_buffer(8)

def get_foreground_layout() -> int:
    hwnd = win32gui.GetForegroundWindow()
    thread_id = win32process.GetWindowThreadProcessId(hwnd)[0]
    layout = user32.GetKeyboardLayout(thread_id)
    return layout

def get_key_char_win(vk_code: int) -> str | None:
    layout = get_foreground_layout()
    user32.GetKeyboardState(ctypes.byref(keyboard_state))
    result = user32.ToUnicodeEx(
        vk_code,
        user32.MapVirtualKeyExW(vk_code, 0, layout),
        keyboard_state,
        buf,
        len(buf),
        0,
        layout
    )
    return buf.value if result > 0 and buf.value else None

def register_hotkey(hotkey_str: str, callback):
    global hotkey_listener

    if hotkey_listener:
        hotkey_listener.stop()

    if not hotkey_str:
        logging.warning("Empty hotkey string provided; hotkey not registered.")
        return

    expected = set(hotkey_str.lower().split("+"))
    pressed_keys = set()

    def on_press(key):
        k = normalize_key(key)
        if k:
            pressed_keys.add(k)
            logging.debug(f"[HOTKEY] Pressed: {pressed_keys}")
            if expected.issubset(pressed_keys):
                callback()

    def on_release(key):
        k = normalize_key(key)
        if k:
            pressed_keys.discard(k)

    hotkey_listener = keyboard.Listener(on_press=on_press, on_release=on_release)
    hotkey_listener.start()
    logging.info(f"Hotkey registered: {hotkey_str}")

def stop_hotkey_listener():
    global hotkey_listener
    if hotkey_listener:
        hotkey_listener.stop()
        hotkey_listener = None

def normalize_key(key) -> str | None:
    from pynput.keyboard import Key, KeyCode
    if isinstance(key, KeyCode):
        char = get_key_char_win(key.vk)
        # Normalize 0-9 keys
        if 0x30 <= key.vk <= 0x39:
            return str(key.vk - 0x30)
        return char.lower() if char else None
    elif isinstance(key, Key):
        specials = {
            'alt_l': 'alt', 'alt_r': 'alt', 'alt_gr': 'alt',
            'ctrl_l': 'ctrl', 'ctrl_r': 'ctrl',
            'shift_l': 'shift', 'shift_r': 'shift',
        }
        return specials.get(key.name, key.name)
    return None