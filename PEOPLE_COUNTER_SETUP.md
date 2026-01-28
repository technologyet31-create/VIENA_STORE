# People Counter (Python + HTML)

This feature uses a browser camera + a Python backend to count people.

## Why NumPy install failed
Your `.venv` is using **Python 3.14**, and `numpy==1.26.4` does **not** have wheels for Python 3.14.
Also, `opencv-python` wheels are generally available up to **Python 3.12**.

## Recommended setup (Windows)
1) Install **Python 3.12 (64-bit)** from python.org.

2) Recreate the venv using Python 3.12:
- `cd C:\VIENNA`
- `Remove-Item -Recurse -Force .venv` (if it exists)
- `py -3.12 -m venv .venv`
- `.\.venv\Scripts\pip install -r requirements-people-counter.txt`

3) Run the server:
- `.\.venv\Scripts\python people_counter_server.py`

4) Open in browser:
- `http://127.0.0.1:5000`

## Better people detection (YOLO)
The backend now supports a more reliable **YOLO (ONNX + OpenCV DNN)** detector.

- Default: uses YOLO if available (downloads the model on first run).
- Fallback: if YOLO fails for any reason, it falls back to the older HOG detector.

Environment variables:
- `VIENNA_DETECTOR=yolo` or `VIENNA_DETECTOR=hog`
- `VIENNA_YOLO_MODEL_PATH` (default: `C:\VIENNA\models\yolov5n.onnx`)
- `VIENNA_YOLO_MODEL_URL` (default: Ultralytics asset URL)
- `VIENNA_YOLO_CONF` (default: `0.35`)
- `VIENNA_YOLO_IOU` (default: `0.45`)

Note: the default YOLOv5 model is from Ultralytics and is **AGPL-3.0** licensed.

## Files
- `people_counter_server.py` (Flask server + /count endpoint)
- `people_counter_web/people_counter.html` (camera UI)
- `people_counter_web/people_counter.js` (captures frames + draws boxes)
- `people_counter_web/people_counter.css` (UI styles)
