# Trailer

Scripts that play through the game via `window.api` and record clips for the trailer. Captions and music get added in the editor (probably DaVinci Resolve) later.

## Setup

1. `npx playwright install chromium`
1. Drop a save at `scripts/trailer/Savefile.rek` (it's gitignored). Export it when the party isn't in a fight to prevent awkward problems.
1. In OBS:
   - Tools > WebSocket Server Settings, turn the server on. If you do want to override the WSS settings, set `OBS_WEBSOCKET_URL` and `OBS_WEBSOCKET_PASSWORD` in your shell or in `scripts/trailer/.env` (also gitignored). If you set the URL, set the password too, since it won't look at OBS's config.
   - Settings > Video: 1920x1080 base and output, 60fps.
   - Settings > Advanced: turn off "Automatically remux to mp4".
   - Make a scene called `re:Form Trailer` with a Window Capture in it. Run `npm run trailer -- collectible-reveal --draft --hold` first so the window is open to pick.
     - Window: `[chrome.exe]: re:Form Trailer Capture`
     - Window match priority: "Window title must match"
     - Capture method: "Windows 10 (1903 and up)"
     - Client area on, Capture Cursor off, fit it to the canvas
   - Mute Desktop Audio and Mic/Aux for that scene

## Recording

Have the game running (`npm start`), then:

- `npm run trailer -- <shot> --draft` - records with Playwright to `output/drafts/<shot>.webm`. Good for checking timing. The video starts with the loading screen - cut it at about where `recording` shows up in the terminal.
- `npm run trailer -- <shot>` - records with OBS to `output/final/<shot>.mkv`.
- `npm run trailer -- all` - every shot, in trailer order.
- `--hold` - waits for Enter after setup, with the window still open.

Every run gets a fresh browser profile. While it's recording it swaps OBS over to the trailer scene and a temp folder.

## Adding a shot

Make a `shot-<name>.ts` that exports a `TrailerShot` and add it to `shots.ts`.

- `setup(t)` doesn't get recorded. `action(t)` does, with a second of padding on each end.
- Use `t.evaluate((api, arg) => ..., arg)` and `t.until(...)` to do things in the page. The function gets sent over as source, so it can only use `api` and `arg`, not imports or variables from the file.
- Use `t.teleport(node)` instead of calling `debugTeleportToNode` directly. It waits for the map to finish changing, which resets the camera.
- `shotWorldPrepare` in `shot-common.ts` handles the usual setup (stop auto mode, clear tutorials and the region popup, move the party).
