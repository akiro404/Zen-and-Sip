// ─── PROMO CRUD ───────────────────────────────────────────────────────────────
function renderPromos(){
  document.getElementById('promos-list').innerHTML=state.promos.map(function(p){
    return '<div class="promo-item">'
      +'<span class="promo-text">'+p.text+'</span>'
      +'<div style="display:flex;gap:.5rem;align-items:center">'
      +(p.active
        ?'<span class="promo-active">Active</span><button class="btn-sm" onclick="setPromoInactive(\''+p.id+'\')">Deactivate</button>'
        :'<button class="btn-sm" onclick="setPromoActive(\''+p.id+'\')">Activate</button>')
      +'<button class="btn-sm danger" onclick="deletePromo(\''+p.id+'\')">×</button>'
      +'</div></div>';
  }).join('')||'<div style="color:var(--text-muted);padding:1rem">No promos yet.</div>';
}
window.addPromo = async function(){
  var val=document.getElementById('new-promo').value.trim();
  if(!val) return;
  await addDoc(collection(db,'promos'),{text:val,active:false,order:Date.now()});
  document.getElementById('new-promo').value='';
  toast('Promo added ✅');
};
window.deletePromo = async function(id){
  await deleteDoc(doc(db,'promos',id));
  toast('Promo removed');
};
window.setPromoActive = async function(id){
  try{ await updateDoc(doc(db,'promos',id),{active:true}); toast('Promo activated ✅'); }
  catch(e){ toast('❌ Failed: '+e.message); }
};
window.setPromoInactive = async function(id){
  try{ await updateDoc(doc(db,'promos',id),{active:false}); toast('Promo deactivated'); }
  catch(e){ toast('❌ Failed: '+e.message); }
};

// ─── DISCOUNT CODES ───────────────────────────────────────────────────────────
state.discountCodes = [];
state.appliedDiscount = null;

// Listen to discount_codes collection
function listenDiscountCodes(){
  onSnapshot(collection(db,'discount_codes'), function(snap){
    state.discountCodes = snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
    if(typeof renderDiscountCodes==='function') renderDiscountCodes();
  }, function(err){
    if(err.code!=='permission-denied') console.warn('Discount codes listener error:', err.message);
    state.discountCodes = [];
  });
}

function isCodeExpired(dc){
  if(!dc.expiry) return false;
  // Compare YYYY-MM-DD strings so timezone doesn't cause off-by-one-day bugs
  var today = new Date();
  var todayStr = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  return dc.expiry < todayStr;
}
function isCodeExhausted(dc){
  return dc.maxUses && (dc.uses||0) >= dc.maxUses;
}
function isCodeArchived(dc){
  return !!dc.archived;
}
function isCodeActive(dc){
  return !isCodeArchived(dc) && !isCodeExpired(dc) && !isCodeExhausted(dc);
}

// Auto-archive expired/exhausted codes silently
async function autoArchiveExpired(){
  for(var dc of state.discountCodes){
    if(!dc.archived && (isCodeExpired(dc)||isCodeExhausted(dc))){
      await updateDoc(doc(db,'discount_codes',dc.id),{archived:true});
    }
  }
}

function renderDiscountCodes(){
  var el = document.getElementById('discount-codes-list');
  if(!el) return;

  // Auto-archive in background
  autoArchiveExpired();

  var active   = state.discountCodes.filter(function(dc){ return !dc.archived; });
  var archived = state.discountCodes.filter(function(dc){ return dc.archived; });

  function codeRow(dc, isArch){
    var typeLabel  = dc.type==='percent' ? dc.value+'% off' : '₱'+dc.value+' off';
    var minLabel   = dc.minOrder ? ' • Min ₱'+dc.minOrder : '';
    var usesLabel  = dc.maxUses  ? ' • '+(dc.uses||0)+'/'+dc.maxUses+' uses' : ' • Unlimited';
    var expLabel   = dc.expiry   ? ' • Expires '+new Date(dc.expiry).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '';
    var expired    = isCodeExpired(dc);
    var exhausted  = isCodeExhausted(dc);
    var badge = isArch
      ? (expired   ? '<span style="background:#fef3c7;color:#92400e;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600">Expired</span>'
         : exhausted ? '<span style="background:#fee2e2;color:#991b1b;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600">Exhausted</span>'
                     : '<span style="background:#f3f4f6;color:#6b7280;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600">Archived</span>')
      : '<span style="background:#dcfce7;color:#166534;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600">Active</span>';

    var actions = isArch
      ? '<button class="btn-sm" onclick="unarchiveDiscountCode(\'' +dc.id+ '\')" style="font-size:11px" title="Restore">Restore</button>'
        +'<button class="btn-sm danger" onclick="deleteDiscountCode(\'' +dc.id+ '\')" title="Delete permanently">×</button>'
      : '<button class="btn-sm" onclick="archiveDiscountCode(\'' +dc.id+ '\')" style="font-size:11px" title="Archive">Archive</button>'
        +'<button class="btn-sm danger" onclick="deleteDiscountCode(\'' +dc.id+ '\')" title="Delete">×</button>';

    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.8rem 1rem;background:'+(isArch?'#fafafa':'#fff')+';border:1px solid var(--border);border-radius:6px;margin-bottom:.5rem;flex-wrap:wrap;gap:.5rem;opacity:'+(isArch?'.7':'1')+'">'
      +'<div>'
      +'<span style="font-size:14px;font-weight:700;color:'+(isArch?'var(--stone)':'var(--matcha)')+';font-family:monospace;letter-spacing:.05em">'+dc.code+'</span>'
      +'<span style="font-size:12px;color:var(--text-muted);margin-left:.8rem">'+typeLabel+minLabel+usesLabel+expLabel+'</span>'
      +'</div>'
      +'<div style="display:flex;gap:.5rem;align-items:center">'+badge+actions+'</div>'
      +'</div>';
  }

  var html = '';
  if(!active.length && !archived.length){
    html = '<div style="color:var(--text-muted);padding:1rem;font-size:13px">No discount codes yet.</div>';
  } else {
    html += active.map(function(dc){ return codeRow(dc,false); }).join('');
    if(!active.length) html += '<div style="color:var(--text-muted);font-size:13px;padding:.5rem 0 1rem">No active codes.</div>';

    if(archived.length){
      html += '<div style="margin-top:1rem">'
        +'<button onclick="toggleArchivePanel()" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--stone);padding:.4rem 0;display:flex;align-items:center;gap:.4rem;font-weight:600">'
        +'<span id="archive-chevron">▼</span> Archived ('+archived.length+')'
        +'</button>'
        +'<div id="archive-panel" style="margin-top:.6rem">'
        +archived.map(function(dc){ return codeRow(dc,true); }).join('')
        +'</div>'
        +'</div>';
    }
  }
  el.innerHTML = html;
}
window.toggleArchivePanel = function(){
  var panel = document.getElementById('archive-panel');
  var chev  = document.getElementById('archive-chevron');
  if(!panel) return;
  var hidden = panel.style.display==='none';
  panel.style.display = hidden ? 'block' : 'none';
  chev.textContent = hidden ? '▼' : '▶';
};

window.addDiscountCode = async function(){
  var code   = (document.getElementById('dc-code').value||'').trim().toUpperCase();
  var type   = document.getElementById('dc-type').value;
  var value  = parseFloat(document.getElementById('dc-value').value);
  var min    = parseFloat(document.getElementById('dc-min').value)||0;
  var maxU   = parseInt(document.getElementById('dc-maxuses').value)||0;
  var expiry = document.getElementById('dc-expiry').value||'';
  if(!code || !value){ toast('Enter a code and value'); return; }
  if(type==='percent' && (value<=0||value>100)){ toast('Percent must be 1–100'); return; }
  if(expiry && expiry < new Date().toISOString().slice(0,10)){ toast('Expiry date must be in the future'); return; }
  if(state.discountCodes.find(function(d){ return d.code===code; })){ toast('Code already exists'); return; }
  await addDoc(collection(db,'discount_codes'),{
    code:code, type:type, value:value,
    minOrder:min||0, maxUses:maxU||0, uses:0,
    expiry:expiry||'', archived:false
  });
  document.getElementById('dc-code').value='';
  document.getElementById('dc-value').value='';
  document.getElementById('dc-min').value='';
  document.getElementById('dc-maxuses').value='';
  document.getElementById('dc-expiry').value='';
  toast('Discount code added ✅');
};

window.deleteDiscountCode = async function(id){
  if(!confirm('Delete this code permanently? This cannot be undone.')) return;
  await deleteDoc(doc(db,'discount_codes',id));
  toast('Code deleted');
};
window.archiveDiscountCode = async function(id){
  await updateDoc(doc(db,'discount_codes',id),{archived:true});
  toast('Code archived');
};
window.unarchiveDiscountCode = async function(id){
  await updateDoc(doc(db,'discount_codes',id),{archived:false});
  toast('Code restored ✅');
};

// Apply promo code at checkout
window.applyPromoCode = function(){
  var input = (document.getElementById('co-promo-input').value||'').trim().toUpperCase();
  var msgEl = document.getElementById('co-promo-msg');
  msgEl.style.display='block';
  if(!input){ 
    state.appliedDiscount=null; 
    updateCheckoutTotals();
    msgEl.style.color='var(--text-muted)'; msgEl.textContent='Code cleared.';
    return; 
  }
  var dc = state.discountCodes.find(function(d){ return d.code===input; });
  if(!dc){
    msgEl.style.color='#991b1b'; msgEl.textContent='❌ Invalid code.';
    state.appliedDiscount=null; updateCheckoutTotals(); return;
  }
  if(dc.archived){
    msgEl.style.color='#991b1b'; msgEl.textContent='❌ This code is no longer available.';
    state.appliedDiscount=null; updateCheckoutTotals(); return;
  }
  if(dc.expiry && dc.expiry < new Date().toISOString().slice(0,10)){
    msgEl.style.color='#991b1b'; msgEl.textContent='❌ This code has expired.';
    state.appliedDiscount=null; updateCheckoutTotals(); return;
  }
  if(dc.maxUses && (dc.uses||0)>=dc.maxUses){
    msgEl.style.color='#991b1b'; msgEl.textContent='❌ This code has reached its usage limit.';
    state.appliedDiscount=null; updateCheckoutTotals(); return;
  }
  var subtotal = state.cart.reduce(function(s,i){ return s+(i.price*i.qty); },0);
  if(dc.minOrder && subtotal < dc.minOrder){ 
    msgEl.style.color='#991b1b'; msgEl.textContent='❌ Minimum order of ₱'+dc.minOrder+' required (your subtotal: ₱'+subtotal.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})+').'; 
    state.appliedDiscount=null; updateCheckoutTotals(); return; 
  }
  state.appliedDiscount = dc;
  updateCheckoutTotals();
  var saving = dc.type==='percent' ? (subtotal*dc.value/100) : dc.value;
  msgEl.style.color='#166534'; 
  msgEl.textContent='✅ Code applied! You save ₱'+Math.min(saving,subtotal).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
};


function updatePromoStrip(){
  var active=state.promos.filter(function(p){ return p.active; });
  var strip=document.getElementById('promo-strip');
  var track=document.getElementById('promo-track');
  if(!strip||!track) return;
  if(!active.length){ strip.style.display='none'; return; }
  strip.style.display='';

  // Build exactly one set of items and measure its pixel width,
  // then duplicate it once — animation scrolls by exactly that width
  // so the loop is perfectly seamless with zero gap.
  var items=active.map(function(p){ return '<span>'+p.text+'</span>'; }).join('');
  track.style.animation='none';
  track.innerHTML=items;           // one copy to measure
  track.offsetHeight;              // force layout
  var oneSetWidth=track.scrollWidth;

  // Two copies: first scrolls off-screen, second takes its place seamlessly
  track.innerHTML=items+items;

  // Remove any old keyframe rule and inject a new one with the exact pixel offset
  var styleId='zs-promo-kf';
  var old=document.getElementById(styleId);
  if(old) old.remove();
  var style=document.createElement('style');
  style.id=styleId;
  style.textContent='@keyframes scroll-promo-px{'
    +'0%{transform:translateX(0)}'
    +'100%{transform:translateX(-'+oneSetWidth+'px)}'
    +'}';
  document.head.appendChild(style);

  // Speed: ~80px/s feels natural; clamp between 12s and 40s
  var duration=Math.min(40, Math.max(12, Math.round(oneSetWidth/80)));
  track.offsetHeight;              // force reflow before re-applying animation
  track.style.animation='scroll-promo-px '+duration+'s linear infinite';
}
