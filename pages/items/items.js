(function(){
  async function initializeAddItems(){
    const itemForm = document.getElementById('item-form');
    if (!itemForm) return;

    const itemIdInput = document.getElementById('item-id');
    const nameInput = document.getElementById('item-name');
    const descInput = document.getElementById('item-description');
    const imageInput = document.getElementById('item-image');
    const dropZone = document.getElementById('drop-zone');
    const previewContainer = document.getElementById('image-preview-container');
    const itemsList = document.getElementById('items-list');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const qrInput = document.getElementById('item-qrcode');
    const itemsCountEl = document.getElementById('itemsCount');

    let items = [];
    let currentImageData = null;

    const ensureSupabase = async () => {
      if (!(window.SupabaseSvc && SupabaseSvc.ensureReady)) {
        throw new Error('Supabase client not loaded');
      }
      await SupabaseSvc.ensureReady();
    };

    const loadItems = async () => {
      await ensureSupabase();
      items = await SupabaseSvc.listItems(500);
      if (itemsCountEl) itemsCountEl.textContent = String(items.length);
    };

    const qrModal = document.getElementById('qr-scanner-modal');
    const qrVideo = document.getElementById('qr-video');
    const qrResult = document.getElementById('qr-result');
    const scanBtn = document.getElementById('scan-qr-btn');
    let scanningStream = null;
    let scanAnimationId = null;
    const canvas = document.createElement('canvas');
    const canvasCtx = canvas.getContext
      ? (canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d'))
      : null;

    const stopScan = () => {
      if (scanAnimationId) cancelAnimationFrame(scanAnimationId);
      scanAnimationId = null;
      if (scanningStream) {
        scanningStream.getTracks().forEach(t => t.stop());
        scanningStream = null;
      }
      if (qrVideo) {
        qrVideo.pause();
        qrVideo.srcObject = null;
      }
    };

    const startScan = async () => {
      if (!qrResult) return;
      qrResult.textContent = 'جاري الوصول إلى الكاميرا...';
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        scanningStream = stream;
        qrVideo.srcObject = stream;
        await qrVideo.play();
        const scanLoop = () => {
          if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
            canvas.width = qrVideo.videoWidth;
            canvas.height = qrVideo.videoHeight;
            if (canvasCtx) canvasCtx.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);
            try {
              const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code) {
                qrResult.textContent = `تم العثور على الرمز: ${code.data}`;
                qrInput.value = code.data;
                stopScan();
                qrModal.style.display = 'none';
                return;
              }
              qrResult.textContent = 'لم يتم العثور على رمز بعد...';
            } catch {}
          }
          scanAnimationId = requestAnimationFrame(scanLoop);
        };
        scanLoop();
      } catch (e) {
        qrResult.textContent = 'خطأ في الوصول إلى الكاميرا';
      }
    };

    if (scanBtn) scanBtn.addEventListener('click', () => { qrModal.style.display = 'block'; startScan(); });
    const qrCloseBtns = qrModal ? qrModal.querySelectorAll('.close-btn') : [];
    qrCloseBtns.forEach(b => b.addEventListener('click', () => { stopScan(); qrModal.style.display = 'none'; }));
    window.addEventListener('click', (e) => { if (qrModal && e.target === qrModal) { stopScan(); qrModal.style.display = 'none'; } });

    let currentFilter = '';
    const itemsSearchInput = document.getElementById('items-search');
    if (itemsSearchInput) {
      itemsSearchInput.addEventListener('input', (e) => {
        currentFilter = e.target.value.trim();
        renderItems(currentFilter);
      });
    }

    const setImagePreview = (dataUrl) => {
      previewContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = dataUrl;
      previewContainer.appendChild(img);
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-image-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        imageInput.value = '';
        currentImageData = null;
        clearImagePreview();
      });
      previewContainer.appendChild(removeBtn);
      previewContainer.style.display = 'block';
      dropZone.classList.add('has-image');
    };

    const clearImagePreview = () => {
      previewContainer.innerHTML = '';
      previewContainer.style.display = 'none';
      dropZone.classList.remove('has-image');
    };

    const handleImageFile = (file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        currentImageData = ev.target.result;
        setImagePreview(currentImageData);
      };
      reader.readAsDataURL(file);
    };

    dropZone.addEventListener('click', () => imageInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleImageFile(file);
    });
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleImageFile(file);
    });

    const renderItems = (query = '') => {
      itemsList.innerHTML = '';
      const q = (query || '').toLowerCase().trim();
      const filtered = items.filter(item => {
        if (!q) return true;
        return (item.name && item.name.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.qrcode && item.qrcode.toLowerCase().includes(q));
      });

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = q ? 'لا توجد أصناف تطابق البحث.' : 'لا توجد أصناف بعد. أضف صنفًا جديدًا من النموذج أعلاه.';
        itemsList.appendChild(empty);
        return;
      }

      filtered.slice().reverse().forEach(item => {
        const imgSrc = item.image_url || item.image || 'https://placehold.co/600x400/bde8f5/0f2854?text=No+Image';
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
          <img src="${imgSrc}" alt="">
          <div class="card-content">
            <h3>${item.name}</h3>
            <p>${item.description || ''}</p>
            <div class="qr-code-info">${item.qrcode || ''}</div>
          </div>
          <div class="card-actions">
            <button class="edit-btn">تعديل</button>
            <button class="delete-btn">حذف</button>
          </div>
        `;

        const editBtn = card.querySelector('.edit-btn');
        const deleteBtn = card.querySelector('.delete-btn');

        editBtn.addEventListener('click', () => {
          itemIdInput.value = item.id;
          nameInput.value = item.name || '';
          descInput.value = item.description || '';
          qrInput.value = item.qrcode || '';
          const existingImg = item.image_url || item.image || null;
          if (existingImg) { setImagePreview(existingImg); currentImageData = existingImg; } else { clearImagePreview(); }
          cancelEditBtn.style.display = 'inline-block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        deleteBtn.addEventListener('click', async () => {
          if (!confirm('هل تريد حذف هذا الصنف؟')) return;
          try {
            await ensureSupabase();
            await SupabaseSvc.deleteItem(item.id);
            await loadItems();
            renderItems(currentFilter);
            if (window.Vienna && Vienna.toast) Vienna.toast('تم حذف الصنف.', 'info');
          } catch (e) {
            console.error(e);
            if (window.Vienna && Vienna.toast) Vienna.toast('تعذر حذف الصنف. تحقق من الاتصال والصلاحيات.', 'error');
          }
        });

        itemsList.appendChild(card);
      });
    };

    cancelEditBtn.addEventListener('click', () => {
      itemForm.reset();
      itemIdInput.value = '';
      currentImageData = null;
      clearImagePreview();
      cancelEditBtn.style.display = 'none';
    });

    itemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) { alert('الرجاء إدخال اسم الصنف.'); return; }

      const patch = {
        name,
        description: descInput.value.trim() || null,
        image_url: currentImageData || null,
        qrcode: (qrInput.value || '').trim() || null,
      };

      try {
        await ensureSupabase();
        const existingId = (itemIdInput.value || '').trim();
        if (existingId) {
          await SupabaseSvc.updateItem(existingId, patch);
        } else {
          await SupabaseSvc.createItem(patch);
        }

        await loadItems();
        itemForm.reset();
        itemIdInput.value = '';
        currentImageData = null;
        clearImagePreview();
        cancelEditBtn.style.display = 'none';
        renderItems(currentFilter);

        if (window.Vienna && Vienna.toast) Vienna.toast('تم حفظ الصنف بنجاح.', 'success');
      } catch (e2) {
        console.error(e2);
        const msg = String(e2?.message || e2?.error_description || e2?.details || e2 || '').trim();
        if (window.Vienna && Vienna.toast) {
          Vienna.toast(msg ? `تعذر حفظ الصنف: ${msg}` : 'تعذر حفظ الصنف. تحقق من الاتصال والصلاحيات.', 'error');
        }
      }
    });

    try {
      await loadItems();
      renderItems('');
    } catch (e) {
      console.error(e);
      itemsList.innerHTML = '<div class="empty-state">لا يمكن تحميل الأصناف. تأكد من إعداد Supabase.</div>';
      if (window.Vienna && Vienna.toast) Vienna.toast('Supabase غير جاهز. لا يمكن تحميل الأصناف.', 'error');
    }
  }

  initializeAddItems();
})();
