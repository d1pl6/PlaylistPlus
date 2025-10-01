type Keybind = string;

const forbiddenKeys = new Set([
  "Meta",
  "OS",
]);

const forbiddenCombos = new Set([
  "Alt+Tab",
  "Alt+F4",
]);

export function createKeybind(e: KeyboardEvent): Keybind | null {
  e.preventDefault();

  const modifiers: string[] = [];
  if (e.ctrlKey) modifiers.push("Ctrl");
  if (e.altKey) modifiers.push("Alt");
  if (e.shiftKey) modifiers.push("Shift");

  const key = normalizeKey(e.key);

  // skip forbidden standalone keys
  if (!key || forbiddenKeys.has(key)) {
    return null;
  }

  // if only modifiers → skip
  if (!key && modifiers.length > 0) {
    return null;
  }

  const combo = [...modifiers, key].filter(Boolean).join("+");

  // skip forbidden combos
  if (forbiddenCombos.has(combo)) {
    return null;
  }

  return combo;
}

function normalizeKey(key: string): string | null {
  if (!key) return null;

  // Letters → uppercase
  if (/^[a-z]$/i.test(key)) {
    return key.toUpperCase();
  }

  // Numbers → keep as 0-9
  if (/^[0-9]$/.test(key)) {
    return key;
  }

  // Function keys (F1-F12) → keep as is
  if (/^F[0-9]{1,2}$/.test(key)) {
    return key.toUpperCase();
  }

  // Extended special keys
  const specialMap: Record<string, string> = {
    Insert: "Ins",
    Home: "Home",
    PageUp: "PgUp",
    PageDown: "PgDn",
    End: "End",
    Delete: "Del",
    PrintScreen: "PrtSc",
    ScrollLock: "ScrLk",
    Pause: "Pause",
    Break: "Break"
  };

  if (specialMap[key]) {
    return specialMap[key];
  }

  // Ignore useless/unknown keys
  const ignore = ["Dead", "Unidentified", "AltGraph"];
  if (ignore.includes(key)) return null;

  return key;
}