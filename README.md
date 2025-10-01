# Fast setup
Download app

Open app
-> Login via spotify (in your browser)

-> Press "Add playlist" button

-> Select playlist

-> Wait couple seconds (loading 100 songs per second)

-> Create keybind (click input -> create keybind -> click anywhere outside input)

Use

## Notes
For now please, don't use something like shift+s for keybind because it will block these keys in your system and you wont be able to type "S". I'll fix it later

Youtube and Yandex music support I'll add in next few weeks.

Don't run 2 apps at the same time, it will cause an error.

I won't build app for mac/linux because i can't test them there, but you can try.

## Modify
If you want to modify app:

Install [Node.js](nodejs.org)

```
npm init -y
```
```
npm i
```
To run
```
npm start
```

## Build

```
npm run dist
```
In package.json you can modify (ask [ai](duck.ai) btw):

[Win](https://www.electron.build/win) :
"win":{
>"[nsis](https://www.electron.build/nsis.html)" → recommended Windows installer with shortcuts & uninstall support

>"portable" → single .exe (no installer, runs directly)

>"zip" → simple zipped app

[Linux](https://www.electron.build/linux):
>"target": ["AppImage", "deb"]

>"category": "Utility"

> "icon": "assets/icons/app_icon.png"
}

[MacOS](https://www.electron.build/mac):
> "target": ["[dmg](https://www.electron.build/dmg)", "7z" "[mas](https://www.electron.build/mas)"]

> "category": "public.app-category.productivity"

> "icon": "assets/icons/app_icon.icns"