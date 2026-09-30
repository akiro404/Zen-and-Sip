if(typeof warmFromCache==='function') warmFromCache();

// ─── CUSTOMER ERROR MODAL ─────────────────────────────────────────────────────
window.showErrorModal = function(friendlyMsg, errorDetail, adminUrl){
  var old=document.getElementById('zns-error-modal');
  if(old) old.remove();
  var overlay=document.createElement('div');
  overlay.id='zns-error-modal';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box';
  overlay.innerHTML=
    '<div style="background:#fff;border-radius:12px;padding:2rem 1.5rem;max-width:400px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.25)">'
    +'<div style="font-size:44px;margin-bottom:.6rem">😕</div>'
    +'<h3 style="font-size:19px;font-weight:700;color:#2d3a2e;margin:0 0 .5rem;font-family:Georgia,serif">Oops! Something went wrong</h3>'
    +'<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 1.4rem">'+friendlyMsg+'</p>'
    +'<div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">'
    +'<button id="zns-err-notify" style="background:#3d5a3e;color:#fff;border:none;padding:10px 18px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500">📣 Let the admin know</button>'
    +'<button onclick="document.getElementById(\'zns-error-modal\').remove()" style="background:none;border:1px solid #e5e7eb;padding:10px 16px;border-radius:6px;font-size:13px;cursor:pointer;color:#6b7280">Close</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click',function(e){ if(e.target===overlay) overlay.remove(); });
  document.getElementById('zns-err-notify').addEventListener('click',function(){
    var btn=this;
    btn.textContent='Sending…'; btn.disabled=true;
    var snippet=(errorDetail||'').toString().slice(0,100);
    if(typeof sendAdminPushNotification==='function'){
      sendAdminPushNotification('🔴 Customer Error', snippet||friendlyMsg.slice(0,80), adminUrl||'https://zennsip.com');
    }
    setTimeout(function(){ btn.textContent='✓ Admin notified'; btn.style.background='#16a34a'; },700);
  });
};

// ─── QUOTATION ACCEPT / DECLINE FROM EMAIL LINK ───────────────────────────────
(function(){
  var params=new URLSearchParams(window.location.search);
  var action=params.get('qt_action');
  var qtId=params.get('qt_id');
  if(!action||!qtId) return;
  window.history.replaceState({},'',window.location.pathname);

  var isAccept=action==='accept';

  // Build payment method HTML from existing PAYMENT_METHODS config
  function buildPaymentCards(){
    if(typeof PAYMENT_METHODS==='undefined'||!PAYMENT_METHODS.length) return '';
    return PAYMENT_METHODS.map(function(m){
      return '<div style="display:flex;align-items:center;gap:.8rem;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:.8rem 1rem;margin-bottom:.5rem;text-align:left">'
        +'<div style="font-size:24px;flex-shrink:0">'+m.logo+'</div>'
        +'<div><div style="font-size:13px;font-weight:700;color:#2d3a2e">'+m.name+'</div>'
        +'<div style="font-size:13px;color:#444;font-weight:600;letter-spacing:.04em">'+m.accountNumber+'</div>'
        +'<div style="font-size:11px;color:#888">'+m.accountName+'</div></div>'
        +'</div>';
    }).join('');
  }

  var _qtaLoadedData=null; // quotation data loaded on accept — reused by qtaSubmitProof

  var card=document.createElement('div');
  card.style.cssText='background:#fff;border-radius:14px;padding:2rem;max-width:460px;width:100%;max-height:90vh;overflow-y:auto';

  if(isAccept){
    card.innerHTML=
      '<div style="font-size:40px;text-align:center;margin-bottom:.8rem">✅</div>'
      +'<div id="qta-title" style="font-size:18px;font-weight:700;color:#2d3a2e;text-align:center;margin-bottom:.3rem">Processing…</div>'
      +'<div id="qta-sub" style="font-size:13px;color:#888;text-align:center;margin-bottom:1.4rem;line-height:1.5"></div>'
      +'<div id="qta-payment-section" style="display:none">'
      +'<div style="font-size:13px;font-weight:600;color:#2d3a2e;margin-bottom:.6rem">Send payment to any of the following:</div>'
      +buildPaymentCards()
      +'<div style="font-size:12px;color:#666;margin:1rem 0 .6rem">Once paid, upload your proof of payment below:</div>'
      +'<input type="file" id="qta-proof-input" accept="image/*" multiple style="display:none" onchange="qtaPreviewProof(this)">'
      +'<div id="qta-drop-zone" onclick="document.getElementById(\'qta-proof-input\').click()" '
        +'style="border:2px dashed #d1d5db;border-radius:8px;padding:1.4rem;text-align:center;cursor:pointer;margin-bottom:.8rem;transition:border-color .2s" '
        +'ondragover="event.preventDefault();this.style.borderColor=\'#3d5a3e\'" '
        +'ondragleave="this.style.borderColor=\'#d1d5db\'" '
        +'ondrop="event.preventDefault();qtaPreviewProof({files:event.dataTransfer.files})">'
      +'<div id="qta-proof-placeholder"><div style="font-size:28px;margin-bottom:.4rem">📎</div>'
      +'<div style="font-size:13px;color:#888">Click or drag your payment screenshot(s) here</div>'
      +'<div style="font-size:11px;color:#aaa;margin-top:.2rem">Multiple allowed · JPG, PNG · max 5MB each</div></div>'
      +'<div id="qta-proof-thumbs" style="display:none;flex-wrap:wrap;gap:.4rem;justify-content:center;padding:.2rem 0"></div>'
      +'</div>'
      +'<button id="qta-submit-btn" onclick="qtaSubmitProof(\''+qtId+'\')" '
        +'style="background:#3d5a3e;color:#fff;border:none;padding:11px;border-radius:7px;font-size:14px;cursor:pointer;font-weight:600;width:100%;margin-bottom:.6rem">Submit Proof of Payment</button>'
      +'<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:none;border:1px solid #e5e7eb;padding:9px;border-radius:7px;font-size:13px;cursor:pointer;width:100%;color:#666">Close — I\'ll submit later</button>'
      +'</div>'
      +'<div id="qta-done-section" style="display:none;text-align:center">'
      +'<div style="font-size:40px;margin-bottom:.8rem">🎉</div>'
      +'<div style="font-size:16px;font-weight:700;color:#2d3a2e;margin-bottom:.5rem">Order placed!</div>'
      +'<div style="font-size:13px;color:#888;margin-bottom:1.4rem;line-height:1.6">Your payment proof has been received and your order has been created. We\'ll verify your payment and prepare it for shipping shortly. 🍵</div>'
      +'<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:#3d5a3e;color:#fff;border:none;padding:10px 32px;border-radius:6px;font-size:14px;cursor:pointer;font-weight:500">Done</button>'
      +'</div>';
  } else {
    card.innerHTML=
      '<div style="font-size:40px;text-align:center;margin-bottom:.8rem">❌</div>'
      +'<div id="qta-title" style="font-size:18px;font-weight:700;color:#2d3a2e;text-align:center;margin-bottom:.5rem">Processing…</div>'
      +'<div id="qta-sub" style="font-size:13px;color:#888;text-align:center;margin-bottom:1.6rem;line-height:1.5"></div>'
      +'<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:#3d5a3e;color:#fff;border:none;padding:10px 32px;border-radius:6px;font-size:14px;cursor:pointer;font-weight:500;display:block;margin:0 auto">Close</button>';
  }

  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function setMsg(title,sub){
    var t=document.getElementById('qta-title'); if(t) t.textContent=title;
    var s=document.getElementById('qta-sub');   if(s) s.textContent=sub;
  }

  (async function(){
    try{
      var qtRef=doc(db,'quotations',qtId);
      var snap=await getDoc(qtRef);
      if(!snap.exists()){ setMsg('Quotation not found.','This link may be expired or invalid.'); return; }
      var qt=snap.data();
      _qtaLoadedData=qt; // store so qtaSubmitProof can use it without a second Firestore read
      if(qt.status==='Accepted'&&qt.proofURL){
        setMsg('Already submitted!','Your payment proof has already been received.');
        var ps=document.getElementById('qta-payment-section'); if(ps) ps.style.display='none';
        var ds=document.getElementById('qta-done-section'); if(ds) ds.style.display='block';
        return;
      }
      if(qt.status==='Declined'){ setMsg('Quotation declined.','This quotation has already been declined.'); return; }
      var newStatus=isAccept?'Accepted':'Declined';
      try{ await updateDoc(qtRef,{status:newStatus,updatedAt:serverTimestamp()}); }catch(e){ /* best-effort — Firestore rules may restrict this */ }
      if(isAccept){
        setMsg('Quotation accepted!','Complete your payment below to confirm your order.');
        var ps=document.getElementById('qta-payment-section'); if(ps) ps.style.display='block';
      } else {
        setMsg('Quotation declined.','Got it — feel free to reach out if you\'d like to revisit.');
      }
    }catch(e){ setMsg('Something went wrong.',e.message||'Please try again or contact us.'); }
  })();

  // Proof preview
  window._qtaProofFiles=[];
  function qtaRenderThumbs(){
    var thumbsEl=document.getElementById('qta-proof-thumbs');
    var ph=document.getElementById('qta-proof-placeholder');
    if(!thumbsEl) return;
    if(!window._qtaProofFiles.length){
      thumbsEl.style.display='none';
      if(ph) ph.style.display='block';
      return;
    }
    thumbsEl.innerHTML=window._qtaProofFiles.map(function(f,i){
      return '<div style="position:relative;display:inline-block">'
        +'<img src="'+URL.createObjectURL(f)+'" style="width:64px;height:64px;object-fit:cover;border-radius:5px;border:2px solid #c8d8c5">'
        +'<button onclick="qtaProofRemove('+i+');event.stopPropagation()" style="position:absolute;top:-5px;right:-5px;background:#e24b4a;color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button>'
        +'</div>';
    }).join('');
    thumbsEl.style.display='flex';
    if(ph) ph.style.display='none';
  }
  window.qtaProofRemove=function(i){
    window._qtaProofFiles.splice(i,1);
    qtaRenderThumbs();
  };
  window.qtaPreviewProof=function(input){
    var files=Array.from(input.files||[]);
    if(!files.length) return;
    var max=3;
    files.forEach(function(f){
      if(window._qtaProofFiles.length>=max) return;
      if(f.size>5*1024*1024){ alert('File too large — max 5MB per image.'); return; }
      window._qtaProofFiles.push(f);
    });
    if(input.value!==undefined) input.value='';
    qtaRenderThumbs();
  };

  // Submit proof + auto-create order
  window.qtaSubmitProof=async function(id){
    if(!window._qtaProofFiles||!window._qtaProofFiles.length){ alert('Please select your proof of payment first.'); return; }
    var btn=document.getElementById('qta-submit-btn');
    if(btn){ btn.textContent='Uploading…'; btn.disabled=true; }
    try{
      function _compressQtaFile(file){
        return new Promise(function(resolve,reject){
          var img=new Image(), url=URL.createObjectURL(file);
          img.onload=function(){
            var canvas=document.createElement('canvas');
            var MAX=700; var w=img.width,h=img.height;
            if(w>h&&w>MAX){h=Math.round(h*MAX/w);w=MAX;}
            else if(h>=w&&h>MAX){w=Math.round(w*MAX/h);h=MAX;}
            canvas.width=w; canvas.height=h;
            canvas.getContext('2d').drawImage(img,0,0,w,h);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg',0.65));
          };
          img.onerror=reject; img.src=url;
        });
      }
      var proofURLs=[];
      for(var pi=0;pi<window._qtaProofFiles.length;pi++){
        proofURLs.push(await _compressQtaFile(window._qtaProofFiles[pi]));
      }

      // Use already-loaded quotation data — no extra Firestore read needed
      if(btn) btn.textContent='Creating order…';
      var qt=_qtaLoadedData||null;
      var q=qt&&qt.quotation||null;

      // Build items: prefer admin-set quotation lines, fall back to original requested items
      var orderItems=[];
      if(q&&q.lines&&q.lines.length){
        orderItems=q.lines.map(function(l){
          return {name:l.desc||'',qty:l.qty||1,variant:l.unit||'',price:l.price||0,total:(l.qty||1)*(l.price||0)};
        });
      } else if(qt&&qt.items&&qt.items.length){
        orderItems=qt.items.map(function(it){
          return {name:it.productName||'',qty:Number(it.quantity)||1,variant:it.type||'',price:0,total:0};
        });
      }

      // Create the order
      var oRef='WQ-'+Date.now().toString(36).toUpperCase();
      await addDoc(collection(db,'orders'),{
        ref:oRef,
        customer:(qt&&qt.name)?qt.name:'Wholesale Partner',
        email:(qt&&qt.email)?qt.email:'',
        phone:qt?(qt.phone||''):'',
        address:(q&&q.province)||(qt&&qt.province)||'',
        items:orderItems.length?orderItems:[{name:qt?(qt.productName||'Wholesale Order'):'Wholesale Order',qty:1,variant:'',price:0,total:0}],
        total:q?(q.total||0):0,
        shipping:q?(q.shippingFee||0):0,
        shippingMethod:q&&q.courier==='lalamove'?'Lalamove':'J&T Express',
        courier:q&&q.courier==='lalamove'?'Lalamove':'J&T Express',
        type:'wholesale-quotation',
        quotationId:id,
        proofURL:proofURLs[0],
        proofURLs:proofURLs,
        status:'Pending',
        notes:q?(q.notes||''):'',
        createdAt:serverTimestamp(),
      });

      // Update quotation: mark accepted, attach proof + order ref (best-effort)
      try{
        await updateDoc(doc(db,'quotations',id),{
          proofURL:proofURLs[0],
          proofURLs:proofURLs,
          proofSubmittedAt:serverTimestamp(),
          status:'Accepted',
          orderRef:oRef,
          updatedAt:serverTimestamp(),
        });
      }catch(e){ /* Firestore rules may restrict this — order was already created above */ }

      // Notify admin
      if(typeof sendAdminPushNotification==='function'){
        var cName=qt?(qt.name||'Customer'):'Customer';
        sendAdminPushNotification(
          '💰 Quotation Paid — '+cName,
          oRef+' has been auto-created in Orders',
          'https://zennsip.com/?dash=orders'
        );
      }

      var ps=document.getElementById('qta-payment-section'); if(ps) ps.style.display='none';
      var ds=document.getElementById('qta-done-section');   if(ds) ds.style.display='block';
      window._qtaProofFiles=[];
    }catch(e){
      if(btn){ btn.textContent='Submit Proof of Payment'; btn.disabled=false; }
      showErrorModal('We couldn\'t process your payment submission. Please check your internet connection and try again.',e.message,'https://zennsip.com/?dash=quotations');
    }
  };
})();

async function seedProducts(){
  const snap = await getDocs(collection(db,'products'));
  if(!snap.empty) return;
  const defaults=[
    {name:'Ceremonial Grade Matcha',desc:'Premium stone-ground matcha from Uji, Japan. Vibrant umami-rich flavor.',price:580,stock:50,variants:['30g','60g','100g'],category:'retail',emoji:'🍵',order:1},
    {name:'Matcha Latte Blend',desc:'Smooth, creamy blend perfect for lattes. Lower bitterness, higher sweetness.',price:420,stock:80,variants:['200g'],category:'retail',emoji:'🥛',order:2},
    {name:'Usucha Matcha',desc:'Daily drinking grade. Clean, bright, slightly nutty profile.',price:320,stock:120,variants:['50g','100g'],category:'retail',emoji:'🌿',order:3},
    {name:'Matcha Whisk (Chasen)',desc:'Traditional 80-prong bamboo whisk. Handcrafted in Nara.',price:890,stock:30,variants:['1pc'],category:'retail',emoji:'🎋',order:4},
    {name:'Starter Kit',desc:'Everything you need: matcha tin, whisk, bowl, and scoop.',price:1250,stock:20,variants:['Classic','Deluxe'],category:'retail',emoji:'🎁',order:5},
  ];
  for(var p of defaults) await addDoc(collection(db,'products'),{...p});
}

async function seedPromos(){
  const snap = await getDocs(collection(db,'promos'));
  if(!snap.empty) return;
  const defaults=[
    {text:'✦ Free shipping on orders over ₱1,500',active:true,order:1},
    {text:'✦ New ceremonial grade blend just dropped',active:true,order:2},
    {text:'✦ Wholesale inquiries now open',active:true,order:3},
  ];
  for(var p of defaults) await addDoc(collection(db,'promos'),{...p});
}

async function seedHero(){
  const snap = await getDocs(collection(db,'settings'));
  if(!snap.empty) return;
  await setDoc(doc(db,'settings','hero'),{
    title:'Pure Matcha Redefined.',
    sub:'Ceremonial grade, single-origin matcha sourced from the finest estates in Uji, Japan.',
    btn:'Shop Now',
    eye:'New Collection — '+getDynamicSeason(),
  });
}

function listenProducts(){
  onSnapshot(collection(db,'products'), snap=>{
    state.products = snap.docs.map(d=>({id:d.id,...d.data()}));
    state.products.sort((a,b)=>(a.order||0)-(b.order||0));
    cacheSet('zs_products', state.products);
    renderShop();
    renderWholesale();
    renderProductTable(state.searchFilter);
    updateStats();
  }, function(err){ console.warn('listenProducts:', err.code); });
}

function listenOrders(){
  onSnapshot(collection(db,'orders'), snap=>{
    state.orders = snap.docs.map(d=>({id:d.id,...d.data()}));
    state.orders.sort((a,b)=>{
      var ta=a.createdAt?.seconds||0, tb=b.createdAt?.seconds||0;
      return tb-ta;
    });
    renderOrders(state.searchFilter, state.statusFilter);
    renderOverviewOrders();
    updateStats();
    var overview = document.getElementById('dash-overview');
    if(overview && overview.classList.contains('active')){
      if(typeof renderRevenueChart === 'function') renderRevenueChart(state.orders || []);
      if(typeof renderStatusChart  === 'function') renderStatusChart(state.orders || []);
      if(typeof renderTopProducts  === 'function') renderTopProducts(state.orders || []);
    }
  }, function(err){ if(err.code!=='permission-denied') console.warn('listenOrders:',err.code); });
}

function listenPromos(){
  onSnapshot(collection(db,'promos'), snap=>{
    state.promos = snap.docs.map(d=>({id:d.id,...d.data()}));
    state.promos.sort((a,b)=>(a.order||0)-(b.order||0));
    cacheSet('zs_promos', state.promos);
    renderPromos();
    updatePromoStrip();
    updateStats();
  }, function(err){ console.warn('listenPromos:', err.code); });
}

function listenHero(){
  onSnapshot(doc(db,'settings','hero'), snap=>{
    if(snap.exists()){
      state.hero={...snap.data()};
      applyHeroToPage();
      var hTitle=document.getElementById('h-title');
      var hSub=document.getElementById('h-sub');
      var hBtn=document.getElementById('h-btn');
      var hEye=document.getElementById('h-eye');
      if(hTitle) hTitle.value=state.hero.title||'';
      if(hSub)   hSub.value=state.hero.sub||'';
      if(hBtn)   hBtn.value=state.hero.btn||'';
      if(hEye)   hEye.value=state.hero.eye||'';
    }
  });
}

function applyHeroToPage(){
  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  if(!state.hero.title && !state.hero.eye) return;
  document.getElementById('hero-eyebrow').textContent = state.hero.eye || '';
  getDoc(doc(db,'settings','hero-carousel')).then(function(snap){
    if(!snap.exists()) return;
    var imgs = snap.data().images||[];
    buildHomeGallery(imgs);
  }).catch(function(){});
  var t = document.getElementById('hero-title');
  var raw = state.hero.title || '';
  var words = raw.split(' ');
  var last = words.pop() || '';
  t.innerHTML = esc(words.join(' ')) + (words.length ? ' ' : '') + '<em>' + esc(last) + '</em>';
  document.getElementById('hero-desc').textContent = state.hero.sub || '';
  document.getElementById('hero-btn').textContent = state.hero.btn || '';
  if(window._revealHero) window._revealHero();
  try{ localStorage.setItem('zs_hero', JSON.stringify(state.hero)); }catch(e){}
}

var _fcImages = [];
var _fcIndex  = 0;
var _fcTimer  = null;

var _galIdx = 0;
var _galTimer = null;
var _galImgs = [];

function buildHomeGallery(imgs){
  var grid = document.getElementById('home-gallery-grid');
  if(!grid) return;
  if(!imgs || !imgs.length){
    grid.innerHTML = '<div class="gallery-empty">📸 Featured photos coming soon</div>';
    return;
  }
  _galImgs = imgs.slice();

  grid.innerHTML = _galImgs.map(function(src, i){
    return '<div class="gallery-card">'
      +'<img src="'+src+'" alt="Zen & Sip photo '+(i+1)+'" loading="lazy" decoding="async">'
      +'<div class="gallery-card-monogram">'
        +'<span class="gcm-line"></span>'
        +'<span class="gcm-text">ZS</span>'
        +'<span class="gcm-line"></span>'
      +'</div>'
      +'</div>';
  }).join('');

  _galIdx = 0;
  _galleryApplyTransform(false);
  _galleryStartAuto();
  _galleryAttachDrag();
}

function _galleryCardWidth(){
  var grid = document.getElementById('home-gallery-grid');
  if(!grid) return 234;
  var card = grid.querySelector('.gallery-card');
  if(!card) return 234;
  return card.offsetWidth + 14; // card + gap
}

function _galleryMaxIdx(){
  var outer = document.getElementById('home-gallery-outer');
  var grid = document.getElementById('home-gallery-grid');
  if(!outer||!grid) return 0;
  var visibleCount = Math.floor(outer.offsetWidth / _galleryCardWidth());
  return Math.max(0, _galImgs.length - visibleCount);
}

function _galleryApplyTransform(animate){
  var grid = document.getElementById('home-gallery-grid');
  if(!grid) return;
  if(!animate){ grid.style.transition='none'; setTimeout(function(){ grid.style.transition=''; }, 50); }
  grid.style.transform = 'translateX(-'+(_galIdx * _galleryCardWidth())+'px)';
}

window.galleryMove = function(dir){
  var max = _galleryMaxIdx();
  _galIdx = Math.max(0, Math.min(_galIdx + dir, max));
  _galleryApplyTransform(true);
  // Update arrow visibility
  var prev = document.getElementById('gallery-prev');
  var next = document.getElementById('gallery-next');
  if(prev) prev.style.opacity = _galIdx === 0 ? '.4' : '1';
  if(next) next.style.opacity = _galIdx >= max ? '.4' : '1';
  _galleryResetAuto();
};

function _galleryStartAuto(){
  _galleryStopAuto();
  if(_galImgs.length < 2) return;
  _galTimer = setInterval(function(){
    var max = _galleryMaxIdx();
    _galIdx = _galIdx >= max ? 0 : _galIdx + 1;
    _galleryApplyTransform(true);
    var prev = document.getElementById('gallery-prev');
    var next = document.getElementById('gallery-next');
    if(prev) prev.style.opacity = _galIdx === 0 ? '.4' : '1';
    if(next) next.style.opacity = _galIdx >= max ? '.4' : '1';
  }, 3200);
}

function _galleryStopAuto(){
  if(_galTimer){ clearInterval(_galTimer); _galTimer = null; }
}

function _galleryResetAuto(){
  _galleryStopAuto();
  _galleryStartAuto();
}

function _galleryAttachDrag(){
  var outer = document.getElementById('home-gallery-outer');
  if(!outer || outer._dragAttached) return;
  outer._dragAttached = true;
  var startX = 0, dragging = false;
  outer.addEventListener('mousedown', function(e){ startX = e.clientX; dragging = true; _galleryStopAuto(); });
  outer.addEventListener('mousemove', function(e){ if(!dragging) return; });
  outer.addEventListener('mouseup', function(e){
    if(!dragging) return; dragging = false;
    var diff = startX - e.clientX;
    if(Math.abs(diff) > 40) galleryMove(diff > 0 ? 1 : -1);
    _galleryStartAuto();
  });
  outer.addEventListener('mouseleave', function(){ dragging = false; _galleryStartAuto(); });
  // Touch
  outer.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; _galleryStopAuto(); }, {passive:true});
  outer.addEventListener('touchend', function(e){
    var diff = startX - e.changedTouches[0].clientX;
    if(Math.abs(diff) > 40) galleryMove(diff > 0 ? 1 : -1);
    _galleryStartAuto();
  }, {passive:true});
  // Pause on hover
  outer.addEventListener('mouseenter', _galleryStopAuto);
  outer.addEventListener('mouseleave', _galleryStartAuto);
}

function buildFooterCarousel(imgs){
  _fcImages = imgs || [];
  var track  = document.getElementById('footer-carousel-track');
  var dots   = document.getElementById('footer-carousel-dots');
  var empty  = document.getElementById('footer-carousel-empty');
  if(!track) return;
  if(!_fcImages.length){
    if(empty) empty.style.display = 'flex';
    return;
  }
  if(empty) empty.style.display = 'none';
  track.innerHTML = _fcImages.map(function(src, i){
    return '<div class="footer-carousel-slide"><img src="'+src+'" alt="Zen & Sip photo '+(i+1)+'" loading="lazy" decoding="async"></div>';
  }).join('');
  if(dots){
    dots.innerHTML = _fcImages.map(function(_, i){
      return '<button class="fc-dot'+(i===0?' active':'')+'" onclick="footerCarouselGoTo('+i+')" aria-label="Photo '+(i+1)+'"></button>';
    }).join('');
  }
  _fcIndex = 0;
  footerCarouselGoTo(0, false);
  startFooterCarousel();
}

window.footerCarouselGoTo = function(idx, animate){
  var track = document.getElementById('footer-carousel-track');
  if(!track || !_fcImages.length) return;
  if(animate === false){
    track.style.transition = 'none';
    setTimeout(function(){ track.style.transition = ''; }, 50);
  }
  _fcIndex = ((idx % _fcImages.length) + _fcImages.length) % _fcImages.length;
  track.style.transform = 'translateX(-'+(_fcIndex * 100)+'%)';
  document.querySelectorAll('.fc-dot').forEach(function(d, i){
    d.classList.toggle('active', i === _fcIndex);
  });
};

window.footerCarouselMove = function(dir){
  footerCarouselGoTo(_fcIndex + dir);
  stopFooterCarousel();
  startFooterCarousel();
};

function startFooterCarousel(){
  if(_fcImages.length < 2) return;
  stopFooterCarousel();
  _fcTimer = setInterval(function(){
    footerCarouselGoTo(_fcIndex + 1);
  }, 4000);
}

function stopFooterCarousel(){
  if(_fcTimer){ clearInterval(_fcTimer); _fcTimer = null; }
}

document.addEventListener('DOMContentLoaded', function(){
  var fc = document.getElementById('footer-carousel');
  if(fc){
    fc.addEventListener('mouseenter', stopFooterCarousel);
    fc.addEventListener('mouseleave', startFooterCarousel);
    var touchX = 0;
    fc.addEventListener('touchstart', function(e){ touchX = e.touches[0].clientX; }, {passive:true});
    fc.addEventListener('touchend', function(e){
      var diff = touchX - e.changedTouches[0].clientX;
      if(Math.abs(diff) > 40) footerCarouselMove(diff > 0 ? 1 : -1);
    }, {passive:true});
  }
});
