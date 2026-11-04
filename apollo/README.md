# Apollo webcam input for Moon Rider

Open http://localhost:8423/?apollo=1 and stop the camera in any other tracker tab. Start the camera in the Apollo panel. Stand comfortably, facing forward, with both shoulders, elbows and wrists visible. Click **Recenter** to use your current stance as the middle of the track. Use the mouse for **Begin**, song selection and **Play**. Classic mode starts selected. Hide the preview for more play space.

Wrists position the two Classic sabers. Forearm direction estimates blade angle. Shoulder movement controls lateral lean and ducking. The game uses a fixed hand depth and its existing blade collision and score system. Wrist roll and full 3D controller orientation are unavailable from this input. A missing wrist stops registering hits until tracking stabilizes. Use the standard game URL without the Apollo query for normal controls.

## Run on another Windows PC

With Node.js, Python and pip installed, run `./apollo/setup.ps1` from PowerShell in the repository. This downloads the pinned upstream game bundle, A-Frame, MediaPipe runtime, model and native webcam helper. Then run these commands in **two terminals** from the repository root.

```powershell
node apollo/tracker/server.mjs
```

```powershell
node apollo/serve.mjs
```

The game listens on localhost port 8423. The embedded tracker listens on 127.0.0.1 port 8422. Camera frames stay in the local tracker. The plugin checks the sending frame and origin before accepting landmarks. On Windows the native fallback selects the Dell Monitor RGB Webcam by name. Song downloads use Moon Rider's upstream services.
