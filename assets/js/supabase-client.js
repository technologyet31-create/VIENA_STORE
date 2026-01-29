// Supabase client wrapper for Vienna app
// Usage: set window.__SUPABASE_CONFIG__ = { url: 'https://xyz.supabase.co', key: 'anon-key' } before loading this script.
// Example: create a small file assets/js/supabase-config.js and include it in pages, or set via server template.

(function(){
  window.SupabaseSvc = window.SupabaseSvc || {
    _client: null,
    _ready: false,
    _initPromise: null,
    async init(config){
      try {
        if (!config) config = window.__SUPABASE_CONFIG__;
        if (!config || !config.url || !config.key) { console.warn('Supabase config not found. Skipping initialization.'); return; }
        const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
        this._client = mod.createClient(config.url, config.key);
        this._ready = true;
        console.info('SupabaseSvc initialized');
      } catch (err) { console.error('SupabaseSvc init failed', err); }
    },
    async ensureReady(){
      if (this.isReady()) return;
      if (this._initPromise) await this._initPromise;
      if (!this.isReady()) throw new Error('SupabaseSvc not initialized');
    },
    isReady(){ return Boolean(this._ready && this._client); },
    _normalizeProcurementItems(items){
      return (items || []).map(it => ({
        item_id: String(it.item_id ?? it.itemId),
        qty: Number(it.qty),
        buy_price: Number(it.buy_price ?? it.buyPrice ?? 0),
        sell_price: Number(it.sell_price ?? it.sellPrice ?? 0),
      }));
    },
    async _rpcWithFallback(fnName, argVariants){
      await this.ensureReady();
      let lastError = null;
      for (const arg of (argVariants || [])) {
        const { data, error } = await this._client.rpc(fnName, arg);
        if (!error) return data;
        lastError = error;

        const msg = String(error?.message || '');
        const code = String(error?.code || '');
        const isBadRequest = code === '400' || msg.includes('Bad Request') || msg.includes('invalid input') || msg.includes('function') || msg.includes('does not exist');
        if (!isBadRequest) throw error;
      }
      throw lastError || new Error(`RPC ${fnName} failed`);
    },
    async createProcurement(payment_method, paid, items){
      const payload = this._normalizeProcurementItems(items);
      const pm = payment_method || null;
      const paidNum = Number(paid) || 0;
      return await this._rpcWithFallback('create_procurement', [
        // Preferred: send JSON array (for json/jsonb params)
        { payment_method: pm, paid_arg: paidNum, items_arg: payload },
        { payment_method: pm, paid_arg: paidNum, items_arg: JSON.stringify(payload) },
        // Common alternative param names
        { payment_method: pm, paid: paidNum, items: payload },
        { payment_method_arg: pm, paid_arg: paidNum, items_arg: payload },
        { payment_method_arg: pm, paid: paidNum, items: payload },
      ]);
    },
    async updateProcurement(bill_id, payment_method, paid, items){
      const payload = this._normalizeProcurementItems(items);
      const pm = payment_method || null;
      const paidNum = Number(paid) || 0;
      const bill = String(bill_id || '');
      return await this._rpcWithFallback('update_procurement', [
        // Preferred
        { bill_uuid: bill, new_payment_method: pm, new_paid: paidNum, new_items: payload },
        { bill_uuid: bill, new_payment_method: pm, new_paid: paidNum, new_items: JSON.stringify(payload) },
        // Common alternative keys
        { bill_id: bill, new_payment_method: pm, new_paid: paidNum, new_items: payload },
        { bill_uuid: bill, payment_method: pm, paid_arg: paidNum, items_arg: payload },
        { bill_uuid: bill, payment_method: pm, paid: paidNum, items: payload },
      ]);
    },
    async deleteProcurement(bill_id){
      await this.ensureReady();
      const { data, error } = await this._client.rpc('delete_procurement', { bill_uuid: bill_id });
      if (error) throw error; return data;
    },
    async lastItems(limit = 10){ if (!this.isReady()) throw new Error('SupabaseSvc not initialized'); const { data, error } = await this._client.rpc('last_items', { limit_rows: limit }); if (error) throw error; return data; },
    async lastBills(limit = 10){ if (!this.isReady()) throw new Error('SupabaseSvc not initialized'); const { data, error } = await this._client.rpc('last_bills', { limit_rows: limit }); if (error) throw error; return data; },
    async listItems(limit = 500){
      await this.ensureReady();
      const { data, error } = await this._client.from('items').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
    async createItem(obj){
      await this.ensureReady();
      const { data, error } = await this._client.from('items').insert([obj]).select().single();
      if (error) throw error;
      return data;
    },
    async updateItem(itemId, patch){
      await this.ensureReady();
      const { data, error } = await this._client.from('items').update(patch).eq('id', itemId).select().single();
      if (error) throw error;
      return data;
    },
    async deleteItem(itemId){
      await this.ensureReady();
      const { error } = await this._client.from('items').delete().eq('id', itemId);
      if (error) throw error;
      return true;
    },
    async getInventoryWithItems(){
      await this.ensureReady();
      const { data, error } = await this._client
        .from('inventory')
        .select('item_id,quantity,item:items(id,name,description,image_url,image,qrcode,sell_price,last_buy_price)');
      if (error) {
        const msg = String(error?.message || error || '');
        const isMissingColumn = msg.includes('column') && msg.includes('does not exist');
        if (!isMissingColumn) throw error;
        // fallback for schemas without image_url
        const retry = await this._client
          .from('inventory')
          .select('item_id,quantity,item:items(id,name,description,image,qrcode,sell_price,last_buy_price)');
        if (retry.error) throw retry.error;
        return retry.data || [];
      }
      return data || [];
    },
  };

  // auto-init if config present
  if (window.__SUPABASE_CONFIG__) window.SupabaseSvc._initPromise = window.SupabaseSvc.init(window.__SUPABASE_CONFIG__);
})();
