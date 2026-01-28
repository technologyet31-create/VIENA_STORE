from __future__ import annotations

import base64
import io
import os
from dataclasses import dataclass
from typing import Any, Iterable, List, Tuple, cast

from flask import Flask, jsonify, request, send_from_directory


# --- Simple People Counter (HOG) ---
# Notes:
# - Uses OpenCV's built-in HOG people detector (no extra model files needed).
# - Works best with full-body views; accuracy is limited vs modern YOLO models.


@dataclass(frozen=True)
class Box:
    x: int
    y: int
    w: int
    h: int


def _nms(boxes: List[Box], scores: List[float], iou_threshold: float = 0.35) -> List[int]:
    # Basic Non-Max Suppression for overlapping HOG detections.
    if not boxes:
        return []

    def area(b: Box) -> int:
        return max(0, b.w) * max(0, b.h)

    def iou(a: Box, b: Box) -> float:
        ax1, ay1, ax2, ay2 = a.x, a.y, a.x + a.w, a.y + a.h
        bx1, by1, bx2, by2 = b.x, b.y, b.x + b.w, b.y + b.h
        ix1, iy1 = max(ax1, bx1), max(ay1, by1)
        ix2, iy2 = min(ax2, bx2), min(ay2, by2)
        iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
        inter = iw * ih
        union = area(a) + area(b) - inter
        return (inter / union) if union > 0 else 0.0

    idxs = sorted(range(len(boxes)), key=lambda i: scores[i], reverse=True)
    keep: List[int] = []

    while idxs:
        current = idxs.pop(0)
        keep.append(current)
        idxs = [i for i in idxs if iou(boxes[current], boxes[i]) < iou_threshold]

    return keep


def create_app() -> Flask:
    app = Flask(__name__)

    # Lazy imports: keep startup fast and error messages clearer.
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    hog = cv2.HOGDescriptor()
    # cv2 stubs sometimes miss this symbol; use getattr for robustness.
    default_people_detector = getattr(cv2, "HOGDescriptor_getDefaultPeopleDetector")()
    hog.setSVMDetector(default_people_detector)

    WEB_DIR = os.path.join(os.path.dirname(__file__), "people_counter_web")

    @app.get("/")
    def index():
        return send_from_directory(WEB_DIR, "people_counter.html")

    @app.get("/<path:filename>")
    def static_files(filename: str):
        return send_from_directory(WEB_DIR, filename)

    def _decode_image_from_request() -> Any:
        # Accept either multipart form file `frame` or JSON base64 `image`.
        if "frame" in request.files:
            data = request.files["frame"].read()
            arr = np.frombuffer(data, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return img

        payload = request.get_json(silent=True) or {}
        b64 = payload.get("image")
        if isinstance(b64, str) and b64.startswith("data:image"):
            # Strip data URL header if present
            b64 = b64.split(",", 1)[-1]
        if isinstance(b64, str):
            raw = base64.b64decode(b64)
            arr = np.frombuffer(raw, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return img

        return None

    @app.post("/count")
    def count_people():
        img = _decode_image_from_request()
        if img is None:
            return jsonify({"ok": False, "error": "No image provided"}), 400

        # Resize to keep CPU predictable (helps a lot on laptops).
        import cv2  # type: ignore

        h, w = img.shape[:2]
        target_w = 960
        if w > target_w:
            scale = target_w / float(w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        # HOG detector parameters
        # More sensitive settings than defaults (still reasonably fast).
        rects, weights = hog.detectMultiScale(
            img,
            winStride=(6, 6),
            padding=(10, 10),
            scale=1.04,
        )

        boxes: List[Box] = [Box(int(x), int(y), int(ww), int(hh)) for (x, y, ww, hh) in rects]

        # `weights` may be a numpy array or a plain sequence depending on OpenCV build.
        if weights is None:
            scores = [1.0] * len(boxes)
        else:
            try:
                ravel = getattr(weights, "ravel", None)
                if callable(ravel):
                    flat = ravel()
                    tolist = getattr(flat, "tolist", None)
                    seq = tolist() if callable(tolist) else flat
                    scores = [float(s) for s in cast(Iterable[Any], seq)]
                else:
                    scores = [float(s) for s in weights]
            except Exception:
                scores = [1.0] * len(boxes)

        keep = _nms(boxes, scores, iou_threshold=0.35)
        filtered = [boxes[i] for i in keep]

        return jsonify(
            {
                "ok": True,
                "count": len(filtered),
                "boxes": [{"x": b.x, "y": b.y, "w": b.w, "h": b.h} for b in filtered],
            }
        )

    return app


if __name__ == "__main__":
    # Camera access works on http://localhost in most browsers.
    app = create_app()
    app.run(host="127.0.0.1", port=5000, debug=True)
