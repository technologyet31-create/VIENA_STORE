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

## Files
- `people_counter_server.py` (Flask server + /count endpoint)
- `people_counter_web/people_counter.html` (camera UI)
- `people_counter_web/people_counter.js` (captures frames + draws boxes)
- `people_counter_web/people_counter.css` (UI styles)
