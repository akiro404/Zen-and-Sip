
// ─── VARIANT TABLE HELPERS ───────────────────────────────────────────────────
window.addVariantRow = function(label, price, stock, weight){
  var tbody = document.getElementById('p-variants-tbody');
  if(!tbody) return;
  var row = document.createElement('tr');
  row.innerHTML =
    '<td style="padding:3px 6px"><input class="form-input" style="margin:0;padding:5px 8px;font-size:12px" placeholder="e.g. 30g" value="'+esc(label||'')+'"></td>'
    +'<td style="padding:3px 6px"><input class="form-input" type="number" step="0.01" min="0" style="margin:0;padding:5px 8px;font-size:12px;width:90px" placeholder="0.00" value="'+(price!=null?price:'')+'"></td>'
    +'<td style="padding:3px 6px"><input class="form-input" type="number" min="0" style="margin:0;padding:5px 8px;font-size:12px;width:70px" placeholder="0" value="'+(stock!=null?stock:'')+'"></td>'
    +'<td style="padding:3px 6px"><input class="form-input" type="number" step="0.001" min="0" style="margin:0;padding:5px 8px;font-size:12px;width:80px" placeholder="0.000" value="'+(weight!=null?weight:'')+'"></td>'
    +'<td style="padding:3px 6px;text-align:center"><button type="button" onclick="removeVariantRow(this)" style="background:none;border:none;color:#e24b4a;cursor:pointer;font-size:18px;line-height:1;padding:0 4px" title="Remove">×</button></td>';
  tbody.appendChild(row);
};
window.removeVariantRow = function(btn){
  var row = btn.closest('tr');
  if(row) row.remove();
};

// ─── EXPIRY / FIFO HELPERS ────────────────────────────────────────────────────
function getDaysUntilExpiry(p){
  if(!p.expiryDate) return null;
  var exp = new Date(p.expiryDate);
  var now = new Date();
  exp.setHours(0,0,0,0); now.setHours(0,0,0,0);
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function getExpiryStatus(p){
  var days = getDaysUntilExpiry(p);
  if(days === null) return null;
  if(days < 0)  return { label:'Expired',      color:'#dc2626', bg:'#fee2e2', priority:0 };
  if(days <= 7)  return { label:'Expires in '+days+'d', color:'#dc2626', bg:'#fee2e2', priority:1 };
  if(days <= 30) return { label:'Exp. soon',    color:'#d97706', bg:'#fef3c7', priority:2 };
  if(days <= 90) return { label:'Best before '+new Date(p.expiryDate).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}), color:'#059669', bg:'#d1fae5', priority:3 };
  return { label: null, priority: 4 };
}

function sortByExpiry(products){
  return products.slice().sort(function(a, b){
    var da = getDaysUntilExpiry(a);
    var db = getDaysUntilExpiry(b);
    // Products with expiry dates come first, sorted by soonest
    if(da !== null && db !== null) return da - db;
    if(da !== null) return -1; // a has expiry, b doesn't → a first
    if(db !== null) return 1;  // b has expiry, a doesn't → b first
    return (a.order||0) - (b.order||0); // fallback to manual order
  });
}
// ─── IMAGE REORDER STATE ──────────────────────────────────────────────────────
var _imgCombined = [];
function _rebuildImgCombined(){
  var eu = state.editingProductImgURLs || [];
  var pi = state.pendingProductImgs    || [];
  _imgCombined = [];
  eu.forEach(function(url){ _imgCombined.push({type:'existing', url:url}); });
  pi.forEach(function(file){ _imgCombined.push({type:'pending',  file:file}); });
}
function _syncFromCombined(){
  state.editingProductImgURLs = _imgCombined.filter(function(x){ return x.type==='existing'; }).map(function(x){ return x.url; });
  state.pendingProductImgs    = _imgCombined.filter(function(x){ return x.type==='pending';  }).map(function(x){ return x.file; });
}
var _imgDragSrc = null;
window.imgThumbDragStart = function(e, idx){
  _imgDragSrc = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.style.opacity = '0.35';
};
window.imgThumbDragEnd = function(e){
  _imgDragSrc = null;
  e.currentTarget.style.opacity = '';
  document.querySelectorAll('.img-drag-thumb').forEach(function(el){ el.style.outline=''; });
};
window.imgThumbDragOver = function(e, idx){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.img-drag-thumb').forEach(function(el){ el.style.outline=''; });
  e.currentTarget.style.outline = '2px solid var(--matcha)';
};
window.imgThumbDrop = function(e, idx){
  e.preventDefault(); e.stopPropagation();
  if(_imgDragSrc===null||_imgDragSrc===idx){ _imgDragSrc=null; return; }
  var dragged = _imgCombined.splice(_imgDragSrc, 1)[0];
  var target  = _imgDragSrc < idx ? idx-1 : idx;
  _imgCombined.splice(target, 0, dragged);
  _syncFromCombined();
  renderImgThumbs();
};
window.removeImgCombined = function(i){
  _imgCombined.splice(i,1);
  _syncFromCombined();
  renderImgThumbs();
};

// ─── PRODUCT IMAGE HELPER ─────────────────────────────────────────────────────
function productImg(p, size){
  // size: 'card' (64px emoji / full img), 'modal' (96px emoji / full img), 'table' (24px)
  var imgSrc = (p.imageURLs && p.imageURLs.length) ? p.imageURLs[0] : (p.imageURL || null);
  if(imgSrc){
    var h = size==='table' ? '28px' : size==='modal' ? '100%' : '100%';
    var w = size==='table' ? '28px' : '100%';
    return '<img src="'+imgSrc+'" style="width:'+w+';height:'+h+';object-fit:cover;'+(size==='table'?'border-radius:4px;vertical-align:middle':'display:block')+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async">';
  }
  var emojiSize = size==='table' ? '20px' : size==='modal' ? '96px' : '64px';
  return '<span style="font-size:'+emojiSize+'">'+(p.emoji||'📦')+'</span>';
}

// ─── PRODUCT RENDERING ────────────────────────────────────────────────────────
// Returns the effective stock for a specific variant (falls back to product stock)
function variantStock(p, variantLabel){
  if(!p) return Infinity;
  var variants=(p.variants||[]).map(function(v){ return typeof v==='object'?v:{label:v,price:null,stock:null}; });
  var hasVariantStock=variants.some(function(v){ return v.stock!=null&&v.stock!==''; });
  var v=variants.find(function(v){ return v.label===variantLabel; });
  if(v){
    // If this variant has its own stock, use it
    if(v.stock!=null && v.stock!=='') return Number(v.stock);
    // If OTHER variants have individual stocks but this one doesn't,
    // fall back to product-level stock so a 0-stock product marks this variant OOS too
    if(hasVariantStock){
      if(p.stock!=null&&p.stock!==''&&p.stock!==undefined) return Number(p.stock);
      return Infinity;
    }
  }
  // No variant-level stocks at all — use product-level stock
  if(p.stock!==undefined && p.stock!==null && p.stock!=='') return Number(p.stock);
  return Infinity;
}
// Returns true if a product+variant combo is out of stock (accounting for cart)
function isOOS(p, variantLabel){
  // Normalise empty string to undefined so callers that pass '' for "no variant"
  // are treated identically to callers that pass undefined.
  if(variantLabel==='') variantLabel=undefined;
  var variants=(p.variants||[]).map(function(v){ return typeof v==='object'?v:{label:v,price:null,stock:null}; });
  var hasVariantStock=variants.some(function(v){ return v.stock!=null&&v.stock!==''; });
  if(hasVariantStock){
    if(variantLabel===undefined||variantLabel===null){
      // No specific variant requested — treat as OOS only if ALL variants are OOS
      return variants.every(function(v){ return isOOS(p, v.label); });
    }
    // Per-variant stock mode for specific variant — check Firestore stock only, not cart
    var vStock=variantStock(p, variantLabel);
    if(vStock===Infinity) return false;
    return vStock<=0;
  }
  // Shared stock mode — check Firestore stock only, not cart
  if(p.stock===undefined||p.stock===null||p.stock==='') return false;
  return Number(p.stock)<=0;
}
// isOOS variant that excludes a specific cart item's own qty (prevents false OOS in cart)
function isOOSExcluding(p, variantLabel, excludeId, excludeQty){
  // Now that cart no longer affects stock display, this is identical to isOOS
  return isOOS(p, variantLabel);
}
// Returns available units for a product+variant combo (Firestore stock only — cart does not reduce this)
function stockAvailable(p, variantLabel){
  if(!p) return Infinity;
  if(variantLabel==='') variantLabel=undefined;
  var variants=(p.variants||[]).map(function(v){ return typeof v==='object'?v:{label:v,price:null,stock:null}; });
  var hasVariantStock=variants.some(function(v){ return v.stock!=null&&v.stock!==''; });
  if(hasVariantStock){
    if(variantLabel===undefined||variantLabel===null){
      // No variant specified — return sum of all variant stock
      return variants.reduce(function(s,v){ var a=stockAvailable(p,v.label); return s+(a===Infinity?0:a); },0);
    }
    var vStock=variantStock(p, variantLabel);
    return vStock===Infinity ? Infinity : Math.max(0, vStock);
  }
  // Shared stock mode
  if(p.stock===undefined||p.stock===null||p.stock==='') return Infinity;
  return Math.max(0, Number(p.stock));
}
function productCard(p){
  var variants=(p.variants||[]).map(function(v){ return typeof v==='object'?v:{label:v,price:null,stock:null}; });
  // Card OOS = true only when actual Firestore stock is 0, ignoring cart qty
  // (cart qty is reserved but not purchased yet)
  var hasVariantStock=variants.some(function(v){ return v.stock!=null&&v.stock!==''; });
  var oos;
  if(variants.length>0 && hasVariantStock){
    // OOS only if every variant that HAS its own stock is at 0
    // Variants without individual stock are treated as available
    oos=variants.filter(function(v){ return v.stock!=null&&v.stock!==''; })
      .every(function(v){
        var s=variantStock(p,v.label);
        return s!==Infinity && s<=0;
      });
  } else if(variants.length>0 && !hasVariantStock){
    // No per-variant stocks — use base stock
    var s=Number(p.stock||0);
    oos=(p.stock!==undefined&&p.stock!==null&&p.stock!=='')&&s<=0;
  } else {
    var s=Number(p.stock||0);
    oos=(p.stock!==undefined&&p.stock!==null&&p.stock!=='')&&s<=0;
  }
  var cardClass='product-card'+(oos?' oos':'');
  var clickAttr=oos?'':' onclick="openProduct(\''+p.id+'\')"';
  return '<div class="'+cardClass+'"'+clickAttr+'>'
    +'<div class="product-img" style="position:relative">'
    +productImg(p,'card')
    +(oos?'<div class="oos-badge">Out of Stock</div>':(function(){
        var es=getExpiryStatus(p);
        if(!es||!es.label) return '';
        return '<div class="expiry-badge" style="background:'+es.bg+';color:'+es.color+'">'+es.label+'</div>';
      })())
    +'</div>'
    +(p.promoted?'<div class="promo-banner">✦ '+(p.promoLabel||"This Week's Pick")+'</div>':'')
    +'<div class="product-info">'
    +'<div class="product-name">'+p.name+'</div>'
    +'<div class="product-desc">'+esc(p.desc||'').replace(/\n/g,' ')+'</div>'
    +'<div class="product-footer">'
    +'<span class="product-price">'+(p.price===0?'Contact Us':'₱'+p.price.toLocaleString())+'</span>'
    +(oos
      ?'<span style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#aaa">Unavailable</span>'
      :'<span class="quick-view">Quick View →</span>')
    +'</div></div></div>';
}
function updateModalStockIndicator(){
  var el=document.getElementById('modal-stock-indicator');
  if(!el) return;
  var p=state.currentProduct;
  if(!p){ el.textContent=''; return; }
  var vLabel=state.currentVariant?state.currentVariant.label:undefined;
  var avail=stockAvailable(p, vLabel);
  var inCart=state.cart.reduce(function(s,ci){
    return s+(ci.id===p.id&&(vLabel===undefined||ci.variant===vLabel)?ci.qty:0);
  },0);
  if(avail===Infinity){ el.textContent=''; return; } // unlimited
  if(avail<=0){
    el.textContent='Out of stock'; el.style.color='#dc2626';
  } else if(avail<=5){
    el.textContent='Only '+avail+' left'+(inCart>0?' ('+inCart+' in cart)':'');
    el.style.color='#d97706';
  } else {
    el.textContent=avail+' available'+(inCart>0?' ('+inCart+' in cart)':'');
    el.style.color='#16a34a';
  }
}
window.openProduct = function(id){
  var p=state.products.find(x=>x.id===id);
  if(!p) return;
  state.currentProduct=p;
  state.currentQty=1;
  // normalise variants to objects
  var variants=(p.variants||[]).map(function(v){return typeof v==='object'?v:{label:v,price:null,stock:null};});
  // Auto-select the first available (non-OOS) variant always
  var availableVariants = variants.filter(function(v){ return !isOOS(p, v.label); });
  state.currentVariant = availableVariants.length ? availableVariants[0] : (variants.length ? variants[0] : null);
  var startPrice = state.currentVariant && state.currentVariant.price != null ? state.currentVariant.price : p.price;
  // Build product modal carousel
  var imgs=p.imageURLs&&p.imageURLs.length?p.imageURLs:(p.imageURL?[p.imageURL]:[]);
  buildModalCarousel(imgs,p.emoji);
  document.getElementById('modal-tag').textContent=p.category==='retail'?'Retail':'Wholesale';
  document.getElementById('modal-name').textContent=p.name;
  document.getElementById('modal-price').textContent=startPrice===0?'Contact for Pricing':'₱'+startPrice.toLocaleString();
  document.getElementById('modal-desc').innerHTML=esc(p.desc||'').replace(/\n/g,'<br>');
  document.getElementById('modal-qty').textContent='1';
  // Build variant buttons with per-variant stock hints
  var vhtml=variants.map(function(v){
    var label=v.label+(v.price!=null?' — ₱'+v.price.toLocaleString():'');
    var vAvail=stockAvailable(p, v.label);
    var vOos=isOOS(p, v.label);
    var stockHint=vOos
      ?'<span style="font-size:10px;color:#dc2626;display:block;margin-top:2px">Out of stock</span>'
      :(vAvail!==Infinity&&vAvail<=5
        ?'<span style="font-size:10px;color:#d97706;display:block;margin-top:2px">'+vAvail+' left</span>'
        :(vAvail!==Infinity
          ?'<span style="font-size:10px;color:#16a34a;display:block;margin-top:2px">'+vAvail+' avail</span>'
          :''));
    var isActive=state.currentVariant&&state.currentVariant.label===v.label;
    var vPrice = v.price!=null?v.price:'null';
    return '<button class="variant-btn'+(isActive?' active':'')+(vOos?' oos-variant':'')+'"'
      +' data-label="'+v.label.replace(/"/g,'&quot;')+'"'
      +' data-vprice="'+vPrice+'"'
      +' data-bprice="'+p.price+'"'
      +(vOos?' disabled style="opacity:.45;cursor:not-allowed"':'')+' '
      +'onclick="variantBtnClick(this)">'+label+stockHint+'</button>';
  }).join('');
  document.getElementById('modal-variants').innerHTML=vhtml;
  // If product has variants, require one to be selected before adding to cart
  var hasVariants = variants.length > 0;
  // Use raw stock for overall OOS — don't count cart qty (not purchased yet)
  var oos=hasVariants
    ? variants.every(function(v){ var s=variantStock(p,v.label); return s!==Infinity&&s<=0; })
    : (p.stock!==undefined&&p.stock!==null&&p.stock!==''&&Number(p.stock)<=0);
  var atcBtn=document.getElementById('modal-atc-btn');
  if(atcBtn){
    var needsVariant = hasVariants && !state.currentVariant;
    if(oos || needsVariant){
      atcBtn.setAttribute('disabled','');
      atcBtn.textContent = oos ? 'Out of Stock' : 'Select a variant';
      atcBtn.style.cssText = 'background:#b0b0b0;cursor:not-allowed;opacity:0.6;';
    } else {
      atcBtn.removeAttribute('disabled');
      atcBtn.textContent = 'Add to Cart';
      atcBtn.style.cssText = '';
    }
  }
  updateModalStockIndicator();
  document.getElementById('product-overlay').classList.add('open');
};
function renderShop(){
  var retail=state.products.filter(function(p){ return p.category==='retail'; });
  // Promoted first → in-stock → OOS last
  retail = retail.slice().sort(function(a,b){
    var aOos=isOOS(a), bOos=isOOS(b);
    if(aOos!==bOos) return aOos?1:-1;
    if(a.promoted && !b.promoted) return -1;
    if(!a.promoted && b.promoted) return 1;
    return (a.order||0)-(b.order||0);
  });
  document.getElementById('shop-grid').innerHTML=retail.length
    ? retail.map(productCard).join('')
    : '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">No retail products yet.</div>';
}
// ─── WHOLESALE FILTER STATE ───────────────────────────────────────────────────
var _wsMainCat = ''; // 'matcha' | 'houjicha' | ''
var _wsSubCat  = ''; // sub-category value or ''

// Map wsCategory values → display tag labels
var WS_CATEGORY_LABELS = {
  'ceremonial':    'Ceremonial',
  'premium':       'Premium',
  'culinary':      'Culinary',
  'light-roast':   'Light Roast',
  'medium-roast':  'Medium Roast',
  'dark-roast':    'Dark Roast',
};

function wsMainCatOf(p){
  // Derive from product's wsCategory field, or fall back to name/desc heuristics
  var wsc = (p.wsCategory||'').toLowerCase();
  if(wsc === 'light-roast' || wsc === 'medium-roast' || wsc === 'dark-roast') return 'houjicha';
  if(wsc === 'ceremonial' || wsc === 'premium' || wsc === 'culinary') return 'matcha';
  // Heuristic fallback
  var combined = (p.name+' '+(p.desc||'')).toLowerCase();
  if(combined.includes('houjicha') || combined.includes('hojicha')) return 'houjicha';
  return 'matcha'; // default all other wholesale products to matcha
}

window.wsSetMainCat = function(cat){
  _wsMainCat = cat;
  _wsSubCat  = '';
  // Update first-row chip UI
  document.querySelectorAll('.ws-main-chip').forEach(function(b){
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  // Rebuild sub-filter chips
  renderWsSubChips();
  renderWholesale();
};

window.wsSetSubCat = function(sub){
  _wsSubCat = sub;
  document.querySelectorAll('.ws-sub-chip').forEach(function(b){
    b.classList.toggle('active', b.dataset.sub === sub);
  });
  renderWholesale();
};

function renderWsSubChips(){
  var wrap = document.getElementById('ws-sub-chips');
  if(!wrap) return;
  if(!_wsMainCat){ wrap.innerHTML = ''; return; }
  var opts = _wsMainCat === 'houjicha'
    ? [['','All Houjicha'],['light-roast','Light Roast'],['medium-roast','Medium Roast'],['dark-roast','Dark Roast']]
    : [['','All Matcha'],['ceremonial','Ceremonial'],['premium','Premium'],['culinary','Culinary']];
  wrap.innerHTML = opts.map(function(o){
    return '<button class="filter-chip ws-sub-chip'+(_wsSubCat===o[0]?' active':'')+'" data-sub="'+o[0]+'" onclick="wsSetSubCat(\''+o[0]+'\')">'+ o[1]+'</button>';
  }).join('');
}

function renderWholesale(){
  var ws=state.products.filter(function(p){ return p.category==='wholesale'; });
  // Apply filters
  if(_wsMainCat){
    ws = ws.filter(function(p){ return wsMainCatOf(p) === _wsMainCat; });
  }
  if(_wsSubCat){
    ws = ws.filter(function(p){ return (p.wsCategory||'').toLowerCase() === _wsSubCat; });
  }
  // Unavailable products always last
  ws = ws.slice().sort(function(a,b){
    var aU=!!a.wsUnavailable, bU=!!b.wsUnavailable;
    if(aU!==bU) return aU?1:-1;
    return (a.order||0)-(b.order||0);
  });
  document.getElementById('wholesale-grid').innerHTML=ws.length
    ? ws.map(function(p){
        var imgs=p.imageURLs&&p.imageURLs.length?p.imageURLs:(p.imageURL?[p.imageURL]:[]);
        var mainImg=imgs.length
          ?'<img src="'+imgs[0]+'" style="width:100%;height:100%;object-fit:cover;display:block" alt="'+p.name+'" loading="lazy">'
          :'<span style="font-size:64px;display:block;text-align:center;padding:1rem">'+(p.emoji||'📦')+'</span>';
        var multiHint=imgs.length>1?'<span class="carousel-hint">'+imgs.length+' photos</span>':'';
        // Determine badge label from wsCategory (show product type, not "Wholesale")
        var wsc = (p.wsCategory||'').toLowerCase();
        var badgeLabel = WS_CATEGORY_LABELS[wsc] || (wsMainCatOf(p)==='houjicha' ? 'Houjicha' : 'Matcha');
        // Build price string — show highest variant price
        var variants=(p.variants||[]).map(function(v){
          if(typeof v==='object') return v;
          var parts=String(v).split(':');
          return {label:parts[0].trim(),price:parts[1]?parseFloat(parts[1]):null};
        });
        var vPrices=variants.map(function(v){return v.price;}).filter(function(x){return x!=null&&x>0;});
        var priceStr;
        if(vPrices.length){
          var maxP=Math.max.apply(null,vPrices);
          priceStr='₱'+parseFloat(maxP).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
        } else {
          priceStr=p.price&&p.price>0?'₱'+parseFloat(p.price).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}):'Price upon request';
        }
        return '<div class="product-card" onclick="openWsModal(\''+p.id+'\')">'
          +'<div class="product-img ws-card-img">'+mainImg+multiHint+'<div class="product-badge">'+badgeLabel+'</div></div>'
          +'<div class="product-info">'
          +'<div class="product-name">'+p.name+'</div>'
          +'<div class="product-desc">'+esc(p.desc||'').replace(/\n/g,' ')+'</div>'
          +'<div style="margin-top:6px;font-size:13px;font-weight:600;color:var(--matcha)">'+priceStr+'</div>'
          +'</div></div>';
      }).join('')
    : '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">No products found for this filter.</div>';
}

// ─── PRODUCT TABLE (dashboard) ────────────────────────────────────────────────
var _prodCatFilter = 'all';
window.setProdCatFilter = function(cat){
  _prodCatFilter = cat;
  ['all','retail','wholesale'].forEach(function(c){
    var btn = document.getElementById('pcat-tab-'+c);
    if(btn) btn.classList.toggle('active', c===cat);
  });
  pgSet('products',1);
  renderProductTable(state.searchFilter||'');
};
function renderProductTable(filter){
  state.searchFilter=filter||'';
  var all=state.products;
  // update tab counts
  ['all','retail','wholesale'].forEach(function(c){
    var el=document.getElementById('pcat-count-'+c);
    if(el) el.textContent=c==='all'?all.length:all.filter(function(p){return p.category===c;}).length;
  });
  var list=all.filter(function(p){
    var catMatch=_prodCatFilter==='all'||p.category===_prodCatFilter;
    var nameMatch=!filter||p.name.toLowerCase().includes(filter.toLowerCase());
    return catMatch&&nameMatch;
  });
  var page=pgGet('products');
  var pages=Math.ceil(list.length/PG_SIZE)||1;
  if(page>pages){ pgSet('products',1); page=1; }
  var slice=list.slice((page-1)*PG_SIZE, page*PG_SIZE);
  document.getElementById('products-tbody').innerHTML=slice.length
    ? slice.map(function(p){
        return '<tr>'
          +'<td><div style="display:flex;align-items:center;gap:8px">'+productImg(p,'table')+' <span>'+esc(p.name)+'</span></div></td>'
          +'<td>'+(p.price===0?'Contact Us':'₱'+p.price.toLocaleString())+'</td>'
          +(function(){
              var es=getExpiryStatus(p);
              if(!es||!es.label) return '<td style="color:var(--text-muted);font-size:11px">—</td>';
              return '<td><span class="expiry-chip" style="background:'+es.bg+';color:'+es.color+'">'+es.label+'</span></td>';
            })()
          +'<td><button class="btn-sm" onclick="editProduct(\''+p.id+'\')" style="margin-right:4px">Edit</button>'
          +'<button class="btn-sm danger" onclick="deleteProduct(\''+p.id+'\')">Del</button></td></tr>';
      }).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">No products found.</td></tr>';
  renderPagination('products', list.length);
}

// ─── PRODUCT CRUD ─────────────────────────────────────────────────────────────
window.clearProductForm = function(){
  state.editingProductId=null;
  state.pendingProductImgs=[];
  state.editingProductImgURLs=[];
  ['p-name','p-desc','p-emoji'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('p-variants-tbody').innerHTML='';
  document.getElementById('p-cat').value='retail';
  document.getElementById('product-form-title').textContent='Add Product';
  document.getElementById('p-img-file').value='';
  document.getElementById('p-img-placeholder').style.display='block';
  document.getElementById('p-img-zone').classList.remove('has-file');
  renderImgThumbs();
};
window.saveProduct = async function(){
  var name=document.getElementById('p-name').value.trim();
  if(!name){alert('Product name required.');return}
  try{ requireAuth(); } catch(e){ toast('Not authenticated. Please log in.'); return; }
  var btn=document.querySelector('[onclick="saveProduct()"]');
  if(btn){btn.textContent='Saving…';btn.disabled=true;}
  try{
    var promotedEl=document.getElementById('p-promoted');
    var promoLabelEl=document.getElementById('p-promo-label');
    var wsUnavailableEl=document.getElementById('p-ws-unavailable');
    var variants=Array.from(document.querySelectorAll('#p-variants-tbody tr')).map(function(row){
        var inputs=row.querySelectorAll('input');
        var label=(inputs[0]&&inputs[0].value.trim())||'';
        if(!label) return null;
        var pv=inputs[1]&&inputs[1].value.trim();
        var sv=inputs[2]&&inputs[2].value.trim();
        var wv=inputs[3]&&inputs[3].value.trim();
        return {label:label,price:pv!==''?parseFloat(pv):null,stock:sv!==''?parseInt(sv):null,weight:wv!==''?parseFloat(wv):null};
      }).filter(Boolean);
    var vPrices=variants.map(function(v){return v.price;}).filter(function(x){return x!=null&&x>0;});
    var derivedPrice=vPrices.length?Math.max.apply(null,vPrices):0;
    var derivedStock=variants.reduce(function(s,v){return s+(v.stock!=null?v.stock:0);},0);
    var firstWeight=variants.length&&variants[0].weight!=null?variants[0].weight:null;
    var data={
      name,
      desc:document.getElementById('p-desc').value.trim(),
      price:derivedPrice,
      stock:derivedStock,
      weight:firstWeight,
      promoted:promotedEl?promotedEl.checked:false,
      promoLabel:promoLabelEl&&promoLabelEl.value.trim()?promoLabelEl.value.trim():"This Week's Pick",
      wsUnavailable:wsUnavailableEl?wsUnavailableEl.checked:false,
      variants:variants,
      category:document.getElementById('p-cat').value,
      wsCategory: (document.getElementById('p-ws-category') ? document.getElementById('p-ws-category').value : ''),
      emoji:document.getElementById('p-emoji').value||'📦',
    };
    async function compressFile(file){
      return new Promise(function(resolve,reject){
        var img=new Image();
        var url=URL.createObjectURL(file);
        img.onload=function(){
          var canvas=document.createElement('canvas');
          var MAX=800;
          var w=img.width,h=img.height;
          if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
          if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
          canvas.width=w;canvas.height=h;
          var ctx=canvas.getContext('2d');
          ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
          ctx.drawImage(img,0,0,w,h);
          URL.revokeObjectURL(url);
          var useWebP=canvas.toDataURL('image/webp').startsWith('data:image/webp');
          resolve(useWebP?canvas.toDataURL('image/webp',0.85):canvas.toDataURL('image/jpeg',0.84));
        };
        img.onerror=reject;
        img.src=url;
      });
    }
    _rebuildImgCombined();
    var allImgs=[];
    for(var i=0;i<_imgCombined.length;i++){
      if(_imgCombined[i].type==='existing'){
        allImgs.push(_imgCombined[i].url);
      } else {
        allImgs.push(await compressFile(_imgCombined[i].file));
      }
    }
    if(allImgs.length>0){
      data.imageURLs=allImgs;
      data.imageURL=allImgs[0];
    }
    if(state.editingProductId){
      await updateDoc(doc(db,'products',state.editingProductId),{...data});
      toast('Product updated ✅');
    } else {
      data.order=Date.now();
      await addDoc(collection(db,'products'),{...data});
      toast('Product added ✅');
    }
    clearProductForm();
  }catch(e){alert('Error saving product: '+e.message);}
  if(btn){btn.textContent='Save Product';btn.disabled=false;}
};
window.editProduct = function(id){
  var p=state.products.find(x=>x.id===id);
  if(!p) return;
  state.editingProductId=id;
  state.pendingProductImgs=[];
  var imgs=p.imageURLs&&p.imageURLs.length?p.imageURLs:(p.imageURL?[p.imageURL]:[]);
  state.editingProductImgURLs=imgs.slice();
  document.getElementById('p-name').value=p.name;
  document.getElementById('p-desc').value=p.desc||'';
  var promEl=document.getElementById('p-promoted');
  if(promEl){ promEl.checked=!!p.promoted; updatePromoLabel(); }
  var plEl=document.getElementById('p-promo-label');
  if(plEl) plEl.value=p.promoLabel||"This Week's Pick";
  var wsUnavEl=document.getElementById('p-ws-unavailable');
  if(wsUnavEl){ wsUnavEl.checked=!!p.wsUnavailable; if(typeof updateWsUnavailable==='function') updateWsUnavailable(); }
  var wsCatEl=document.getElementById('p-ws-category');
  if(wsCatEl) wsCatEl.value=p.wsCategory||'';
  var varTbody=document.getElementById('p-variants-tbody');
  varTbody.innerHTML='';
  (p.variants||[]).forEach(function(v){
    if(typeof v!=='object') v={label:String(v),price:null,stock:null,weight:null};
    addVariantRow(v.label,v.price,v.stock,v.weight);
  });
  document.getElementById('p-cat').value=p.category;
  document.getElementById('p-emoji').value=p.emoji;
  document.getElementById('p-img-placeholder').style.display=imgs.length?'none':'block';
  renderImgThumbs();
  document.getElementById('product-form-title').textContent='Edit Product';
};
window.deleteProduct = async function(id){
  try{ requireAuth(); }catch(e){ toast('Not authenticated.'); return; }
  if(!confirm('Delete this product? This cannot be undone.')) return;
  await deleteDoc(doc(db,'products',id));
  toast('Product deleted');
};

// ─── PRODUCT IMAGE UPLOAD HANDLERS ──────────────────────────────────────────────────
function renderImgThumbs(){
  var thumbs=document.getElementById('p-img-thumbs');
  if(!thumbs) return;
  _rebuildImgCombined();
  var html='';
  var multi=_imgCombined.length>1;
  _imgCombined.forEach(function(item,i){
    var src   = item.type==='existing' ? item.url : URL.createObjectURL(item.file);
    var border= item.type==='existing' ? 'var(--border)' : 'var(--matcha-muted)';
    var title = multi ? 'Drag to reorder' : (item.type==='pending'?'New: '+esc(item.file.name):'Image');
    html+='<div class="img-drag-thumb" draggable="true" '
      +'ondragstart="imgThumbDragStart(event,'+i+')" '
      +'ondragend="imgThumbDragEnd(event)" '
      +'ondragover="imgThumbDragOver(event,'+i+')" '
      +'ondragleave="this.style.outline=\'\'" '
      +'ondrop="imgThumbDrop(event,'+i+')" '
      +'style="position:relative;display:inline-block;cursor:'+(multi?'grab':'default')+'" '
      +'title="'+title+'">'
      +'<img src="'+src+'" style="width:60px;height:60px;object-fit:cover;border-radius:5px;border:2px solid '+border+'">'
      +(i===0&&multi?'<span style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.5);color:#fff;font-size:9px;text-align:center;border-radius:0 0 4px 4px;line-height:14px;pointer-events:none">Main</span>':'')
      +'<button onclick="removeImgCombined('+i+')" style="position:absolute;top:-5px;right:-5px;background:#e24b4a;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button>'
      +'</div>';
  });
  var total=_imgCombined.length;
  thumbs.innerHTML=html+(total>1?'<div style="width:100%;font-size:11px;color:var(--text-muted);margin-top:.2rem">↕ Drag to reorder · first image is the main photo</div>':'');
  if(total>0){
    thumbs.style.display='flex';
    document.getElementById('p-img-placeholder').style.display='none';
    document.getElementById('p-img-zone').classList.add('has-file');
  } else {
    document.getElementById('p-img-placeholder').style.display='block';
    document.getElementById('p-img-zone').classList.remove('has-file');
  }
}
window.removeExistingImg=function(i){
  state.editingProductImgURLs.splice(i,1);
  renderImgThumbs();
};
window.removePendingImg=function(i){
  state.pendingProductImgs.splice(i,1);
  renderImgThumbs();
};
function addProductImgFiles(files){
  if(!state.pendingProductImgs) state.pendingProductImgs=[];
  if(!state.editingProductImgURLs) state.editingProductImgURLs=[];
  var total=(state.editingProductImgURLs.length||0)+(state.pendingProductImgs.length||0);
  Array.from(files).forEach(function(file){
    if(!file.type.startsWith('image/')){ toast('Not an image: '+file.name); return; }
    if(file.size>5*1024*1024){ toast('Too large (max 5MB): '+file.name); return; }
    if(total>=6){ toast('Max 6 images per product'); return; }
    state.pendingProductImgs.push(file);
    total++;
  });
  renderImgThumbs();
}
window.handleProductImgSelect=function(input){
  if(input.files&&input.files.length) addProductImgFiles(input.files);
  input.value='';
};
window.handleProductImgDrop=function(e){
  e.preventDefault();
  document.getElementById('p-img-zone').classList.remove('drag-over');
  if(e.dataTransfer.files&&e.dataTransfer.files.length) addProductImgFiles(e.dataTransfer.files);
};
window.clearProductImg=function(e){
  if(e) e.stopPropagation();
  state.pendingProductImgs=[];
  state.editingProductImgURLs=[];
  document.getElementById('p-img-file').value='';
  renderImgThumbs();
};


// ─── SHOP SEARCH & FILTER ─────────────────────────────────────────────────────
var _shopFilter = 'all';
window.setShopFilter = function(btn,val){
  _shopFilter=val;
  document.querySelectorAll('.filter-chip').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  filterShop();
};
window.filterShop = function(){
  var q=(document.getElementById('shop-search')||{}).value||'';
  var sort=(document.getElementById('shop-sort')||{}).value||'default';
  var clear=document.getElementById('shop-search-clear');
  if(clear) clear.style.display=q?'flex':'none';
  var retail=state.products.filter(function(p){ return p.category==='retail'; });
  if(q){ var ql=q.toLowerCase(); retail=retail.filter(function(p){ return (p.name||'').toLowerCase().includes(ql)||(p.desc||'').toLowerCase().includes(ql); }); }
  if(_shopFilter==='instock') retail=retail.filter(function(p){ var vs=(p.variants||[]).map(function(v){ return typeof v==='object'?v:{label:v,price:null,stock:null}; }); if(vs.length) return vs.some(function(v){ var s=variantStock(p,v.label); return s===Infinity||s>0; }); return p.stock===undefined||p.stock===null||p.stock===''||Number(p.stock)>0; });
  else if(_shopFilter==='low') retail=retail.filter(function(p){ var vs=(p.variants||[]).map(function(v){ return typeof v==='object'?v:{label:v,price:null,stock:null}; }); if(vs.length) return vs.some(function(v){ var s=variantStock(p,v.label); return s!==Infinity&&s>0&&s<=5; }); var s=Number(p.stock||0); return s>0&&s<=5; });
  retail=retail.slice();
  if(sort==='price-asc') retail.sort(function(a,b){ return (a.price||0)-(b.price||0); });
  if(sort==='price-desc') retail.sort(function(a,b){ return (b.price||0)-(a.price||0); });
  if(sort==='name-asc') retail.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
  // OOS always last regardless of sort
  retail.sort(function(a,b){ var aO=isOOS(a),bO=isOOS(b); return aO===bO?0:aO?1:-1; });
  var countEl=document.getElementById('shop-results-count');
  if(countEl) countEl.textContent=(q||_shopFilter!=='all')?retail.length+' product'+(retail.length!==1?'s':'')+' found':'';
  var grid=document.getElementById('shop-grid');
  if(!grid) return;
  if(!retail.length){ grid.innerHTML='<div class="shop-empty"><div style="font-size:40px;margin-bottom:.8rem">🍵</div><div>No products found</div></div>'; return; }
  grid.innerHTML=retail.map(productCard).join('');
};
window.clearShopSearch = function(){
  var inp=document.getElementById('shop-search'); if(inp){ inp.value=''; inp.focus(); }
  filterShop();
};
// Load reviews when product modal opens
var _origOpenProduct = window.openProduct;
window.openProduct = function(id){
  _origOpenProduct && _origOpenProduct(id);
  if(typeof loadProductReviews==='function') loadProductReviews(id);
  var modal=document.getElementById('product-modal');
  if(modal) modal.scrollTop=0;
};

// ─── PROMOTE / UNPROMOTE PRODUCT ─────────────────────────────────────────────
window.togglePromoted = async function(id, promote){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  try{
    await updateDoc(doc(db,'products',id),{
      promoted: promote,
      promoLabel: promote ? 'This Week\'s Pick' : null,
    });
    toast(promote ? '★ Product promoted!' : 'Promotion removed');
  }catch(e){ toast('Error: '+e.message); }
};

// ─── WS UNAVAILABLE TOGGLE HELPER ────────────────────────────────────────────
window.updateWsUnavailable = function(){
  var cb   = document.getElementById('p-ws-unavailable');
  var hint = document.getElementById('p-ws-unavailable-hint');
  if(!cb) return;
  if(hint) hint.textContent = cb.checked ? 'On — product shows as unavailable' : 'Off — product is available';
};

// ─── PROMO TOGGLE HELPER ─────────────────────────────────────────────────────
window.updatePromoLabel = function(){
  var cb   = document.getElementById('p-promoted');
  var hint = document.getElementById('p-promo-label-hint');
  var wrap = document.getElementById('p-promo-label-wrap');
  if(!cb) return;
  var on = cb.checked;
  if(hint) hint.textContent = on ? 'On — product appears first with banner' : 'Off — product shows in normal order';
  if(wrap) wrap.style.display = on ? 'block' : 'none';
};
