(function(){
  // High-level Supabase integration helpers for sales/orders (no browser storage).
  const requireSupabase = () => {
    if (!(window.SupabaseSvc && SupabaseSvc.isReady && SupabaseSvc.isReady())) {
      throw new Error('Supabase is not configured or not ready');
    }
    return SupabaseSvc._client;
  };

  window.SupabaseIntegration = window.SupabaseIntegration || {
    async listCustomers(limit = 200){
      const client = requireSupabase();
      const { data, error } = await client
        .from('customers')
        .select('id,name,phone,phone_extra,address,notes,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Number(limit) || 200));
      if (error) throw error;
      return data || [];
    },
    async findCustomerByPhone(phone){
      const client = requireSupabase();
      const p = String(phone || '').trim();
      if (!p) return null;
      const { data, error } = await client
        .from('customers')
        .select('id,name,phone,phone_extra,address,notes')
        .eq('phone', p)
        .limit(1);
      if (error) throw error;
      return (data && data[0]) ? data[0] : null;
    },
    async upsertCustomer(customer){
      const client = requireSupabase();
      const row = customer && typeof customer === 'object' ? customer : {};
      const phone = String(row.phone || '').trim() || null;

      if (row.id) {
        const { data, error } = await client
          .from('customers')
          .update({
            name: (row.name || '').trim() || null,
            phone,
            phone_extra: (row.phone_extra || row.phoneExtra || '').trim() || null,
            address: (row.address || '').trim() || null,
            notes: (row.notes || '').trim() || null,
          })
          .eq('id', row.id)
          .select('id,name,phone,phone_extra,address,notes')
          .single();
        if (error) throw error;
        return data;
      }

      // If phone exists, attempt to update existing customer (best-effort) to avoid duplicates.
      if (phone) {
        const existing = await this.findCustomerByPhone(phone);
        if (existing && existing.id) {
          return await this.upsertCustomer({
            id: existing.id,
            name: row.name ?? existing.name,
            phone,
            phone_extra: row.phone_extra ?? row.phoneExtra ?? existing.phone_extra,
            address: row.address ?? existing.address,
            notes: row.notes ?? existing.notes,
          });
        }
      }

      const { data, error } = await client
        .from('customers')
        .insert([{
          name: (row.name || '').trim() || null,
          phone,
          phone_extra: (row.phone_extra || row.phoneExtra || '').trim() || null,
          address: (row.address || '').trim() || null,
          notes: (row.notes || '').trim() || null,
        }])
        .select('id,name,phone,phone_extra,address,notes')
        .single();
      if (error) throw error;
      return data;
    },
    async deleteCustomer(customerId){
      const client = requireSupabase();
      const { error } = await client.from('customers').delete().eq('id', customerId);
      if (error) throw error;
      return true;
    },
    async createSale(customerId, paymentMethod, paid, items){
      const client = requireSupabase();
      const payload = (items || []).map(i => ({
        item_id: String(i.itemId ?? i.item_id),
        qty: Number(i.qty),
        sell_price: Number(i.sellPrice ?? i.sell_price ?? 0),
        discount: Number(i.discount ?? 0),
      }));
      const { data, error } = await client.rpc('create_sale', {
        customer: customerId || null,
        payment_method: paymentMethod || null,
        paid_arg: paid || 0,
        items_arg: JSON.stringify(payload),
      });
      if (error) throw error;
      return data;
    },
    async deleteSale(saleId){
      const client = requireSupabase();
      const { data, error } = await client.rpc('delete_sale', { sale_uuid: saleId });
      if (error) throw error;
      return data;
    },
    async updateSale(saleId, customerId, paymentMethod, paid, items){
      const client = requireSupabase();
      const payload = (items || []).map(i => ({
        item_id: String(i.itemId ?? i.item_id),
        qty: Number(i.qty),
        sell_price: Number(i.sellPrice ?? i.sell_price ?? 0),
        discount: Number(i.discount ?? 0),
      }));
      const { data, error } = await client.rpc('update_sale', {
        sale_uuid: saleId,
        new_customer: customerId || null,
        new_payment_method: paymentMethod || null,
        new_paid: paid || 0,
        new_items: JSON.stringify(payload),
      });
      if (error) throw error;
      return data;
    },
    async createOrder(customerId, items, notes){
      const client = requireSupabase();
      const payload = (items || []).map(i => ({
        item_id: String(i.itemId ?? i.item_id),
        qty: Number(i.qty),
        desired_price: Number(i.desiredPrice ?? i.desired_price ?? 0),
      }));

      const opts = (notes && typeof notes === 'object' && !Array.isArray(notes)) ? notes : { notes };
      const nowIso = new Date().toISOString();

      const baseInsert = {
        customer_id: (opts.customerId ?? customerId) || null,
        notes: (opts.notes ?? null) || null,
        status: String(opts.status ?? 'جديد'),
        date: opts.date || nowIso,
      };

      const v2Fields = {
        customer_name: (opts.customerName ?? opts.customer_name ?? null) || null,
        customer_phone: (opts.customerPhone ?? opts.customer_phone ?? null) || null,
        customer_phone_extra: (opts.customerPhoneExtra ?? opts.customer_phone_extra ?? null) || null,
        customer_address: (opts.customerAddress ?? opts.customer_address ?? null) || null,
        driver_name: (opts.driverName ?? opts.driver_name ?? null) || null,
      };

      const tryInsert = async (row) => {
        const { data: order, error } = await client
          .from('orders')
          .insert([row])
          .select('id')
          .single();
        if (error) throw error;
        return order;
      };

      let order;
      try {
        order = await tryInsert({ ...baseInsert, ...v2Fields });
      } catch (e) {
        const msg = String(e?.message || e || '');
        const isMissingColumn = msg.includes('column') && msg.includes('does not exist');
        if (!isMissingColumn) throw e;

        const legacyNotes = (opts.legacyNotes ?? opts.legacy_notes ?? null) || null;
        order = await tryInsert({
          ...baseInsert,
          notes: legacyNotes || baseInsert.notes,
        });
      }

      if (payload.length) {
        const rows = payload.map(p => ({ order_id: order.id, item_id: p.item_id, qty: p.qty, desired_price: p.desired_price }));
        const { error: itemsErr } = await client
          .from('order_items')
          .upsert(rows, { onConflict: 'order_id,item_id' });
        if (itemsErr) {
          // Fallback for schemas without unique(order_id,item_id)
          const { error: insertErr } = await client.from('order_items').insert(rows);
          if (insertErr) throw insertErr;
        }
      }

      return order.id;
    },
    async fulfillOrder(orderId, createSaleFlag){
      const client = requireSupabase();
      const { data, error } = await client.rpc('fulfill_order', { order_uuid: orderId, create_sale_flag: Boolean(createSaleFlag) });
      if (error) throw error;
      return data;
    },
    async lastSales(limit=10){
      const client = requireSupabase();
      const { data, error } = await client.rpc('last_sales', { limit_rows: limit });
      if (error) throw error;
      return data;
    },
    async lastOrders(limit=10){
      const client = requireSupabase();
      const { data, error } = await client.rpc('last_orders', { limit_rows: limit });
      if (error) throw error;
      return data;
    }
  };

  // Optional in-memory sync: pull latest items/inventory into Vienna.storage (no persistence).
  window.SupabaseIntegration.syncFromServer = async function(){
    if (!(window.SupabaseSvc && SupabaseSvc.isReady && SupabaseSvc.isReady())) return;
    try {
      const items = await SupabaseSvc.lastItems(500);
      if (window.Vienna && Vienna.storage) Vienna.storage.set('vienna-items', items || []);

      const { data: invRows, error } = await SupabaseSvc._client.from('inventory').select('item_id,quantity');
      if (error) throw error;
      const map = {};
      (invRows || []).forEach(r => { map[r.item_id] = r.quantity; });
      if (window.Vienna && Vienna.storage) Vienna.storage.set('vienna-inventory', map);
    } catch (e){ console.error('syncFromServer failed', e); }
  };
  // Ensure the global Vienna.ready promise awaits an initial server sync when Supabase is configured.
  (function(){
    if (!window.Vienna) window.Vienna = {};
    const doSync = async () => {
      try {
        if (window.SupabaseSvc) {
          if (SupabaseSvc._initPromise) await SupabaseSvc._initPromise;
          if (SupabaseSvc.isReady && SupabaseSvc.isReady()) {
            await SupabaseIntegration.syncFromServer();
          }
        }
      } catch (e) { console.error('initial sync failed', e); }
    };
    // Replace Vienna.ready with a promise that resolves after optional sync.
    try {
      window.Vienna.ready = (window.Vienna.ready && window.Vienna.ready.then) ? window.Vienna.ready.then(doSync) : (async ()=>{ await doSync(); })();
    } catch (e) {
      window.Vienna.ready = doSync();
    }
  })();
})();
