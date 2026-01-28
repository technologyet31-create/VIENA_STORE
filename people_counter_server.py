from __future__ import annotations

import base64
import io
import os
import urllib.request
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

    # --- YOLO (OpenCV DNN + ONNX) ---
    # This provides much better results than HOG for most webcam scenes.
    # Default model is YOLOv5n (COCO) exported to ONNX.
    # Licensing note: Ultralytics YOLOv5 is AGPL-3.0.
    yolo_net = None

    def _default_model_path() -> str:
        return os.path.join(ROOT_DIR, "models", "yolov5n.onnx")

    def _ensure_model_file(model_path: str, url: str) -> None:
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        if os.path.exists(model_path) and os.path.getsize(model_path) > 1024 * 1024:
            return
        tmp = model_path + ".download"
        urllib.request.urlretrieve(url, tmp)
        os.replace(tmp, model_path)

    def _get_yolo_net() -> Any:
        nonlocal yolo_net
        if yolo_net is not None:
            return yolo_net

        model_path = os.environ.get("VIENNA_YOLO_MODEL_PATH", _default_model_path())
        model_url = os.environ.get(
            "VIENNA_YOLO_MODEL_URL",
            # Stronger default model (better accuracy than yolov5n, slower).
            "https://github.com/ultralytics/yolov5/releases/download/v7.0/yolov5s.onnx",
        )
        if not os.path.exists(model_path):
            _ensure_model_file(model_path, model_url)

        net = cv2.dnn.readNetFromONNX(model_path)
        # Prefer CPU (works everywhere). Users with OpenCV CUDA builds can override.
        try:
            net.setPreferableBackend(getattr(cv2.dnn, "DNN_BACKEND_OPENCV"))
            net.setPreferableTarget(getattr(cv2.dnn, "DNN_TARGET_CPU"))
        except Exception:
            pass

        yolo_net = net
        return yolo_net

    def _letterbox(image: Any, new_shape: Tuple[int, int] = (640, 640)) -> Tuple[Any, float, Tuple[int, int]]:
        # Resize with padding to preserve aspect ratio.
        ih, iw = image.shape[:2]
        nh, nw = new_shape
        r = min(nw / float(iw), nh / float(ih))
        new_unpad = (int(round(iw * r)), int(round(ih * r)))
        dw = nw - new_unpad[0]
        dh = nh - new_unpad[1]
        dw //= 2
        dh //= 2

        resized = cv2.resize(image, new_unpad, interpolation=cv2.INTER_LINEAR)
        canvas = np.full((nh, nw, 3), 114, dtype=np.uint8)
        canvas[dh : dh + new_unpad[1], dw : dw + new_unpad[0]] = resized
        return canvas, r, (dw, dh)

    def _parse_yolo_output(out: Any) -> Any:
        # Normalize common YOLO ONNX output layouts into shape (N, D).
        arr = out
        if isinstance(arr, (list, tuple)):
            arr = arr[0]
        arr = np.asarray(arr)
        if arr.ndim == 3:
            arr = arr[0]
        # Common YOLOv8: (84, 8400) -> transpose to (8400, 84)
        if arr.ndim == 2 and arr.shape[0] in (84, 85) and arr.shape[1] > arr.shape[0]:
            arr = arr.T
        # Some exports: (1, 8400, 84)
        if arr.ndim == 2:
            return arr
        return arr.reshape(-1, arr.shape[-1])

    def detect_people_yolo(img: Any, conf_threshold: float = 0.35, iou_threshold: float = 0.45) -> Tuple[List[Box], List[float]]:
        # COCO person class id is 0
        person_class = 0

        net = _get_yolo_net()
        padded, r, (dw, dh) = _letterbox(img, (640, 640))

        blob = cv2.dnn.blobFromImage(padded, scalefactor=1.0 / 255.0, size=(640, 640), swapRB=True, crop=False)
        net.setInput(blob)
        out = net.forward()

        det = _parse_yolo_output(out)

        boxes: List[Box] = []
        scores: List[float] = []

        for row in det:
            if row.shape[0] < 6:
                continue
            cx, cy, w, h = float(row[0]), float(row[1]), float(row[2]), float(row[3])

            # YOLOv5 style: [cx, cy, w, h, obj, 80 classes]
            # YOLOv8 style: [cx, cy, w, h, 80 classes]
            if row.shape[0] == 85:
                obj = float(row[4])
                cls_scores = row[5:]
                cls = float(cls_scores[person_class]) if person_class < len(cls_scores) else 0.0
                score = obj * cls
            else:
                cls_scores = row[4:]
                cls = float(cls_scores[person_class]) if person_class < len(cls_scores) else 0.0
                score = cls

            if score < conf_threshold:
                continue

            # Convert from padded 640x640 coords -> original image coords
            x1 = cx - w / 2.0
            y1 = cy - h / 2.0
            x2 = cx + w / 2.0
            y2 = cy + h / 2.0

            # Remove letterbox padding then scale back
            x1 = (x1 - dw) / r
            y1 = (y1 - dh) / r
            x2 = (x2 - dw) / r
            y2 = (y2 - dh) / r

            x1i = int(max(0, round(x1)))
            y1i = int(max(0, round(y1)))
            x2i = int(min(img.shape[1] - 1, round(x2)))
            y2i = int(min(img.shape[0] - 1, round(y2)))
            ww = max(0, x2i - x1i)
            hh = max(0, y2i - y1i)
            if ww < 8 or hh < 8:
                continue

            boxes.append(Box(x=x1i, y=y1i, w=ww, h=hh))
            scores.append(float(score))

        keep = _nms(boxes, scores, iou_threshold=iou_threshold)
        filtered_boxes = [boxes[i] for i in keep]
        filtered_scores = [scores[i] for i in keep]
        return filtered_boxes, filtered_scores

    ROOT_DIR = os.path.dirname(__file__)
    WEB_DIR = os.path.join(ROOT_DIR, "people_counter_web")

    @app.get("/")
    def index():
        return send_from_directory(WEB_DIR, "people_counter.html")

    # Serve shared app assets so the counter page can reuse your theme.
    @app.get("/mainColors.css")
    def main_colors():
        return send_from_directory(ROOT_DIR, "mainColors.css")

    @app.get("/assets/<path:filename>")
    def app_assets(filename: str):
        return send_from_directory(os.path.join(ROOT_DIR, "assets"), filename)

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
        # Allow client to request a max width (e.g., 640/960/1280) for accuracy/perf tradeoff.
        # Clamp to sane limits so a huge request doesn't freeze the server.
        try:
            requested_w = request.form.get("max_w")
            if requested_w is None:
                requested_w = request.args.get("max_w")
            target_w = int(requested_w) if requested_w else int(os.environ.get("VIENNA_MAX_WIDTH", "960"))
        except Exception:
            target_w = 960
        target_w = max(480, min(1600, target_w))
        if w > target_w:
            scale = target_w / float(w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        detector = os.environ.get("VIENNA_DETECTOR", "yolo").strip().lower()
        warning = None

        if detector == "yolo":
            try:
                conf = float(os.environ.get("VIENNA_YOLO_CONF", "0.25"))
                iou = float(os.environ.get("VIENNA_YOLO_IOU", "0.45"))
                filtered, scores = detect_people_yolo(img, conf_threshold=conf, iou_threshold=iou)
            except Exception as e:
                # Fall back to HOG so the system keeps working.
                warning = f"YOLO failed; falling back to HOG: {type(e).__name__}"
                detector = "hog"
                filtered = []
                scores = []
        else:
            filtered = []
            scores = []

        if detector == "hog":
            # HOG detector parameters (more sensitive than defaults, still fast).
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
            scores = [scores[i] for i in keep]

        resp: dict[str, Any] = {
            "ok": True,
            "detector": detector,
            "count": len(filtered),
            "boxes": [{"x": b.x, "y": b.y, "w": b.w, "h": b.h} for b in filtered],
            "scores": [float(s) for s in scores],
        }
        if warning:
            resp["warning"] = warning

        return jsonify(resp)

    return app


if __name__ == "__main__":
    # Camera access works on http://localhost in most browsers.
    app = create_app()
    # Flask's reloader spawns a child process (often confusing on Windows).
    # Keep debug pages, but disable the reloader by default for stability.
    debug = os.environ.get("VIENNA_DEBUG", "1") == "1"
    use_reloader = os.environ.get("VIENNA_RELOAD", "0") == "1"
    app.run(host="127.0.0.1", port=5000, debug=debug, use_reloader=use_reloader)
