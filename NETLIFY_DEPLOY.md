# Netlify deploy (static demo)

This repo includes a **static** build for sharing the camera demo with friends.

## What works on Netlify
- ✅ **Face + hand detection** runs **in the browser** (no server needed).
- ⚠️ **People counting** requires a separate Python API (Flask/OpenCV). Netlify cannot run Python/OpenCV.

## Deploy (fastest: drag & drop)
1. Open https://app.netlify.com/drop
2. Drag the folder `c:\VIENNA\netlify` into the page.
3. Netlify will give you a public `https://...netlify.app` link.

## Deploy (Git-connected)
- This repo includes `netlify.toml` so Netlify will publish the `netlify/` folder automatically.

## Using people counting (optional)
1. Host your Python server somewhere public (it must expose a `POST /count`).
   - The API must allow browser calls (CORS) from your Netlify domain.
2. Open the Netlify site and:
   - Toggle **"تفعيل عدّ الأشخاص"**
   - Paste your API base URL in the box (example: `https://your-api.example`)

Tip: you can also pass it in the URL like:
- `https://your-site.netlify.app/?api=https://your-api.example`

## Notes
- Camera access requires **HTTPS** (Netlify is HTTPS) or `http://localhost`.
- If you only want to share face/hand detection, leave people counting disabled.
