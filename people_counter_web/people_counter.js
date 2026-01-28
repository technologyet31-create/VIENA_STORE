(function () {
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const capture = document.getElementById('capture');
  const countEl = document.getElementById('count');
  const statusEl = document.getElementById('status');
  const fpsSelect = document.getElementById('fps');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');

  let stream = null;
  let timer = null;
  let inflight = false;
  let lastBoxes = [];

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function resizeOverlayToVideo() {
    const rect = video.getBoundingClientRect();
    overlay.width = Math.max(2, Math.round(rect.width));
    overlay.height = Math.max(2, Math.round(rect.height));
  }

  function drawBoxes(boxes, srcWidth, srcHeight) {
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!boxes || !boxes.length) return;

    // Because we mirror the video element (scaleX(-1)), we also mirror drawings.
    ctx.save();
    ctx.translate(overlay.width, 0);
    ctx.scale(-1, 1);

    const sx = overlay.width / srcWidth;
    const sy = overlay.height / srcHeight;

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(73, 136, 196, 0.95)';
    ctx.fillStyle = 'rgba(73, 136, 196, 0.18)';

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

  async function captureAndSend() {
    if (!stream) return;
    if (inflight) return;
    if (video.readyState < 2) return;

    inflight = true;
    try {
      // Capture at a moderate resolution to keep CPU reasonable.
      const srcW = video.videoWidth || 640;
      const srcH = video.videoHeight || 480;
      const targetW = Math.min(960, srcW);
      const scale = targetW / srcW;
      const targetH = Math.round(srcH * scale);

      capture.width = targetW;
      capture.height = targetH;

      const ctx = capture.getContext('2d');
      // Mirror capture to match the displayed video.
      ctx.save();
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, targetW, targetH);
      ctx.restore();

      const blob = await new Promise((resolve) => capture.toBlob(resolve, 'image/jpeg', 0.75));
      if (!blob) throw new Error('Failed to capture frame');

      const form = new FormData();
      form.append('frame', blob, 'frame.jpg');

      const res = await fetch('/count', { method: 'POST', body: form });
      const data = await res.json();

      if (!data || !data.ok) {
        throw new Error((data && data.error) || 'Server error');
      }

      countEl.textContent = String(data.count);
      lastBoxes = data.boxes || [];
      drawBoxes(lastBoxes, targetW, targetH);
      setStatus('يعمل الآن.');
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

    countEl.textContent = '—';
    setStatus('متوقف.');

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

  window.addEventListener('resize', () => {
    if (!stream) return;
    resizeOverlayToVideo();
    // Re-draw last known boxes so the overlay stays in sync.
    // We don't know the exact src dims here; next tick will update anyway.
  });
})();
