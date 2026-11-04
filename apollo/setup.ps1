$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path "$PSScriptRoot/..").Path
$tracker = Join-Path $PSScriptRoot 'tracker'
$assets = Join-Path $tracker 'assets'
$build = Join-Path $repo 'build'
New-Item -ItemType Directory -Force "$assets/wasm", $build | Out-Null
$vision = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304'
foreach ($file in 'vision_bundle.mjs','wasm/vision_wasm_internal.js','wasm/vision_wasm_internal.wasm','wasm/vision_wasm_nosimd_internal.js','wasm/vision_wasm_nosimd_internal.wasm') {
  Invoke-WebRequest "$vision/$file" -OutFile "$assets/$file"
}
Invoke-WebRequest 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' -OutFile "$assets/pose.task"
$release = 'https://raw.githubusercontent.com/supermedium/moonrider/725c9e5dcc77a2eea3de7a819dfca7f15f7ce83e/build'
foreach ($file in 'build.js','zip.js') {
  Invoke-WebRequest "$release/$file" -OutFile "$build/$file"
}
Invoke-WebRequest 'https://cdn.jsdelivr.net/gh/aframevr/aframe@2c4509aa1a9a3c447c08be9facfea0c7d6a9e156/dist/aframe-master.min.js' -OutFile "$build/aframe.min.js"
python -m pip install --target "$tracker/.camera-runtime" imageio-ffmpeg==0.8.1
if ($LASTEXITCODE -ne 0) { throw 'Python could not install the native camera runtime.' }
