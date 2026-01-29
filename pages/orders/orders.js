(function(){
  const listEl = document.getElementById('orders-list');
  const refreshBtn = document.getElementById('orders-refresh');

  const toast = (msg, type='info') => {
    if (window.Vienna && Vienna.toast) return Vienna.toast(msg, type);
    alert(msg);
  };

  const fmtDate = (v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v || '');
    return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  };

  const escapeHtml = (str) => {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  const money = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return (Math.round(v * 100) / 100).toFixed(2);
  };

  const parseNotes = (notes) => {
    const text = (notes == null) ? '' : String(notes);
    if (!text.trim()) return { raw: '' };
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object') return { json: obj, raw: text };
    } catch { }
    return { raw: text };
  };

  const statusOptions = [
    'جديد',
    'مع المندوب',
    'تمت التوصيل',
    'في انتظار التسوية',
    'تمت التسوية',
    'ملغي',
  ];

  const render = (orders) => {
    if (!listEl) return;

    if (!orders || !orders.length) {
      listEl.innerHTML = '<div class="text-muted">لا توجد طلبات.</div>';
      return;
    }

    listEl.innerHTML = orders.map(o => {
      const id = o.id ?? o.order_id ?? o.uuid ?? o.order_uuid;
      const createdAt = o.date ?? o.created_at ?? o.createdAt;
      const notes = o.notes ?? o.note ?? o.customer_notes ?? '';
      const status = o.status ?? o.state ?? '';

      const v2CustName = o.customer_name ?? o.customerName ?? '';
      const v2CustPhone = o.customer_phone ?? o.customerPhone ?? '';
      const v2CustPhone2 = o.customer_phone_extra ?? o.customerPhoneExtra ?? '';
      const v2CustAddress = o.customer_address ?? o.customerAddress ?? '';
      const v2DriverName = o.driver_name ?? o.driverName ?? '';

      const parsed = parseNotes(notes);
      const customer = parsed.json && parsed.json.customer ? parsed.json.customer : null;
      const custName = v2CustName || (customer?.name || '');
      const custPhone = v2CustPhone || (customer?.phone || '');
      const custPhone2 = v2CustPhone2 || (customer?.phoneExtra || '');
      const custAddress = v2CustAddress || (customer?.address || '');
      const extraNote = parsed.json && (parsed.json.note || parsed.json.notes) ? (parsed.json.note || parsed.json.notes) : '';

      const lines = Array.isArray(o.order_items) ? o.order_items : (Array.isArray(o.items) ? o.items : []);
      const normalizedLines = lines.map(li => {
        const item = li.item || li.items || li.product || {};
        const qty = Number(li.qty) || 0;
        const unit = (li.desired_price ?? li.desiredPrice ?? li.unit_price ?? li.unitPrice ?? item.sell_price ?? item.sellPrice);
        const unitNum = Number(unit);
        const lineTotal = Number.isFinite(unitNum) ? unitNum * qty : 0;
        return {
          name: item.name || li.name || '—',
          qty,
          unit: Number.isFinite(unitNum) ? unitNum : null,
          total: Number.isFinite(unitNum) ? lineTotal : null,
        };
      });
      const orderTotal = normalizedLines.reduce((s, l) => s + (Number(l.total) || 0), 0);

      return `
        <div class="order-card">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div style="min-width:0">
              <div class="fw-bold text-truncate">طلب: ${escapeHtml(String(id || '—'))}</div>
              <div class="order-meta">${escapeHtml(fmtDate(createdAt))}${status ? ' • ' + escapeHtml(status) : ''}</div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" type="button" data-action="fulfill" data-id="${escapeHtml(String(id || ''))}">تنفيذ</button>
            </div>
          </div>

          ${(custName || custPhone || custAddress || custPhone2 || v2DriverName) ? `
            <div class="mt-2 p-2" style="border:1px solid rgba(15,40,84,0.08); border-radius: 12px; background: rgba(255,255,255,0.75);">
              <div class="fw-bold mb-1">بيانات الزبون</div>
              ${custName ? `<div>👤 ${escapeHtml(String(custName))}</div>` : ''}
              ${custAddress ? `<div>📍 ${escapeHtml(String(custAddress))}</div>` : ''}
              ${(custPhone || custPhone2) ? `
                <div class="d-flex flex-wrap gap-2 mt-2">
                  ${custPhone ? `<a class="btn btn-sm btn-outline-success" href="tel:${escapeHtml(String(custPhone))}">اتصال</a>` : ''}
                  ${custPhone ? `<a class="btn btn-sm btn-outline-success" target="_blank" href="https://wa.me/${escapeHtml(String(custPhone)).replaceAll('+','')}">واتساب</a>` : ''}
                  ${custPhone2 ? `<span class="text-muted">احتياطي: ${escapeHtml(String(custPhone2))}</span>` : ''}
                </div>
              ` : ''}
              <div class="d-flex align-items-center gap-2 mt-2">
                <div class="text-muted" style="min-width:70px;">المندوب</div>
                <input class="form-control form-control-sm" type="text" placeholder="اسم المندوب" value="${escapeHtml(String(v2DriverName || ''))}" data-action="setDriver" data-id="${escapeHtml(String(id || ''))}">
              </div>
              ${extraNote ? `<div class="text-muted small mt-2">${escapeHtml(String(extraNote))}</div>` : ''}
            </div>
          ` : (notes ? `<div class="mt-2">${escapeHtml(String(notes))}</div>` : '')}

          <div class="d-flex align-items-center gap-2 mt-2">
            <label class="text-muted" style="min-width:70px;">الحالة</label>
            <select class="form-select form-select-sm" data-action="setStatus" data-id="${escapeHtml(String(id || ''))}">
              ${statusOptions.map(s => `<option value="${escapeHtml(s)}" ${String(status)===s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
            </select>
          </div>

          ${normalizedLines.length ? `
            <div class="mt-2 p-2" style="border:1px solid rgba(15,40,84,0.08); border-radius: 12px; background: rgba(245,249,255,0.6);">
              <div class="fw-bold mb-2">العناصر</div>
              ${normalizedLines.map(l => `
                <div class="d-flex align-items-center justify-content-between gap-2" style="padding:6px 0; border-bottom:1px dashed rgba(15,40,84,0.12);">
                  <div class="text-truncate" style="min-width:0;">• ${escapeHtml(l.name)} <span class="text-muted">(x${l.qty})</span></div>
                  <div class="text-nowrap">
                    ${l.unit == null ? '<span class="text-muted">—</span>' : `${money(l.unit)} د`}<span class="text-muted"> / </span>${l.total == null ? '<span class="text-muted">—</span>' : `${money(l.total)} د`}
                  </div>
                </div>
              `).join('')}
              <div class="d-flex align-items-center justify-content-between mt-2">
                <div class="fw-bold">الإجمالي (تقديري)</div>
                <div class="fw-bold">${money(orderTotal)} د</div>
              </div>
              <div class="text-muted small mt-1">يتم احتساب الإجمالي من desired_price إن وجد، وإلا من sell_price للصنف.</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  };

  const loadOrders = async () => {
    await SupabaseSvc.ensureReady();

    const client = SupabaseSvc._client;
    const trySelect = async (selectStr) => {
      return await client
        .from('orders')
        .select(selectStr)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
    };

    // Prefer v2 structured columns; fallback to legacy schema if columns aren't present yet.
    let resp = await trySelect('id,customer_id,date,status,notes,created_at,customer_name,customer_phone,customer_phone_extra,customer_address,driver_name,order_items(qty,desired_price,item:items(id,name,sell_price))');
    if (resp.error) {
      const msg = String(resp.error?.message || resp.error || '');
      const isMissingColumn = msg.includes('column') && msg.includes('does not exist');
      if (!isMissingColumn) throw resp.error;
      resp = await trySelect('id,customer_id,date,status,notes,created_at,order_items(qty,desired_price,item:items(id,name,sell_price))');
      if (resp.error) throw resp.error;
    }

    render(resp.data || []);
  };

  const fulfill = async (orderId) => {
    if (!orderId) return;
    if (!(window.SupabaseIntegration && SupabaseIntegration.fulfillOrder)) {
      toast('لا توجد دالة تنفيذ الطلب في SupabaseIntegration.', 'error');
      return;
    }

    refreshBtn?.setAttribute('disabled', 'disabled');
    try {
      await SupabaseIntegration.fulfillOrder(orderId, true);
      toast('تم تنفيذ الطلب.', 'success');
      await loadOrders();
    } catch (e) {
      console.error(e);
      toast('فشل تنفيذ الطلب. تحقق من الصلاحيات ووجود RPC fulfill_order.', 'error');
    } finally {
      refreshBtn?.removeAttribute('disabled');
    }
  };

  const setStatus = async (orderId, newStatus) => {
    if (!orderId) return;
    const client = SupabaseSvc._client;
    const { error } = await client
      .from('orders')
      .update({ status: String(newStatus || '') })
      .eq('id', orderId);
    if (error) throw error;
  };

  const setDriver = async (orderId, driverName) => {
    if (!orderId) return;
    const client = SupabaseSvc._client;
    const { error } = await client
      .from('orders')
      .update({ driver_name: (driverName || '').trim() || null })
      .eq('id', orderId);
    if (error) throw error;
  };

  listEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.getAttribute('data-action') === 'fulfill') {
      fulfill(btn.getAttribute('data-id'));
    }
  });

  listEl?.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    const id = el.getAttribute('data-id');

    if (action === 'setStatus') {
      const value = el.value;
      refreshBtn?.setAttribute('disabled', 'disabled');
      setStatus(id, value)
        .then(() => toast('تم تحديث الحالة.', 'success'))
        .then(() => loadOrders())
        .catch((err) => {
          console.error(err);
          toast('فشل تحديث الحالة. تحقق من الصلاحيات.', 'error');
        })
        .finally(() => refreshBtn?.removeAttribute('disabled'));
      return;
    }

    if (action === 'setDriver') {
      const value = el.value;
      refreshBtn?.setAttribute('disabled', 'disabled');
      setDriver(id, value)
        .then(() => toast('تم تحديث المندوب.', 'success'))
        .then(() => loadOrders())
        .catch((err) => {
          console.error(err);
          const msg = String(err?.message || err || '');
          const isMissingColumn = msg.includes('column') && msg.includes('does not exist');
          toast(isMissingColumn ? 'عمود المندوب غير موجود بعد. شغل ترحيل قاعدة البيانات v2 أولاً.' : 'فشل تحديث المندوب. تحقق من الصلاحيات.', 'error');
        })
        .finally(() => refreshBtn?.removeAttribute('disabled'));
      return;
    }

    return;
  });

  refreshBtn?.addEventListener('click', () => {
    loadOrders().catch(e => {
      console.error(e);
      toast('فشل تحديث الطلبات.', 'error');
    });
  });

  (async () => {
    try {
      await loadOrders();
    } catch (e) {
      console.error(e);
      toast('لا يمكن تحميل الطلبات. تأكد من إعداد Supabase.', 'error');
    }
  })();
})();
