// ─── LOCAL STATE (mirrors Firestore) ─────────────────────────────────────────
var state = {
  products: [],
  orders:   [],
  promos:   [],
  hero:     { title:'', sub:'', btn:'', eye:'' },
  cart: [],
  inquiries: [],
  quotations: [],
  currentProduct: null,
  currentVariant: null,
  currentQty: 1,
  editingProductId: null,
  pendingProductImgs: [],
  editingProductImgURLs: [],
  editingProductImgPath: null,
  searchFilter: '',
  statusFilter: '',
  selectedCourier: 'jnt',  // 'jnt' | 'lalamove'
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg){
  var t=document.createElement('div');
  t.className='toast';t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2800);
}


// ─── HTML ESCAPE (XSS prevention) ────────────────────────────────────────────
function esc(str){
  return String(str===null||str===undefined?'':str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── CACHE HELPERS ────────────────────────────────────────────────────────────
var CACHE_TTL = 5 * 60 * 1000;
function cacheSet(key,data){ try{ localStorage.setItem(key,JSON.stringify({data:data,ts:Date.now()})); }catch(e){} }
function cacheGet(key,ttl){ try{ var r=localStorage.getItem(key); if(!r) return null; var o=JSON.parse(r); return Date.now()-o.ts>(ttl||CACHE_TTL)?null:o.data; }catch(e){ return null; } }
function warmFromCache(){
  var cp=cacheGet('zs_products'); if(cp&&cp.length){ state.products=cp; if(typeof renderShop==='function'){ renderShop(); renderWholesale(); } }
  var cpr=cacheGet('zs_promos'); if(cpr){ state.promos=cpr; if(typeof updatePromoStrip==='function') updatePromoStrip(); }
}

// ─── OFFLINE BANNER ───────────────────────────────────────────────────────────
(function(){
  function getBanner(){
    var b = document.getElementById('zs-offline-banner');
    if(b) return b;
    b = document.createElement('div');
    b.id = 'zs-offline-banner';
    b.setAttribute('role','alert');
    b.setAttribute('aria-live','polite');
    b.innerHTML =
      '<span class="zs-offline-icon">📡</span>'
      + '<span class="zs-offline-msg">You\'re offline — some features may be unavailable. <span class="zs-offline-sub">Products shown are from cache.</span></span>'
      + '<button class="zs-offline-retry" onclick="window.location.reload()" title="Retry connection">Retry</button>';
    document.body.appendChild(b);
    return b;
  }

  function showBanner(){
    var b = getBanner();
    b.classList.add('zs-offline-visible');
    // Also grey out the shop/wholesale grids subtly
    document.documentElement.classList.add('zs-is-offline');
  }

  function hideBanner(){
    var b = document.getElementById('zs-offline-banner');
    if(b) b.classList.remove('zs-offline-visible');
    document.documentElement.classList.remove('zs-is-offline');
  }

  // Set initial state
  if(!navigator.onLine) showBanner();

  window.addEventListener('offline', showBanner);
  window.addEventListener('online', function(){
    hideBanner();
    toast('✅ Back online — refreshing data…');
    // Small delay so Firestore listeners can reconnect before we show stale UI
    setTimeout(function(){ window.location.reload(); }, 1200);
  });
})();
