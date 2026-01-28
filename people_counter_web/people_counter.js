(function () {
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const capture = document.getElementById('capture');
  const countPeopleEl = document.getElementById('countPeople');
  const countFacesEl = document.getElementById('countFaces');
  const countHandsEl = document.getElementById('countHands');
  const statusEl = document.getElementById('status');
  const fpsSelect = document.getElementById('fps');
  const qualitySelect = document.getElementById('quality');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');

  let stream = null;
  let timer = null;
  let inflight = false;
  let lastPersonBoxes = [];
  let lastFaceBoxes = [];
  let lastHandBoxes = [];

  let faceBoxesRaw = [];
  let handBoxesRaw = [];

  let mpBusy = false;
  let mpLastError = null;
  let mpInitAttempts = 0;

  // MediaPipe Tasks Vision (more stable than legacy @mediapipe/hands + @mediapipe/face_detection)
  const TASKS_VERSION = '0.10.18';
  const TASKS_WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
  const TASKS_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/vision_bundle.mjs`;

  // NOTE: The face detector model in the public bucket is a .tflite (the .task path 404s).
  const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
  const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

  let mp = null; // module exports from tasks vision
  let mpVision = null; // FilesetResolver result
  let faceDetector = null;
  let handLandmarker = null;
  let mpInitPromise = null;

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function resizeOverlayToVideo() {
    const rect = video.getBoundingClientRect();
    overlay.width = Math.max(2, Math.round(rect.width));
    overlay.height = Math.max(2, Math.round(rect.height));
  }

  function drawBoxes(boxes, srcWidth, srcHeight, style) {
    const ctx = overlay.getContext('2d');
    const { stroke, fill } = style || { stroke: 'rgba(73, 136, 196, 0.95)', fill: 'rgba(73, 136, 196, 0.18)' };

    if (!boxes || !boxes.length) return;

    // Because we mirror the video element (scaleX(-1)), we also mirror drawings.
    ctx.save();
    ctx.translate(overlay.width, 0);
    ctx.scale(-1, 1);

    const sx = overlay.width / srcWidth;
    const sy = overlay.height / srcHeight;

    ctx.lineWidth = 3;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;

    for (const b of boxes) {
      const x = b.x * sx;
      const y = b.y * sy;
      const w = b.w * sx;
      const h = b.h * sy;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }

    ctx.restore();
  }

  function redrawAll(srcWidth, srcHeight) {
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    drawBoxes(lastPersonBoxes, srcWidth, srcHeight, { stroke: 'rgba(73, 136, 196, 0.95)', fill: 'rgba(73, 136, 196, 0.18)' });
    drawBoxes(lastFaceBoxes, srcWidth, srcHeight, { stroke: 'rgba(102, 204, 153, 0.95)', fill: 'rgba(102, 204, 153, 0.16)' });
    drawBoxes(lastHandBoxes, srcWidth, srcHeight, { stroke: 'rgba(255, 179, 102, 0.95)', fill: 'rgba(255, 179, 102, 0.16)' });
  }

  function initMediaPipe() {
    // Not fatal: the main People counter still works via Python.
    if (mpInitPromise) return mpInitPromise;

    mpInitAttempts += 1;
    mpInitPromise = (async () => {
      try {
        mpLastError = null;
        mp = await import(TASKS_BUNDLE_URL);
        mpVision = await mp.FilesetResolver.forVisionTasks(TASKS_WASM_BASE);

        faceDetector = await mp.FaceDetector.createFromOptions(mpVision, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });

        handLandmarker = await mp.HandLandmarker.createFromOptions(mpVision, {
          baseOptions: { modelAssetPath: HAND_MODEL_URL },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (e) {
        mpLastError = String(e && (e.message || e) || e);
        // Allow retry next time.
        mpInitPromise = null;
      }
    })();

    return mpInitPromise;
  }

  function runMediaPipe(imageEl, timestampMs) {
    if (mpBusy) return;
    if ((!faceDetector && !handLandmarker) && mpInitAttempts < 10) {
      // Trigger async init, but don't block frame loop.
      initMediaPipe();
      return;
    }
    if (!faceDetector && !handLandmarker) return;

    mpBusy = true;
    mpLastError = null;

    Promise.resolve()
      .then(() => {
        // Face detector
        if (faceDetector) {
          const resFace = faceDetector.detectForVideo(imageEl, timestampMs);
          const det = (resFace && resFace.detections) || [];
          const boxes = [];
          for (const d of det) {
            const bb = d && d.boundingBox;
            if (!bb) continue;
            boxes.push({
              x: Math.max(0, Math.round(bb.originX || 0)),
              y: Math.max(0, Math.round(bb.originY || 0)),
              w: Math.max(0, Math.round(bb.width || 0)),
              h: Math.max(0, Math.round(bb.height || 0)),
            });
          }
          faceBoxesRaw = boxes;
          if (countFacesEl) countFacesEl.textContent = String(det.length);
        }

        // Hand landmarker
        if (handLandmarker) {
          const resHand = handLandmarker.detectForVideo(imageEl, timestampMs);
          const lm = (resHand && resHand.landmarks) || [];
          const boxes = [];
          for (const hand of lm) {
            let minX = 1, minY = 1, maxX = 0, maxY = 0;
            for (const p of hand) {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x);
              maxY = Math.max(maxY, p.y);
            }
            boxes.push({ x: minX, y: minY, w: (maxX - minX), h: (maxY - minY), normalized: true });
          }
          handBoxesRaw = boxes;
          if (countHandsEl) countHandsEl.textContent = String(lm.length);
        }
      })
      .catch((e) => {
        mpLastError = String(e && (e.message || e) || e);
      })
      .finally(() => {
        mpBusy = false;
      });
  }

  async function captureAndSend() {
    if (!stream) return;
    if (inflight) return;
    if (video.readyState < 2) return;

    inflight = true;
    try {
      // Capture at a moderate resolution to keep CPU reasonable.
      const srcW = video.videoWidth || 640;
      const srcH = video.videoHeight || 480;
      const desiredW = Number((qualitySelect && qualitySelect.value) || 960);
      const targetW = Math.min(Math.max(320, desiredW), srcW);
      const scale = targetW / srcW;
      const targetH = Math.round(srcH * scale);

      capture.width = targetW;
      capture.height = targetH;

      const ctx = capture.getContext('2d');
      // IMPORTANT: capture is NOT mirrored.
      // The video is mirrored only via CSS, and we mirror the overlay drawings instead.
      ctx.drawImage(video, 0, 0, targetW, targetH);

      // Run in-browser Face/Hand detection if available (doesn't block Python request).
      // Use a monotonic timestamp for VIDEO mode.
      runMediaPipe(capture, performance.now());

      const jpegQ = targetW >= 1280 ? 0.88 : 0.82;
      const blob = await new Promise((resolve) => capture.toBlob(resolve, 'image/jpeg', jpegQ));
      if (!blob) throw new Error('Failed to capture frame');

      const form = new FormData();
      form.append('frame', blob, 'frame.jpg');
      form.append('max_w', String(targetW));

      const res = await fetch('/count', { method: 'POST', body: form });
      const data = await res.json();

      if (!data || !data.ok) {
        throw new Error((data && data.error) || 'Server error');
      }

      if (countPeopleEl) countPeopleEl.textContent = String(data.count);
      lastPersonBoxes = data.boxes || [];

      // Convert face/hand boxes (which may be normalized/pixels) into pixel boxes.
      const facePx = (faceBoxesRaw || []).map((b) => {
        const x = (b.x <= 1 && b.w <= 1) ? Math.round(b.x * targetW) : Math.round(b.x);
        const y = (b.y <= 1 && b.h <= 1) ? Math.round(b.y * targetH) : Math.round(b.y);
        const w = (b.x <= 1 && b.w <= 1) ? Math.round(b.w * targetW) : Math.round(b.w);
        const h = (b.y <= 1 && b.h <= 1) ? Math.round(b.h * targetH) : Math.round(b.h);
        return { x, y, w, h };
      });
      const handPx = (handBoxesRaw || []).map((b) => ({
        x: Math.round(b.x * targetW),
        y: Math.round(b.y * targetH),
        w: Math.round(b.w * targetW),
        h: Math.round(b.h * targetH),
      }));
      lastFaceBoxes = facePx;
      lastHandBoxes = handPx;

      redrawAll(targetW, targetH);
      const mpNote = mpLastError ? ` | MediaPipe: ${mpLastError}` : '';
      setStatus(`يعمل الآن. أشخاص: ${data.count} | وجوه: ${countFacesEl?.textContent || '—'} | أيدي: ${countHandsEl?.textContent || '—'}${mpNote}`);
    } catch (err) {
      console.error(err);
      setStatus('تعذر العد. تحقق من تشغيل السيرفر وفتح الصفحة من http://127.0.0.1:5000');
    } finally {
      inflight = false;
    }
  }

  async function start() {
    try {
      setStatus('جاري تشغيل الكاميرا...');
      initMediaPipe();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      video.srcObject = stream;

      btnStart.disabled = true;
      btnStop.disabled = false;

      await new Promise((r) => (video.onloadedmetadata = r));
      resizeOverlayToVideo();

      const fps = Number(fpsSelect.value || 3);
      clearInterval(timer);
      timer = setInterval(captureAndSend, Math.max(200, Math.floor(1000 / fps)));
      setStatus('تم تشغيل الكاميرا.');
    } catch (err) {
      console.error(err);
      setStatus('فشل تشغيل الكاميرا. امنح إذن الكاميرا أو افتح الصفحة عبر localhost.');
      stream = null;
      btnStart.disabled = false;
      btnStop.disabled = true;
    }
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    stream = null;

    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (countPeopleEl) countPeopleEl.textContent = '—';
    if (countFacesEl) countFacesEl.textContent = '—';
    if (countHandsEl) countHandsEl.textContent = '—';
    setStatus('متوقف.');

    try { faceDetector && faceDetector.close && faceDetector.close(); } catch { }
    try { handLandmarker && handLandmarker.close && handLandmarker.close(); } catch { }
    faceDetector = null;
    handLandmarker = null;
    mpInitPromise = null;
    mpLastError = null;

    btnStart.disabled = false;
    btnStop.disabled = true;
  }

  btnStart.addEventListener('click', start);
  btnStop.addEventListener('click', stop);
  fpsSelect.addEventListener('change', () => {
    if (!stream) return;
    const fps = Number(fpsSelect.value || 3);
    clearInterval(timer);
    timer = setInterval(captureAndSend, Math.max(200, Math.floor(1000 / fps)));
  });

  if (qualitySelect) {
    qualitySelect.addEventListener('change', () => {
      // Quality affects capture resolution; next tick uses the new value.
    });
  }

  window.addEventListener('resize', () => {
    if (!stream) return;
    resizeOverlayToVideo();
    // Next tick will redraw with correct scaling.
  });
})();
