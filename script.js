document.addEventListener('DOMContentLoaded', () => {
    // --- Sidebar and Navigation Logic ---
    const toggleBtn = document.getElementById('toggle-btn');
    const body = document.body;
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const MOBILE_BP = 1023;
    const navLinks = document.querySelectorAll('.nav-link, .sidebar-link');
    const pages = document.querySelectorAll('.page');

    const setActivePage = (pageId) => {
        const targetPage = document.getElementById(pageId);
        if (!targetPage) return;

        // update nav link active state
        navLinks.forEach(l => l.classList.toggle('active', l.dataset.page === pageId));

        const current = document.querySelector('.page.active');
        if (current === targetPage) {
            // already active
            document.dispatchEvent(new CustomEvent('page-activated', { detail: { pageId } }));
            return;
        }

        // Prepare target for entering
        targetPage.style.display = 'block';
        targetPage.classList.add('page-enter');

        // Animate current page out
        if (current) {
            current.classList.add('page-exit');
            const onCurrentEnd = () => {
                current.removeEventListener('animationend', onCurrentEnd);
                current.classList.remove('page-exit', 'active');
                current.style.display = 'none';
            };
            current.addEventListener('animationend', onCurrentEnd);
        }

        // When target finish entering, finalize active state
        const onTargetEnd = () => {
            targetPage.removeEventListener('animationend', onTargetEnd);
            targetPage.classList.remove('page-enter');
            // remove active from others, set this active
            pages.forEach(p => p.classList.remove('active'));
            targetPage.classList.add('active');
            document.dispatchEvent(new CustomEvent('page-activated', { detail: { pageId } }));
        };
        targetPage.addEventListener('animationend', onTargetEnd);
    };

    // create overlay element for small screens
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    // Floating open button for mobile (since the sidebar is off-canvas)
    let mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (!mobileMenuBtn) {
        mobileMenuBtn = document.createElement('button');
        mobileMenuBtn.id = 'mobile-menu-btn';
        mobileMenuBtn.className = 'mobile-menu-btn';
        mobileMenuBtn.type = 'button';
        mobileMenuBtn.setAttribute('aria-label', 'فتح القائمة');
        mobileMenuBtn.innerHTML = '☰';
        document.body.appendChild(mobileMenuBtn);
    }

    const closeBtn = document.querySelector('.sidebar-close');
    const setExpanded = (expanded) => {
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(expanded));
        if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', String(expanded));
    };
    const closeSidebarOverlay = () => {
        body.classList.remove('sidebar-open');
        overlay.style.display = 'none';
        setExpanded(false);
    };
    if (closeBtn) closeBtn.addEventListener('click', closeSidebarOverlay);

    const toggleSidebar = () => {
        // small screens: open as overlay
        if (window.innerWidth <= MOBILE_BP) {
            const opened = body.classList.toggle('sidebar-open');
            if (!opened) overlay.style.display = 'none';
            else overlay.style.display = '';
            setExpanded(opened);
            return;
        }

        // desktop: collapse/expand
        const collapsed = body.classList.toggle('sidebar-collapsed');
        setExpanded(!collapsed);
        try { localStorage.setItem('vienna-sidebar-collapsed', collapsed ? '1' : '0'); } catch(e){}
    };

    if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleSidebar);

    // double-click sidebar header to toggle
    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) sidebarHeader.addEventListener('dblclick', () => toggleSidebar());

    // keyboard shortcut to toggle sidebar (Ctrl+B)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && body.classList.contains('sidebar-open')) {
            closeSidebarOverlay();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
            e.preventDefault();
            toggleSidebar();
        }
    });

    // respect saved state and window width on load
    const applySavedSidebarState = () => {
        try {
            const saved = localStorage.getItem('vienna-sidebar-collapsed');
            if (window.innerWidth > MOBILE_BP) {
                if (saved === '1') body.classList.add('sidebar-collapsed'); else body.classList.remove('sidebar-collapsed');
                body.classList.remove('sidebar-open');
                overlay && (overlay.style.display = 'none');
            } else {
                // on small screens ensure overlay is hidden until user opens sidebar
                body.classList.remove('sidebar-collapsed');
                body.classList.remove('sidebar-open');
                overlay && (overlay.style.display = 'none');
            }
            // aria-expanded means: overlay open on mobile, not-collapsed on desktop
            if (window.innerWidth <= MOBILE_BP) setExpanded(body.classList.contains('sidebar-open'));
            else setExpanded(!body.classList.contains('sidebar-collapsed'));
        } catch (err) { }
    };
    applySavedSidebarState();
    window.addEventListener('resize', applySavedSidebarState);

    // Highlight active sidebar link by matching pathname
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        try {
            const linkUrl = new URL(link.href, location.href);
            if (linkUrl.pathname === location.pathname || link.classList.contains('active')) {
                sidebarLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        } catch (e) {}
    });

    // navLinks: only intercept if link has data-page (SPA in-page navigation). Otherwise allow normal navigation.
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const page = link.dataset.page;
            if (page) {
                e.preventDefault();
                setActivePage(page);
            } else {
                // if small-screen overlay open, close when navigating
                if (body.classList.contains('sidebar-open')) {
                    closeSidebarOverlay();
                }
            }
        });
    });

    // clicking overlay closes sidebar on small screens
    overlay.addEventListener('click', () => {
        closeSidebarOverlay();
    });

    // Multi-page navigation transitions (keep content, just animate on leave)
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.addEventListener('click', (e) => {
        const link = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!link) return;
        if (e.defaultPrevented) return;
        if (e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (link.target === '_blank' || link.hasAttribute('download')) return;
        if (link.dataset && link.dataset.page) return; // SPA-internal
        if (prefersReducedMotion) return;

        let url;
        try { url = new URL(link.href, location.href); } catch { return; }
        if (url.origin !== location.origin) return;
        // allow same-page hash jumps
        if (url.pathname === location.pathname && url.search === location.search && url.hash) return;

        e.preventDefault();
        if (body.classList.contains('sidebar-open')) closeSidebarOverlay();
        body.classList.add('page-leave');
        setTimeout(() => { location.href = link.href; }, 180);
    }, true);

    // --- Page Logic Initialization ---
    // (Logic for 'add-items' is omitted for brevity but remains functional)
    document.addEventListener('page-activated', (e) => {
        if (e.detail.pageId === 'procurement') {
            initializeProcurementPage();
        }
    });
    document.addEventListener('page-activated', (e) => {
        if (e.detail.pageId === 'add-items') {
            initializeAddItems();
        }
    });
    document.addEventListener('page-activated', (e) => {
        if (e.detail.pageId === 'dashboard') initializeDashboard();
        if (e.detail.pageId === 'inventory') initializeInventory();
    });
    
    // SPA mode only: set initial active page if present
    if (document.getElementById('dashboard')) setActivePage('dashboard');
});

function initializeAddItems() {
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

    let items = JSON.parse(localStorage.getItem('vienna-items')) || [];
    let currentImageData = null;
    // QR scanner elements
    const qrModal = document.getElementById('qr-scanner-modal');
    const qrVideo = document.getElementById('qr-video');
    const qrResult = document.getElementById('qr-result');
    const scanBtn = document.getElementById('scan-qr-btn');
    let scanningStream = null;
    let scanAnimationId = null;
    const canvas = document.createElement('canvas');
    const canvasCtx = canvas.getContext && canvas.getContext('2d');

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
                        } else {
                            qrResult.textContent = 'لم يتم العثور على رمز بعد...';
                        }
                    } catch (err) {
                        // ignore canvas read errors on some browsers until video ready
                    }
                }
                scanAnimationId = requestAnimationFrame(scanLoop);
            };
            scanLoop();
        } catch (err) {
            qrResult.textContent = 'خطأ في الوصول إلى الكاميرا';
            console.error('QR scan error', err);
        }
    };

    if (scanBtn) {
        scanBtn.addEventListener('click', () => {
            qrModal.style.display = 'block';
            startScan();
        });
    }

    // Close buttons and outside click
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
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <img src="${item.image || 'https://placehold.co/600x400/bde8f5/0f2854?text=No+Image'}" alt="">
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
                nameInput.value = item.name;
                descInput.value = item.description || '';
                qrInput.value = item.qrcode || '';
                if (item.image) {
                    setImagePreview(item.image);
                    currentImageData = item.image;
                } else {
                    clearImagePreview();
                }
                cancelEditBtn.style.display = 'inline-block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            deleteBtn.addEventListener('click', () => {
                if (!confirm('هل تريد حذف هذا الصنف؟')) return;
                items = items.filter(i => i.id !== item.id);
                localStorage.setItem('vienna-items', JSON.stringify(items));
                renderItems(currentFilter);
            });

            itemsList.appendChild(card);
        });
    };

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

    dropZone.addEventListener('click', () => imageInput.click());

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleImageFile(file);
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleImageFile(file);
    });

    const handleImageFile = (file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            currentImageData = ev.target.result;
            setImagePreview(currentImageData);
        };
        reader.readAsDataURL(file);
    };

    cancelEditBtn.addEventListener('click', () => {
        itemForm.reset();
        itemIdInput.value = '';
        currentImageData = null;
        clearImagePreview();
        cancelEditBtn.style.display = 'none';
    });

    itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) { alert('الرجاء إدخال اسم الصنف.'); return; }

        const id = itemIdInput.value ? parseInt(itemIdInput.value, 10) : Date.now();
        const existingIndex = items.findIndex(i => i.id === id);
        const newItem = {
            id,
            name,
            description: descInput.value.trim(),
            image: currentImageData,
            qrcode: qrInput.value.trim()
        };

        if (existingIndex >= 0) items[existingIndex] = newItem;
        else items.push(newItem);

        localStorage.setItem('vienna-items', JSON.stringify(items));
        itemForm.reset();
        itemIdInput.value = '';
        currentImageData = null;
        clearImagePreview();
        cancelEditBtn.style.display = 'none';
        renderItems(currentFilter);
        // small UX highlight
        const flash = document.createElement('div');
        flash.className = 'item-added-flash';
        flash.textContent = 'تم الحفظ';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 1400);
    });

    // initial render
    renderItems(currentFilter);
}

function initializeProcurementPage() {
    const billForm = document.getElementById('bill-form');
    if (!billForm) return; // Already initialized or not on the right page

    const billItemsContainer = document.getElementById('bill-items-container');
    const addBillItemBtn = document.getElementById('add-bill-item-btn');
    const billTotalEl = document.getElementById('bill-total');
    const amountPaidInput = document.getElementById('amount-paid');
    const billRemainingEl = document.getElementById('bill-remaining');
    const recentBillsList = document.getElementById('recent-bills-list');
    const billSearchInput = document.getElementById('bill-search');
    const billDetailsContainer = document.getElementById('bill-details-container');
    const billDetailsTitle = document.getElementById('bill-details-title');
    const billDetailsContent = document.getElementById('bill-details-content');
    
    const itemSearchModal = document.getElementById('item-search-modal');
    const itemSearchInput = document.getElementById('item-search-input');
    const itemSearchResults = document.getElementById('item-search-results');
    const closeItemSearchBtn = itemSearchModal.querySelector('.close-btn');
    
    let currentItemRow = null;
    // items will be read from localStorage on-demand so changes in add-items are immediately available
    let bills = JSON.parse(localStorage.getItem('vienna-bills')) || [];

    const calculateTotals = () => {
        let total = 0;
        billItemsContainer.querySelectorAll('.bill-item-row').forEach(row => {
            let qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            let price = parseFloat(row.querySelector('.item-buy-price').value) || 0;
            // enforce basic validation/clamping
            if (qty < 0) qty = 0;
            if (!Number.isFinite(qty)) qty = 0;
            // quantities should be integers
            qty = Math.floor(qty);
            row.querySelector('.item-qty').value = qty;
            if (price < 0) price = 0;
            if (!Number.isFinite(price)) price = 0;
            row.querySelector('.item-buy-price').value = price;
            const subtotal = qty * price;
            row.querySelector('.item-subtotal').textContent = subtotal.toFixed(2);
            total += subtotal;
        });
        billTotalEl.textContent = total.toFixed(2);
        
        const paid = parseFloat(amountPaidInput.value) || 0;
        const remaining = total - paid;
        billRemainingEl.textContent = remaining.toFixed(2);
        billRemainingEl.style.color = remaining < 0 ? 'var(--dark-blue)' : '#e74c3c';
    };

    const createBillItemRow = () => {
        const row = document.createElement('div');
        row.className = 'bill-item-row';
        const itemsLocal = JSON.parse(localStorage.getItem('vienna-items')) || [];
        const recentItems = itemsLocal.slice(-5);
        const options = recentItems.map(item => `<option value="${item.id}">${item.name}</option>`).join('');

        row.innerHTML = `
            <div class="form-group">
                <div class="item-select-wrapper">
                    <select class="item-select">
                        <option value="">اختر صنف...</option>
                        ${options}
                    </select>
                    <button type="button" class="more-items-btn">المزيد</button>
                </div>
            </div>
            <div class="form-group"><input type="number" class="item-qty" placeholder="الكمية" min="1" value="1"></div>
            <div class="form-group"><input type="number" class="item-buy-price" placeholder="سعر الشراء" min="0" step="0.01"></div>
            <div class="form-group"><input type="number" class="item-sell-price" placeholder="سعر البيع" min="0" step="0.01"></div>
            <div class="subtotal-group">
                <span class="item-subtotal">0.00</span>
                <button type="button" class="remove-item-row-btn">&times;</button>
            </div>
        `;

        row.querySelector('.remove-item-row-btn').addEventListener('click', () => {
            row.style.animation = 'slideOut 0.4s ease-out forwards';
            row.addEventListener('animationend', () => { row.remove(); calculateTotals(); });
        });
        
        row.querySelector('.more-items-btn').addEventListener('click', () => {
            currentItemRow = row;
            itemSearchModal.style.display = 'block';
            renderItemSearchResults('');
        });

        row.querySelector('.item-select').addEventListener('change', () => row.querySelector('.item-buy-price').focus());
        // validation for quantity and prices
        const qtyInput = row.querySelector('.item-qty');
        const buyInput = row.querySelector('.item-buy-price');
        const sellInput = row.querySelector('.item-sell-price');
        const ensurePositiveInteger = (el) => {
            let v = parseFloat(el.value) || 0;
            if (!Number.isFinite(v) || v < 0) v = 0;
            v = Math.floor(v);
            el.value = v;
        };
        qtyInput.addEventListener('input', () => { ensurePositiveInteger(qtyInput); calculateTotals(); });
        buyInput.addEventListener('input', () => { if (parseFloat(buyInput.value) < 0) buyInput.value = 0; calculateTotals(); });
        sellInput.addEventListener('input', () => { if (parseFloat(sellInput.value) < 0) sellInput.value = 0; calculateTotals(); });
        
        billItemsContainer.appendChild(row);
        row.scrollIntoView({ behavior: 'smooth', block: 'end' });
        return row;
    };

    const renderBillDetails = (bill) => {
        billDetailsTitle.textContent = `تفاصيل الفاتورة #${bill.id}`;
        const itemsTable = `
            <table>
                <thead>
                    <tr>
                        <th>الصنف</th>
                        <th>الكمية</th>
                        <th>سعر الشراء</th>
                        <th>الإجمالي الجزئي</th>
                    </tr>
                </thead>
                <tbody>
                    ${bill.items.map(item => `
                        <tr>
                            <td>${item.itemName}</td>
                            <td>${item.qty}</td>
                            <td>${item.buyPrice.toFixed(2)}</td>
                            <td>${(item.qty * item.buyPrice).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        const summaryDetails = `
            <div id="bill-details-summary">
                 <div>
                    <div class="summary-row"><span>الإجمالي:</span><span>${bill.total.toFixed(2)}</span></div>
                    <div class="summary-row"><span>المدفوع:</span><span>${bill.paid.toFixed(2)}</span></div>
                    <div class="summary-row remaining"><span>المتبقي:</span><span>${bill.remaining.toFixed(2)}</span></div>
                    <div class="summary-row"><span>طريقة الدفع:</span><span>${bill.paymentMethod === 'cash' ? 'نقدي' : 'بطاقة'}</span></div>
                    <div class="summary-row"><span>التاريخ:</span><span>${new Date(bill.date).toLocaleString()}</span></div>
                 </div>
            </div>
        `;
        billDetailsContent.innerHTML = itemsTable + summaryDetails;
        billDetailsContainer.style.display = 'block';
        billDetailsContainer.scrollIntoView({ behavior: 'smooth' });
    };
    
    const renderRecentBills = (filterQuery = '') => {
        recentBillsList.innerHTML = '';
        const filteredBills = bills.filter(bill => bill.id.toString().includes(filterQuery)).slice(-10).reverse();
        
        if(filteredBills.length === 0) {
            recentBillsList.innerHTML = '<p>لا توجد فواتير تطابق البحث.</p>';
            return;
        }
        filteredBills.forEach(bill => {
            const card = document.createElement('div');
            card.className = 'recent-bill-card';
            card.dataset.billId = bill.id;
            card.innerHTML = `
                <strong>فاتورة #${bill.id}</strong>
                <span>${new Date(bill.date).toLocaleDateString()}</span>
            `;
            card.addEventListener('click', () => {
                document.querySelectorAll('.recent-bill-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                renderBillDetails(bill);
            });
            recentBillsList.appendChild(card);
        });
    };

    const renderItemSearchResults = (query) => {
        itemSearchResults.innerHTML = '';
        const itemsLocal = JSON.parse(localStorage.getItem('vienna-items')) || [];
        const filteredItems = itemsLocal.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
        filteredItems.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'search-result-item';
            itemEl.innerHTML = `<img src="${item.image || 'https://placehold.co/100x100/bde8f5/0f2854?text=??'}" alt=""> <span>${item.name}</span>`;
            itemEl.addEventListener('click', () => {
                if (currentItemRow) {
                    const select = currentItemRow.querySelector('.item-select');
                    if (!select.querySelector(`option[value="${item.id}"]`)) {
                        select.add(new Option(item.name, item.id, true, true));
                    }
                    select.value = item.id;
                    currentItemRow.querySelector('.item-buy-price').focus();
                }
                itemSearchModal.style.display = 'none';
            });
            itemSearchResults.appendChild(itemEl);
        });
    };

    billForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const billItems = [];
        let valid = true;
        billItemsContainer.querySelectorAll('.bill-item-row').forEach(row => {
            const itemId = row.querySelector('.item-select').value;
            if(!itemId) { valid = false; return; }
            const qty = Math.floor(parseFloat(row.querySelector('.item-qty').value) || 0);
            const buyPrice = parseFloat(row.querySelector('.item-buy-price').value) || 0;
            const sellPrice = parseFloat(row.querySelector('.item-sell-price').value) || 0;
            billItems.push({
                itemId: itemId,
                itemName: row.querySelector('.item-select').options[row.querySelector('.item-select').selectedIndex].text,
                qty: qty,
                buyPrice: buyPrice,
                sellPrice: sellPrice,
            });
        });

        if(!valid || billItems.length === 0) {
            alert('الرجاء إضافة صنف واحد على الأقل واختياره.');
            return;
        }

        // inventory availability check
        const inventory = JSON.parse(localStorage.getItem('vienna-inventory')) || {};
        for (const it of billItems) {
            const available = inventory[it.itemId] || 0;
            if (available > 0 && it.qty > available) {
                alert(`الكمية المطلوبة للصنف "${it.itemName}" (${it.qty}) أكبر من الكمية المتاحة في المخزن (${available}).`);
                return;
            }
        }
        
        const newBill = {
            id: Date.now(),
            date: new Date().toISOString(),
            items: billItems,
            paymentMethod: document.getElementById('payment-method').value,
            paid: parseFloat(amountPaidInput.value) || 0,
            total: parseFloat(billTotalEl.textContent) || 0,
            remaining: parseFloat(billRemainingEl.textContent) || 0,
        };

        bills.push(newBill);
        localStorage.setItem('vienna-bills', JSON.stringify(bills));
        // Deduct from inventory if available
        const inv = JSON.parse(localStorage.getItem('vienna-inventory')) || {};
        newBill.items.forEach(it => {
            const id = it.itemId;
            const qty = parseFloat(it.qty) || 0;
            inv[id] = Math.max(0, (inv[id] || 0) - qty);
        });
        localStorage.setItem('vienna-inventory', JSON.stringify(inv));
        // notify other UIs if needed by dispatching event
        document.dispatchEvent(new CustomEvent('vienna-data-changed'));
        
        billItemsContainer.innerHTML = '';
        billForm.reset();
        calculateTotals();
        createBillItemRow();
        renderRecentBills();
        billDetailsContainer.style.display = 'none';
    });

    // --- Event Listeners ---
    addBillItemBtn.addEventListener('click', createBillItemRow);
    amountPaidInput.addEventListener('input', calculateTotals);
    billSearchInput.addEventListener('input', (e) => renderRecentBills(e.target.value));
    itemSearchInput.addEventListener('input', (e) => renderItemSearchResults(e.target.value));
    closeItemSearchBtn.addEventListener('click', () => itemSearchModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target == itemSearchModal) itemSearchModal.style.display = 'none'; });

    // --- Initial State ---
    createBillItemRow();
    calculateTotals();
    renderRecentBills();
}

function initializeDashboard() {
    const items = JSON.parse(localStorage.getItem('vienna-items')) || [];
    const bills = JSON.parse(localStorage.getItem('vienna-bills')) || [];
    const itemsCountEl = document.getElementById('dash-items-count');
    const billsCountEl = document.getElementById('dash-bills-count');
    const revenueEl = document.getElementById('dash-revenue');
    const chartEl = document.getElementById('dashboard-chart');
    const revenueChartEl = document.getElementById('dashboard-revenue-chart');

    if (itemsCountEl) itemsCountEl.textContent = items.length;
    if (billsCountEl) billsCountEl.textContent = bills.length;
    const total = bills.reduce((s, b) => s + (parseFloat(b.total) || 0), 0);
    if (revenueEl) revenueEl.textContent = total.toFixed(2);

    // Chart: show Items, Bills, Revenue (small summary)
    try {
        const dataValues = [items.length, bills.length, Math.round(total)];
        if (chartEl) {
            if (window.dashboardChart) {
                window.dashboardChart.data.datasets[0].data = dataValues;
                window.dashboardChart.update();
            } else {
                const ctx = chartEl.getContext('2d');
                window.dashboardChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['أصناف', 'فواتير', 'إجمالي'],
                        datasets: [{ label: 'موجز', data: dataValues, backgroundColor: ['#4da6ff', '#66cc99', '#ffb366'] }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }
        }
    } catch (err) { console.warn('Chart init failed', err); }

    // Revenue time-series over last 6 months
    try {
        const monthsCount = 6;
        const now = new Date();
        const months = [];
        for (let i = monthsCount - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d);
        }
        const monthKeys = months.map(d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        const sums = monthKeys.map(() => 0);
        bills.forEach(b => {
            const date = new Date(b.date);
            const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            const idx = monthKeys.indexOf(key);
            if (idx >= 0) sums[idx] += parseFloat(b.total) || 0;
        });
        const labels = months.map(d => new Intl.DateTimeFormat('ar-EG', { month: 'short', year: 'numeric' }).format(d));
        if (revenueChartEl) {
            if (window.dashboardRevenueChart) {
                window.dashboardRevenueChart.data.labels = labels;
                window.dashboardRevenueChart.data.datasets[0].data = sums.map(v => Math.round(v*100)/100);
                window.dashboardRevenueChart.update();
            } else {
                const ctx2 = revenueChartEl.getContext('2d');
                window.dashboardRevenueChart = new Chart(ctx2, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'إيراد',
                            data: sums.map(v => Math.round(v*100)/100),
                            borderColor: '#4da6ff',
                            backgroundColor: 'rgba(77,166,255,0.12)',
                            tension: 0.3,
                            fill: true,
                            pointRadius: 4
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
            }
        }
    } catch (err) { console.warn('Revenue chart failed', err); }

    // Recalculate when data changes
    const refresh = () => initializeDashboard();
    document.removeEventListener('vienna-data-changed', refresh);
    document.addEventListener('vienna-data-changed', refresh);
}

function initializeInventory() {
    const list = document.getElementById('inventory-list');
    const searchInput = document.getElementById('inventory-search');
    if (!list) return;

    let items = JSON.parse(localStorage.getItem('vienna-items')) || [];
    let inventory = JSON.parse(localStorage.getItem('vienna-inventory')) || {};

    const render = (query = '') => {
        list.innerHTML = '';
        const q = (query || '').toLowerCase().trim();
        const filtered = items.filter(i => !q || (i.name && i.name.toLowerCase().includes(q)) || (i.description && i.description.toLowerCase().includes(q)));
        if (filtered.length === 0) {
            const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'لا توجد أصناف في المخزن.'; list.appendChild(empty); return;
        }

        filtered.forEach(item => {
            const card = document.createElement('div'); card.className = 'item-card';
            const qty = inventory[item.id] || 0;
            card.innerHTML = `
                <img src="${item.image || 'https://placehold.co/600x400/bde8f5/0f2854?text=No+Image'}" alt="">
                <div class="card-content">
                    <h3>${item.name}</h3>
                    <p>${item.description || ''}</p>
                    <div class="inventory-controls">
                        <input type="number" class="inventory-qty" value="${qty}" min="0" data-itemid="${item.id}">
                        <button class="save-inv-btn">حفظ</button>
                    </div>
                </div>
            `;
            const saveBtn = card.querySelector('.save-inv-btn');
            const qtyInput = card.querySelector('.inventory-qty');
            saveBtn.addEventListener('click', () => {
                const v = parseFloat(qtyInput.value) || 0;
                inventory[item.id] = v;
                localStorage.setItem('vienna-inventory', JSON.stringify(inventory));
                document.dispatchEvent(new CustomEvent('vienna-data-changed'));
            });
            list.appendChild(card);
        });
    };

    searchInput && searchInput.addEventListener('input', (e) => render(e.target.value));

    // refresh on external data changes
    const refresh = () => { items = JSON.parse(localStorage.getItem('vienna-items')) || []; inventory = JSON.parse(localStorage.getItem('vienna-inventory')) || {}; render(searchInput ? searchInput.value : ''); };
    document.removeEventListener('vienna-data-changed', refresh);
    document.addEventListener('vienna-data-changed', refresh);

    render();
}
