(function(){
  const listEl = document.getElementById('customers-list');
  const searchEl = document.getElementById('customers-search');
  const refreshBtn = document.getElementById('customers-refresh');

  const formEl = document.getElementById('customer-form');
  const cancelBtn = document.getElementById('cust-cancel');

  const idEl = document.getElementById('cust-id');
  const nameEl = document.getElementById('cust-name');
  const phoneEl = document.getElementById('cust-phone');
  const phone2El = document.getElementById('cust-phone2');
  const addressEl = document.getElementById('cust-address');
  const notesEl = document.getElementById('cust-notes');

  const state = { rows: [], filtered: [] };

  const toast = (msg, type='info') => {
    if (window.Vienna && Vienna.toast) return Vienna.toast(msg, type);
    alert(msg);
  };

  const escapeHtml = (str) => {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  const resetForm = () => {
    idEl.value = '';
    nameEl.value = '';
    phoneEl.value = '';
    phone2El.value = '';
    addressEl.value = '';
    notesEl.value = '';
    cancelBtn.style.display = 'none';
  };

  const fillForm = (c) => {
    idEl.value = c?.id || '';
    nameEl.value = c?.name || '';
    phoneEl.value = c?.phone || '';
    phone2El.value = c?.phone_extra || '';
    addressEl.value = c?.address || '';
    notesEl.value = c?.notes || '';
    cancelBtn.style.display = '';
  };

  const applySearch = () => {
    const q = (searchEl?.value || '').trim().toLowerCase();
    if (!q) state.filtered = state.rows.slice();
    else {
      state.filtered = state.rows.filter(r => {
        const hay = `${r.name || ''} ${r.phone || ''} ${r.phone_extra || ''} ${r.address || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    render();
  };

  const render = () => {
    if (!listEl) return;
    const rows = state.filtered;

    if (!rows.length) {
      listEl.innerHTML = '<div class="text-muted">لا يوجد زبائن.</div>';
      return;
    }

    listEl.innerHTML = rows.map(c => {
      const phone = c.phone ? `<a href="tel:${escapeHtml(c.phone)}" class="text-decoration-none">${escapeHtml(c.phone)}</a>` : '—';
      const phone2 = c.phone_extra ? escapeHtml(c.phone_extra) : '';
      const addr = c.address ? escapeHtml(c.address) : '';

      return `
        <div class="customer-row">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div style="min-width:0;">
              <div class="fw-bold text-truncate">${escapeHtml(c.name || 'زبون بدون اسم')}</div>
              <div class="meta">📞 ${phone}${phone2 ? ` <span class="text-muted">(احتياطي: ${phone2})</span>` : ''}</div>
              ${addr ? `<div class="meta">📍 ${addr}</div>` : ''}
            </div>
            <div class="actions">
              <button class="btn btn-sm btn-outline-primary" type="button" data-action="edit" data-id="${escapeHtml(c.id)}">تعديل</button>
              <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete" data-id="${escapeHtml(c.id)}">حذف</button>
            </div>
          </div>
          ${c.notes ? `<div class="text-muted small mt-2">${escapeHtml(c.notes)}</div>` : ''}
        </div>
      `;
    }).join('');
  };

  const load = async () => {
    await SupabaseSvc.ensureReady();
    if (!(window.SupabaseIntegration && SupabaseIntegration.listCustomers)) {
      throw new Error('SupabaseIntegration.listCustomers not loaded');
    }
    const rows = await SupabaseIntegration.listCustomers(500);
    state.rows = rows || [];
    state.filtered = state.rows.slice();
    applySearch();
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      id: idEl.value || null,
      name: (nameEl.value || '').trim() || null,
      phone: (phoneEl.value || '').trim() || null,
      phone_extra: (phone2El.value || '').trim() || null,
      address: (addressEl.value || '').trim() || null,
      notes: (notesEl.value || '').trim() || null,
    };

    try {
      if (!(window.SupabaseIntegration && SupabaseIntegration.upsertCustomer)) {
        throw new Error('SupabaseIntegration.upsertCustomer not loaded');
      }
      await SupabaseIntegration.upsertCustomer(payload);
      toast('تم حفظ الزبون.', 'success');
      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || err || '');
      const missing = msg.includes('relation') && msg.includes('customers');
      toast(missing ? 'جدول customers غير موجود. شغل ترحيل قاعدة البيانات v2.' : 'فشل حفظ الزبون. تحقق من الصلاحيات.', 'error');
    }
  };

  const onListClick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');

    if (action === 'edit') {
      const c = state.rows.find(x => String(x.id) === String(id));
      if (c) fillForm(c);
      return;
    }

    if (action === 'delete') {
      if (!confirm('حذف الزبون؟')) return;
      try {
        await SupabaseIntegration.deleteCustomer(id);
        toast('تم حذف الزبون.', 'success');
        await load();
      } catch (err) {
        console.error(err);
        toast('فشل حذف الزبون. ربما توجد طلبات مرتبطة به.', 'error');
      }
    }
  };

  searchEl?.addEventListener('input', applySearch);
  refreshBtn?.addEventListener('click', () => load().catch(err => {
    console.error(err);
    toast('فشل تحديث الزبائن.', 'error');
  }));
  formEl?.addEventListener('submit', onSubmit);
  cancelBtn?.addEventListener('click', resetForm);
  listEl?.addEventListener('click', onListClick);

  (async () => {
    try {
      await load();
      resetForm();
    } catch (err) {
      console.error(err);
      toast('لا يمكن تحميل الزبائن. تأكد من إعداد Supabase.', 'error');
    }
  })();
})();
