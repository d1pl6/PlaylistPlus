// === TYPES === \\
interface LoginMethod {
  id: string;
  name: string;
  img: string;
  disabled?: boolean;
  handler?: () => Promise<void>; // async login/logout handler
}

interface MethodAction {
  id: string;
  name: string;
  img: string;
  disabled: boolean;
  infoText: string;
  onClick?: () => Promise<void>;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  owner: { display_name: string; id: string };
  collaborative: boolean;
  duration_ms: number;
}

// === STATE === \\
let loggedInMethods: string[] = [];
let loginMethodsVisible = false;
let logoutMethodsVisible = false;
let addPlaylistMethodsVisible = false;

const main = document.getElementById("main")!;
const loginBtn = document.getElementById("btn-login")!;
const logoutBtn = document.getElementById("btn-logout")!;
const hideBtn = document.getElementById("btn-hide")!;
const addPlaylistBtn = document.getElementById("btn-add-playlist")!;

// === LOGIN METHODS === \\
const loginMethods: LoginMethod[] = [
  {
    id: "spotify",
    name: "Spotify",
    img: "../assets/icons/spotify.png",
    handler: async () => {
      const tokens = await window.api.spotifyLogin();
      console.log("Spotify tokens obtained:", tokens);
    },
  },
  {
    id: "youtube",
    name: "YouTube Music",
    img: "../assets/icons/youtube.png",
    disabled: true, // not implemented yet
  }
];

// === UTILITIES === \\
async function loadLoggedInMethods() {
  const spotifyToken = await window.api.getSpotifyAccessToken();
  if (spotifyToken) loggedInMethods.push("spotify");
}

// Generic function to render login/logout grids
function renderMethodsGrid(methods: MethodAction[]) {
  main.innerHTML = "";
  const divgrid = document.createElement("div");
  divgrid.classList.add("div-grid");

  methods.forEach((method) => {
    const div = document.createElement("div");
    div.classList.add("login-method-div");
    div.style.opacity = method.disabled ? "0.5" : "1";
    div.style.cursor = method.disabled ? "not-allowed" : "pointer";
    div.title = method.infoText;

    const img = document.createElement("img");
    img.src = method.img;
    img.alt = method.name;
    img.classList.add("login-method-img");
    div.appendChild(img);

    const nameEl = document.createElement("p");
    nameEl.textContent = method.name;
    nameEl.classList.add("login-method-name");
    div.appendChild(nameEl);

    if (!method.disabled && method.onClick) {
      let isProcessing = false;
      div.addEventListener("click", async () => {
        if (isProcessing) return;
        isProcessing = true;
        div.style.opacity = "0.5";
        div.style.cursor = "not-allowed";
        if (method.onClick) {
          await method.onClick();
        }
        isProcessing = false;
      });
    }

    divgrid.appendChild(div);
  });

  main.appendChild(divgrid);
}

// === TOGGLE PANEL UTILS === \\
async function toggleLoginPanel() {
  if (logoutMethodsVisible || addPlaylistMethodsVisible || loginMethodsVisible) {
    // Hide all panels
    logoutMethodsVisible = false;
    addPlaylistMethodsVisible = false;
    loginMethodsVisible = false;

    // Show playlists instead of clearing main
    await showPlaylists();
    return;
  }
  // Show login panel
  showLoginMethods();
}

async function toggleLogoutPanel() {
  if (loginMethodsVisible || addPlaylistMethodsVisible || logoutMethodsVisible) {
    loginMethodsVisible = false;
    addPlaylistMethodsVisible = false;
    logoutMethodsVisible = false;

    await showPlaylists();
    return;
  }
  showLogoutMethods();
}

async function toggleAddPlaylistPanel() {
  if (loginMethodsVisible || logoutMethodsVisible || addPlaylistMethodsVisible) {
    loginMethodsVisible = false;
    logoutMethodsVisible = false;
    addPlaylistMethodsVisible = false;

    await showPlaylists();
    return;
  }
  addPlaylist();
}

// === LOGIN UI === \\
function showLoginMethods() {
  if (loginMethodsVisible) {
    main.innerHTML = "";
    loginMethodsVisible = false;
    return;
  }

  const methodsToRender: MethodAction[] = loginMethods.map((method) => {
    const alreadyLogged = loggedInMethods.includes(method.id);
    const disabled = method.disabled || alreadyLogged;
    return {
      id: method.id,
      name: method.name,
      img: method.img,
      disabled,
      infoText: disabled
        ? method.disabled
          ? `${method.name} is not available yet`
          : `Already logged in with ${method.name}`
        : `Login via ${method.name}`,
      onClick: method.handler,
    };
  });

  renderMethodsGrid(methodsToRender);
  loginMethodsVisible = true;
}

// === LOGOUT UI === \\
function showLogoutMethods() {
  if (logoutMethodsVisible) {
    main.innerHTML = "";
    logoutMethodsVisible = false;
    return;
  }

  const methodsToRender: MethodAction[] = loginMethods.map((method) => {
    const isLogged = loggedInMethods.includes(method.id);
    const disabled = !isLogged;
    return {
      id: method.id,
      name: method.name,
      img: method.img,
      disabled,
      infoText: isLogged
        ? `Logout from ${method.name}`
        : `Not logged in with ${method.name}`,
      onClick: isLogged
        ? async () => {
          const confirmed = confirm(`Are you sure you want to log out of ${method.name}?`);
          if (!confirmed) return;

          // Example: call your API for logout
          if (method.id === "spotify") {
            const success = await window.api.spotifyLogout();
            if (success) {
              loggedInMethods = loggedInMethods.filter((id) => id !== "spotify");
            }
          }

          showLogoutMethods(); // refresh UI
        }
        : undefined,
    };
  });

  renderMethodsGrid(methodsToRender);
  logoutMethodsVisible = true;
}

// === INIT === \\
loadLoggedInMethods();
window.api.onLoginStatus((status) => {
  if (status.spotify === true) {
    loggedInMethods.push("spotify");
  } else if (status.spotify === false) {
    loggedInMethods = loggedInMethods.filter((id) => id !== "spotify");
  }
});

async function showSpotifyPlaylists() {
  main.innerHTML = "Loading playlists...";

  const playlists: SpotifyPlaylist[] | null = await window.api.getUserPlaylists();
  if (!playlists || playlists.length === 0) {
    main.innerHTML = "No playlists found or failed to fetch. Check your connection, spotify API status or try to logout and login again.";
    return;
  }

  // Get current user's Spotify ID
  const tokenData = await window.api.getSpotifyAccessToken();
  if (!tokenData) {
    main.innerHTML = "Failed to get spotify token or refresh it. Check your connection, spotify API status or try to logout and login again."
    return
  };

  const userRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const me = await userRes.json();
  const userId = me.id;

  // Filter playlists that user owns or can modify
  const editablePlaylists = playlists.filter(
    (pl) => pl.owner.id === userId || pl.collaborative
  );

  if (editablePlaylists.length === 0) {
    main.innerHTML = "No playlists you can edit were found.";
    return;
  }

  main.innerHTML = "";
  const grid = document.createElement("div");
  grid.classList.add("addplaylist-div-grid");

  editablePlaylists.forEach((pl) => {
    const div = document.createElement("div");
    div.classList.add("addplaylist-playlist-div");
    // Guard against playlists with null/empty images
    div.title = pl.images?.[0]?.url ? `Add \"${pl.name}\"` : "Something is wrong with image";

    const img = document.createElement("img");
    img.src = pl.images?.[0]?.url || "../assets/icons/default_playlist.png";
    img.alt = pl.name;
    img.classList.add("addplaylist-img")
    div.appendChild(img);

    const name = document.createElement("p");
    name.textContent = pl.name;
    name.classList.add("addplaylist-name")
    div.appendChild(name);

    div.addEventListener("click", async () => {
      grid.style.pointerEvents = "none";
      try {
        const success = await window.api.selectPlaylist(pl.id);
        if (success) {
          addPlaylistMethodsVisible = false;
          showPlaylists();
        } else {
          console.error("selectPlaylist returned false for playlist:", pl.name, pl.id);
          alert("Something went wrong. Check your internet connection, Spotify, or Spotify API status.");
        }
      } catch (err) {
        console.error("Error calling selectPlaylist:", err);
        alert("Something went wrong. Check console for details.");
      } finally {
        grid.style.pointerEvents = "auto";
      }
    });

    grid.appendChild(div);
  });

  main.appendChild(grid);
  addPlaylistMethodsVisible = true;
}

// === ADD PLAYLIST FUNCTION === \\
async function addPlaylist() {
  if (addPlaylistMethodsVisible) {
    main.innerHTML = "";
    addPlaylistMethodsVisible = false;
    return;
  }
  main.innerHTML = ""; // Clear the main area

  const addMethods: MethodAction[] = loginMethods.map((service) => {
    const isLogged = loggedInMethods.includes(service.id);
    return {
      id: service.id,
      name: service.name,
      img: service.img,
      disabled: service.disabled || !isLogged,
      infoText: service.disabled
        ? `${service.name} is not available yet`
        : !isLogged
          ? `You must be logged into ${service.name} to add a playlist`
          : `Add a playlist from ${service.name}`,
      onClick: async () => {
        if (service.id === 'spotify') {
          await showSpotifyPlaylists();
        }
      }
    };
  });

  renderMethodsGrid(addMethods);
  addPlaylistMethodsVisible = true;
}

async function showPlaylists() {
  if (!main) return;

  main.innerHTML = "";

  // Get manifest from main process
  const manifest = await window.api.getManifest();

  if (!manifest || Object.keys(manifest).length === 0) {
    const message = document.createElement("p");
    message.classList.add("no-playlists-message");
    message.textContent = "Press Add Playlist (+) button.";
    main.appendChild(message);
    return;
  }

  // Playlist container
  const playlistContainer = document.createElement("div");
  playlistContainer.classList.add("playlists-container");

  for (const indexStr of Object.keys(manifest)) {
    const entry = manifest[indexStr];

    // Fetch tracks for this playlist
    const tracks = await window.api.getTracks(entry.playlistId); // IPC call

    // Take last 5
    const previewTracks = tracks.slice(-5);

    const playlistDiv = document.createElement("div");
    playlistDiv.classList.add("playlists-div");
    // expose the manifest index so other handlers can find this element reliably
    playlistDiv.setAttribute("data-index", indexStr);

    const top = document.createElement("div");
    top.classList.add("top");

    // Playlists reload button
    const reloadCache = document.createElement("input");
    reloadCache.type = "image";
    reloadCache.src = "../assets/icons/reloadCache.png";
    reloadCache.alt = "Reload current playlist cache";
    reloadCache.title = "Reload current playlist cache";
    reloadCache.classList.add("playlists-reloadCache");

    // Playlists name
    const title = document.createElement("p");
    title.textContent = entry.name;
    title.classList.add("playlists-entry-name");

    const closePlaylist = document.createElement("input");
    closePlaylist.type = "image";
    closePlaylist.src = "../assets/icons/close.png";
    closePlaylist.alt = "Remove current playlist";
    closePlaylist.title = "Remove current playlist";
    closePlaylist.classList.add("playlists-closePlaylist");

    const alreadyKeyinput = document.createElement("div");
    alreadyKeyinput.classList.add("alreadyKeyinput")
    // Keybind Input
    const keybindInput = document.createElement("input");
    keybindInput.type = "text";
    keybindInput.readOnly = true;
    keybindInput.classList.add("playlists-keybind-input");
    // show existing keybind from manifest if any
    keybindInput.value = entry.keybind ?? "";
    keybindInput.title = entry.keybind ? `Hotkey: ${entry.keybind}` : "Click and press keys to set hotkey";
    keybindInput.placeholder = "Set keybind";
    alreadyKeyinput.appendChild(keybindInput);

    // Connection
    top.appendChild(reloadCache);
    top.appendChild(title);
    top.appendChild(closePlaylist);
    playlistDiv.appendChild(top);
    playlistDiv.appendChild(alreadyKeyinput);

    previewTracks.forEach(track => {
      const tracksDiv = document.createElement("div");
      tracksDiv.classList.add("playlists-tracks-div");

      const img = document.createElement("img");
      img.src = track.album_image;
      img.title = `${track.name} - ${track.artists}`;
      img.alt = `${track.name} - ${track.artists}`;
      img.classList.add("tracks-img");

      const container = document.createElement("div");
      container.classList.add("tracks-container");

      const name = document.createElement("p");
      name.textContent = track.name;
      name.classList.add("tracks-name");

      const artists = document.createElement("p");
      artists.textContent = track.artists;
      artists.classList.add("tracks-artists");

      // Connection
      container.appendChild(name);
      container.appendChild(artists);
      tracksDiv.appendChild(img);
      tracksDiv.appendChild(container);
      playlistDiv.appendChild(tracksDiv);
    });
    playlistContainer.appendChild(playlistDiv);

    reloadCache.addEventListener("click", async () => {
      reloadCache.style.pointerEvents = "none";
      reloadCache.style.backgroundColor = "#202020"
      reloadCache.style.cursor = "progress";
      closePlaylist.disabled = true;
      const success = await window.api.reloadPlaylist(Number(indexStr));
      if (success) showPlaylists();
      else alert("Failed to reload playlist. Check internet or Spotify API status.");
    });
    closePlaylist.addEventListener("click", async () => {
      const confirmed = confirm(`Delete playlist "${entry.name}"?`);
      if (!confirmed) return;

      const success = await window.api.deletePlaylist(Number(indexStr));
      if (success) {
        await showPlaylists();
      } else {
        alert("Failed to delete playlist");
      }
    });
    function captureComboFromEvent(e: KeyboardEvent): string | null {
      // block meta/win/cmd entirely
      if (e.metaKey) return null;

      // detect forbidden combos
      const forbiddenCombo = (mods: { ctrl: boolean; alt: boolean; shift: boolean }, keyName: string) => {
        const combo = [
          mods.ctrl ? "Ctrl" : null,
          mods.alt ? "Alt" : null,
          mods.shift ? "Shift" : null,
          keyName,
        ].filter(Boolean).join("+");
        // block alt+tab or alt+F4 or other specific combos
        if (combo === "Alt+Tab" || combo === "Alt+F4") return true;
        return false;
      };

      // Use event.code for layout-independent detection (KeyA, Digit1, Numpad1, etc.)
      const code = e.code || "";
      const mods = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };

      // Escape -> handled by caller (clear)
      if (e.key === "Escape") return "Escape"; // will be treated specially

      // Special single keys
      const specialKeys: Record<string, string> = {
        Backspace: "Backspace",
        Insert: "Insert",
        Delete: "Delete",
        Home: "Home",
        End: "End",
        PageUp: "PageUp",
        PageDown: "PageDown",
        PrintScreen: "PrintScreen",
        ScrollLock: "ScrollLock",
        Pause: "Pause",
      };

      if (specialKeys[e.key]) {
        const keyName = specialKeys[e.key];
        if (forbiddenCombo(mods, keyName)) return null;

        const parts: string[] = [];
        if (mods.ctrl) parts.push("Ctrl");
        if (mods.alt) parts.push("Alt");
        if (mods.shift) parts.push("Shift");
        parts.push(keyName);

        return parts.join("+");
      }

      // Disallow Enter and Space as per your requirement
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") return null;

      // Letters via code (KeyA..KeyZ) — uppercase
      if (code.startsWith("Key")) {
        const letter = code.slice(3).toUpperCase(); // KeyA -> 'A'
        if (forbiddenCombo(mods, letter)) return null;
        const parts = [];
        if (mods.ctrl) parts.push("Ctrl");
        if (mods.alt) parts.push("Alt");
        if (mods.shift) parts.push("Shift");
        parts.push(letter);
        return parts.join("+");
      }

      // Digits via code: Digit0..Digit9 -> '0'..'9'
      if (code.startsWith("Digit")) {
        const digit = code.slice(5); // Digit1 -> '1'
        if (!/^[0-9]$/.test(digit)) return null;
        if (forbiddenCombo(mods, digit)) return null;
        const parts = [];
        if (mods.ctrl) parts.push("Ctrl");
        if (mods.alt) parts.push("Alt");
        if (mods.shift) parts.push("Shift");
        parts.push(digit);
        return parts.join("+");
      }

      // Numpad digits (Numpad0..Numpad9)
      if (code.startsWith("Numpad")) {
        const num = code.slice(6);
        if (/^[0-9]$/.test(num)) {
          const parts = [];
          if (mods.ctrl) parts.push("Ctrl");
          if (mods.alt) parts.push("Alt");
          if (mods.shift) parts.push("Shift");
          parts.push(num);
          return parts.join("+");
        }
        return null;
      }

      // Function keys F1..F12 (use e.key typically)
      if (/^F[0-9]{1,2}$/.test(e.key)) {
        if (forbiddenCombo(mods, e.key)) return null;
        const parts = [];
        if (mods.ctrl) parts.push("Ctrl");
        if (mods.alt) parts.push("Alt");
        if (mods.shift) parts.push("Shift");
        parts.push(e.key.toUpperCase());
        return parts.join("+");
      }

      // Tab / Arrow keys / others => ignore
      return null;
    }
    let currentCombo: string | null = entry.keybind ?? null;
    let listening = false;
    async function saveKeybind(playlistId: string, combo: string | null) {
      try {
        const ok = await window.api.setPlaylistKeybind(playlistId, combo);
        if (!ok) console.error("Failed to save keybind for playlist", playlistId);
        else {
          keybindInput.title = combo ? `Hotkey: ${combo}` : "No hotkey set";
        }
      } catch (err) {
        console.error("Error saving keybind:", err);
      }
    }
    function onKeydownWhileFocused(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      // Esc clears immediately
      if (e.key === "Escape") {
        currentCombo = null;
        keybindInput.value = "";
        void saveKeybind(entry.playlistId, null);
        return;
      }

      // Do not allow Meta (Win/Cmd)
      if (e.metaKey) {
        // ignore
        return;
      }

      const combo = captureComboFromEvent(e);
      if (!combo) {
        // invalid or ignored (space/enter/only-modifiers etc)
        return;
      }

      // If captureCombo returned "Escape" string (we treated escape above) — ignore
      if (combo === "Escape") return;

      // If combo contains only modifiers (shouldn't because capture checks), ignore
      // Otherwise set input
      currentCombo = combo;
      keybindInput.value = combo;
    }
    // start listening when input focused
    keybindInput.addEventListener("focus", () => {
      if (listening) return;
      listening = true;
      document.addEventListener("keydown", onKeydownWhileFocused, true);
    });

    // on blur, stop listening and persist the value (if valid)
    keybindInput.addEventListener("blur", async () => {
      if (!listening) return;
      listening = false;
      document.removeEventListener("keydown", onKeydownWhileFocused, true);

      // if user pressed nothing and input empty -> no change
      // if user cleared with ESC we already saved null
      // otherwise save currentCombo (string) or null
      await saveKeybind(entry.playlistId, currentCombo ?? null);
    });

    // small UX: click on input to focus and start listening
    keybindInput.addEventListener("click", () => keybindInput.focus());
  }
  main.appendChild(playlistContainer);
}

// Global handler: append latest track when a specific playlist is updated
window.api.onPlaylistUpdated(async (playlistIndex: number) => {
  try {
    const playlistDiv = document.querySelector(`.playlists-div[data-index="${playlistIndex}"]`);
    if (!playlistDiv) return;

    const manifest = await window.api.getManifest();
    const entry = manifest[playlistIndex];
    if (!entry) return;

    const tracks = await window.api.getTracks(entry.playlistId);
    const lastTrack = tracks[tracks.length - 1];
    if (!lastTrack) return;

    const tracksDiv = document.createElement("div");
    tracksDiv.classList.add("playlists-tracks-div");

    const img = document.createElement("img");
    img.src = lastTrack.album_image;
    img.title = `${lastTrack.name} - ${lastTrack.artists}`;
    img.alt = `${lastTrack.name} - ${lastTrack.artists}`;
    img.classList.add("tracks-img");

    const container = document.createElement("div");
    container.classList.add("tracks-container");

    const name = document.createElement("p");
    name.textContent = lastTrack.name;
    name.classList.add("tracks-name");

    const artists = document.createElement("p");
    artists.textContent = lastTrack.artists;
    artists.classList.add("tracks-artists");

    container.appendChild(name);
    container.appendChild(artists);
    tracksDiv.appendChild(img);
    tracksDiv.appendChild(container);

    // Keep only the last 5 preview tracks: if there are already 5, remove the oldest
    const existingPreviews = playlistDiv.querySelectorAll('.playlists-tracks-div');
    if (existingPreviews.length >= 5) {
      // remove the first (oldest) preview row
      const first = existingPreviews[0] as HTMLElement | undefined;
      if (first) first.remove();
    }
    playlistDiv.appendChild(tracksDiv);
  } catch (err) {
    console.error("Error handling playlist update:", err);
  }
});

window.api.onTrackAlreadyExists((playlistIndex: number, trackName: string) => {
  // Find the playlist DIV by the manifest index (data-index)
  const playlistDiv = document.querySelector(`.playlists-div[data-index="${playlistIndex}"]`);
  if (!playlistDiv) return;

  const alreadyKeyinput = playlistDiv.querySelector('.alreadyKeyinput');
  if (!alreadyKeyinput) return;

  const existingMsg = alreadyKeyinput.querySelector('.div-alreadyExists');
  if (existingMsg) return;

  const alreadyDiv = document.createElement('div');
  alreadyDiv.classList.add('div-alreadyExists');

  const songNameHelperfirst = document.createElement('span');
  songNameHelperfirst.classList.add('text-alreadyExists');
  songNameHelperfirst.textContent = `"`;
  const songNameHelpersecond = document.createElement('span');
  songNameHelpersecond.classList.add('text-alreadyExists');
  songNameHelpersecond.textContent = `"`;

  const songName = document.createElement('span');
  songName.classList.add('songName-alreadyExists');
  songName.textContent = `${trackName}`;

  const alreadyExists = document.createElement('p');
  alreadyExists.classList.add('text-alreadyExists');
  alreadyExists.textContent = `- already exists in playlist`;

  alreadyDiv.appendChild(songNameHelperfirst);
  alreadyDiv.appendChild(songName);
  alreadyDiv.appendChild(songNameHelpersecond);
  alreadyDiv.appendChild(alreadyExists);

  alreadyKeyinput.appendChild(alreadyDiv);

  setTimeout(() => {
    songName.remove();
    alreadyDiv.remove();
  }, 2000);
});

// === EVENT LISTENERS === \\
loginBtn.addEventListener("click", toggleLoginPanel);
hideBtn.addEventListener("click", () => window.api.hideToTray());
addPlaylistBtn.addEventListener("click", toggleAddPlaylistPanel);
logoutBtn.addEventListener("click", toggleLogoutPanel);

document.addEventListener("DOMContentLoaded", async () => {
  await showPlaylists();
});
