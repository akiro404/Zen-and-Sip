// ─── PAGE ROUTING ─────────────────────────────────────────────────────────────
window.showPage = function(id){
  if(id==='dashboard'&&!adminLoggedIn){openSecretLogin();return;}
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.remove('active'));
  var map={home:0,shop:1,wholesale:2};
  if(map[id]!==undefined) document.querySelectorAll('.nav-link')[map[id]].classList.add('active');
  window.location.hash = id==='home' ? '' : id;
};

// Hash router — reads URL hash on load so email links like #track?ref=WSO-123 work
(function initHashRouter(){
  function routeHash(){
    var hash = window.location.hash.replace('#','');
    var page = hash.split('?')[0];
    var validPages = ['home','shop','wholesale','track','dashboard'];
    if(page && validPages.includes(page)){
      if(page==='dashboard') return; // don't auto-open admin
      // Use setTimeout so DOM is ready
      setTimeout(function(){
        document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
        var el = document.getElementById('page-'+page);
        if(el) el.classList.add('active');
        var map={home:0,shop:1,wholesale:2};
        document.querySelectorAll('.nav-link').forEach(function(l){l.classList.remove('active');});
        if(map[page]!==undefined) document.querySelectorAll('.nav-link')[map[page]].classList.add('active');
        // Auto-fill track order ref from query param
        if(page==='track'){
          var qmatch = hash.match(/[?&]ref=([^&]+)/);
          if(qmatch){
            var refEl = document.getElementById('track-order');
            if(refEl && !refEl.value){
              refEl.value = decodeURIComponent(qmatch[1]);
              if(window.trackOrder) setTimeout(trackOrder, 100);
            }
          }
        }
      }, 50);
    }
  }
  window.addEventListener('hashchange', routeHash);
  // Run on load after a brief delay to let app.js init
  window.addEventListener('load', function(){ setTimeout(routeHash, 200); });
})();
window.showDash = function(id,btn){
  document.querySelectorAll('.dash-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.dash-nav-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('dash-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
};

// ─── SECRET ADMIN PANEL ───────────────────────────────────────────────────────
// ⚠️ Change this password!

// ─── DYNAMIC SEASON & YEAR ────────────────────────────────────────────────────
function getDynamicSeason() {
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth() + 1; // 1-12
  var season;
  if (month >= 3 && month <= 5) season = 'Spring';
  else if (month >= 6 && month <= 8) season = 'Summer';
  else if (month >= 9 && month <= 11) season = 'Autumn';
  else season = 'Winter';
  return season + ' ' + year;
}
function updateDynamicSeason() {
  // Hero eyebrow is now set entirely by listenHero() from Firestore.
  // Only update the admin form placeholder here.
  var hEye = document.getElementById('h-eye');
  if (hEye && !hEye.value) hEye.placeholder = 'New Collection — ' + getDynamicSeason();
}

var adminLoggedIn = false;
var logoClicks = [];
var CLICK_WINDOW = 2500;

// ─── FIREBASE AUTH STATE ──────────────────────────────────────────────────────
onAuthStateChanged(auth, function(user){
  window._authStateResolved = true;
  if(user){
    adminLoggedIn = true;
    document.getElementById('admin-logout-btn').style.display='inline-flex';
    document.getElementById('admin-dash-btn').style.display='inline-flex';
    if(typeof startAdminListeners === 'function') startAdminListeners();
    else setTimeout(function(){ if(typeof startAdminListeners==='function') startAdminListeners(); }, 500);
    // Register this device for push notifications via OneSignal
    setTimeout(registerAdminPushOneSignal, 1500);
    // Auto-navigate if opened from a push notification
    var _dashParam = new URLSearchParams(window.location.search).get('dash');
    if(_dashParam){
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(function(){
        showPage('dashboard');
        setTimeout(function(){
          var btn = document.querySelector('.dash-nav-item[onclick*="\''+_dashParam+'\'"]');
          if(typeof showDash === 'function') showDash(_dashParam, btn);
        }, 300);
      }, 600);
    }
  } else {
    adminLoggedIn = false;
    adminListenersStarted = false;
    document.getElementById('admin-logout-btn').style.display='none';
    document.getElementById('admin-dash-btn').style.display='none';
    if(document.getElementById('page-dashboard') && document.getElementById('page-dashboard').classList.contains('active')){
      showPage('home');
    }
    loadStoreSettings(); // load free shipping threshold for customers
    if(typeof listenDiscountCodes==='function') listenDiscountCodes(); // load discount codes for checkout
  }
  // Re-evaluate maintenance overlay now that auth state is confirmed
  loadMaintenanceMode();
});

window.handleLogoClick = function(){
  var now=Date.now();
  logoClicks=logoClicks.filter(t=>now-t<CLICK_WINDOW);
  logoClicks.push(now);
  if(logoClicks.length>=5){logoClicks=[];openSecretLogin();}
};
function openSecretLogin(){
  var ov=document.getElementById('secret-overlay');
  ov.style.display='flex';
  document.getElementById('secret-pw-input').value='';
  document.getElementById('secret-email-input').value='';
  document.getElementById('secret-error').textContent='';
  resetDots();
  setTimeout(()=>document.getElementById('secret-email-input').focus(),80);
}
window.closeSecretLogin = function(){
  document.getElementById('secret-overlay').style.display='none';
  resetDots();
};
function resetDots(){for(var i=1;i<=5;i++)document.getElementById('d'+i).classList.remove('lit');}
function animateDots(cb){
  var i=1;
  var iv=setInterval(function(){
    document.getElementById('d'+i).classList.add('lit');
    i++;if(i>5){clearInterval(iv);if(cb)setTimeout(cb,200);}
  },80);
}
window.checkPassword = async function(){
  // Rate-limit check before even trying Firebase
  var rl = loginRateLimitOk();
  if(!rl.ok){
    document.getElementById('secret-error').textContent = '✗ ' + rl.msg;
    return;
  }
  var email=document.getElementById('secret-email-input').value.trim();
  var pw=document.getElementById('secret-pw-input').value;
  if(!email||!pw){
    document.getElementById('secret-error').textContent='✗ Please enter email and password.';
    return;
  }
  // Disable button during attempt to prevent rapid-fire clicks
  var btn = document.querySelector('[onclick="checkPassword()"]');
  if(btn){ btn.disabled=true; btn.textContent='Verifying…'; }
  try{
    await signInWithEmailAndPassword(auth, email, pw);
    recordLoginSuccess();
    animateDots(function(){
      closeSecretLogin();
      showPage('dashboard');
    });
  } catch(e){
    recordLoginFailure();
    var remaining = MAX_LOGIN_ATTEMPTS - _loginAttempts.length;
    var msg = '✗ Incorrect email or password.';
    if(remaining <= 2 && remaining > 0) msg += ' (' + remaining + ' attempt' + (remaining===1?'':'s') + ' left)';
    if(_loginLocked) msg = '✗ Too many failed attempts. Try again in 15 minutes.';
    document.getElementById('secret-error').textContent=msg;
    document.getElementById('secret-pw-input').value='';
    document.getElementById('secret-pw-input').focus();
    var box=document.getElementById('secret-box');
    box.style.animation='none';
    box.offsetHeight;
    box.style.animation='shake .4s ease';
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='Access Admin'; }
  }
};
// ─── STORE SETTINGS (shipping / low stock) ───────────────────────────────────
async function loadStoreSettings(){
  try{
    var snap = await getDoc(doc(db,'settings','store'));
    if(snap.exists()){
      var d = snap.data();
      // Update shared state so all modules see the latest settings
      if(!state.storeSettings) state.storeSettings = {};
      if(d.freeThreshold !== undefined){
        FREE_SHIPPING_THRESHOLD = Number(d.freeThreshold);
        state.storeSettings.freeThreshold = Number(d.freeThreshold);
      }
      if(d.lowStockThreshold !== undefined) LOW_STOCK_THRESHOLD = d.lowStockThreshold;
    }
  }catch(e){}
  // Populate settings inputs if visible
  var sf  = document.getElementById('cfg-shipping-fee');
  var ft  = document.getElementById('cfg-free-threshold');
  var ls  = document.getElementById('cfg-low-stock');
  if(sf) sf.value  = '';
  if(ft) ft.value  = FREE_SHIPPING_THRESHOLD;
  if(ls) ls.value  = LOW_STOCK_THRESHOLD;
}

// ─── MAINTENANCE MODE ─────────────────────────────────────────────────────────
async function loadMaintenanceMode(){
  // Only fetch from Firestore once per session — subsequent calls just re-apply cached value
  if(window._maintLoaded){
    applyMaintenanceMode(window._maintEnabled || false);
    return;
  }
  try{
    var snap = await getDoc(doc(db,'settings','maintenance'));
    window._maintEnabled = snap.exists() ? !!snap.data().enabled : false;
    window._maintLoaded = true;
    applyMaintenanceMode(window._maintEnabled);
  }catch(e){
    applyMaintenanceMode(false);
  }
}

function applyMaintenanceMode(isOn){
  // Update admin toggle UI
  var toggle = document.getElementById('maintenance-toggle');
  var label  = document.getElementById('maintenance-status-label');
  var notice = document.getElementById('maintenance-on-notice');
  if(toggle) toggle.checked = isOn;
  if(label)  label.textContent = isOn ? '🔴 ON' : '🟢 OFF';
  if(label)  label.style.color = isOn ? '#dc2626' : '#16a34a';
  if(notice) notice.style.display = isOn ? 'block' : 'none';
  // Only show overlay if maintenance is ON AND user is confirmed NOT an admin
  // auth.currentUser is null until Firebase resolves — we wait for onAuthStateChanged
  var overlay = document.getElementById('maintenance-overlay');
  if(overlay){
    var isAdmin = auth.currentUser != null;
    // If auth hasn't resolved yet and maintenance is on, keep overlay hidden
    // onAuthStateChanged will call this again once auth is confirmed
    if(isOn && !isAdmin && window._authStateResolved){
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
    }
  }
}

window.setMaintenanceMode = async function(isOn){
  try{
    await setDoc(doc(db,'settings','maintenance'),{enabled:isOn, updatedAt:serverTimestamp()});
    window._maintEnabled = isOn;
    window._maintLoaded = true;
    applyMaintenanceMode(isOn);
    toast(isOn ? '🔧 Maintenance mode ON — store is hidden from visitors' : '✅ Maintenance mode OFF — store is live');
  }catch(e){ toast('Error: '+e.message); }
};

window.saveStoreSettings = async function(){
  var sf = Number(document.getElementById('cfg-shipping-fee').value);
  var ft = Number(document.getElementById('cfg-free-threshold').value);
  var ls = Number(document.getElementById('cfg-low-stock').value) || 5;
  if(isNaN(sf)||sf<0) { toast('Enter a valid shipping fee'); return; }
  if(isNaN(ft)||ft<0) { toast('Enter a valid free shipping threshold'); return; }
  // SHIPPING_FEE removed — using J&T dynamic rates
  FREE_SHIPPING_THRESHOLD = ft;
  // Update shared state so checkout-orders.js picks it up immediately
  if(!state.storeSettings) state.storeSettings = {};
  state.storeSettings.freeThreshold = ft;
  LOW_STOCK_THRESHOLD = ls;
  try{
    await setDoc(doc(db,'settings','store'),{shippingFee:sf,freeThreshold:ft,lowStockThreshold:ls,updatedAt:serverTimestamp()});
    var msg = document.getElementById('settings-saved-msg');
    if(msg){ msg.style.display=''; setTimeout(function(){ msg.style.display='none'; },2500); }
    toast('✅ Settings saved');
  }catch(e){ toast('Error saving settings: '+e.message); }
};

// Load settings fields whenever Settings tab is opened
var _origShowDash2 = window.showDash;
window.showDash = function(id, btn){
  _origShowDash2(id, btn);
  if(id==='settings') loadStoreSettings();
};

// ─── CHANGE PASSWORD (logged-in admin) ───────────────────────────────────────
window.changeAdminPassword = async function(){
  var current = document.getElementById('cp-current').value;
  var newPw   = document.getElementById('cp-new').value;
  var confirm = document.getElementById('cp-confirm').value;
  var msg     = document.getElementById('cp-msg');
  function showMsg(text, ok){
    msg.style.display='block';
    msg.style.color = ok ? 'var(--matcha)' : '#e24b4a';
    msg.textContent = text;
  }
  if(!current||!newPw||!confirm){ showMsg('Please fill in all three fields.', false); return; }
  if(newPw.length < 8){ showMsg('New password must be at least 8 characters.', false); return; }
  if(newPw !== confirm){ showMsg('New passwords do not match.', false); return; }
  var user = auth.currentUser;
  if(!user){ showMsg('Not logged in — please refresh.', false); return; }
  try{
    var cred = EmailAuthProvider.credential(user.email, current);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPw);
    document.getElementById('cp-current').value='';
    document.getElementById('cp-new').value='';
    document.getElementById('cp-confirm').value='';
    showMsg('✅ Password updated successfully.', true);
  }catch(e){
    var m = (e.code==='auth/wrong-password'||e.code==='auth/invalid-credential')
      ? 'Current password is incorrect.'
      : e.code==='auth/too-many-requests'
      ? 'Too many attempts — try again later.'
      : 'Error: ' + e.message;
    showMsg(m, false);
  }
};

// ─── INQUIRY REPLY BY EMAIL ───────────────────────────────────────────────────
window.openInquiryReplyModal = function(id){
  var inq = (state.inquiries||[]).find(function(i){ return i.id===id; });
  if(!inq) return;
  var existing = document.getElementById('inq-reply-overlay');
  if(existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'inq-reply-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(30,30,26,.6);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:2rem;max-width:480px;width:90%;position:relative">'
    +'<button onclick="document.getElementById(\'inq-reply-overlay\').remove()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:18px;cursor:pointer;color:var(--stone)">✕</button>'
    +'<div style="font-family:var(--font-display);font-size:22px;font-weight:400;margin-bottom:.3rem">Reply to Inquiry</div>'
    +'<div style="font-size:13px;color:var(--stone);margin-bottom:1.2rem">To: <strong>'+inq.name+'</strong> &lt;'+inq.email+'&gt;</div>'
    +'<div class="form-group"><label class="form-label">Subject</label><input class="form-input" id="inq-reply-subject" value="Re: Your Zen &amp; Sip Wholesale Inquiry"></div>'
    +'<div class="form-group"><label class="form-label">Message</label><textarea class="form-input" id="inq-reply-body" rows="6" style="resize:vertical">Hi '+inq.name+',\n\nThank you for your interest in Zen &amp; Sip wholesale.\n\n\n\nWarm regards,\nZen &amp; Sip Team</textarea></div>'
    +'<div id="inq-reply-msg" style="font-size:13px;margin-bottom:.8rem;display:none"></div>'
    +'<div style="display:flex;gap:.8rem;justify-content:flex-end">'
    +'<button class="btn-sm" onclick="document.getElementById(\'inq-reply-overlay\').remove()">Cancel</button>'
    +'<button class="btn-sm primary" id="inq-reply-send-btn" onclick="sendInquiryReply(\''+id+'\')">Send Email</button>'
    +'</div></div>';
  document.body.appendChild(overlay);
  setTimeout(function(){ var ta=document.getElementById('inq-reply-body');if(ta){var len=ta.value.indexOf('\n\n\n');ta.setSelectionRange(len+2,len+2);ta.focus();} },60);
};

window.sendInquiryReply = async function(id){
  var inq = (state.inquiries||[]).find(function(i){ return i.id===id; });
  if(!inq) return;
  var subject = document.getElementById('inq-reply-subject').value.trim();
  var body    = document.getElementById('inq-reply-body').value.trim();
  var msg     = document.getElementById('inq-reply-msg');
  var btn     = document.getElementById('inq-reply-send-btn');
  if(!subject||!body){ msg.style.display='block';msg.style.color='#e24b4a';msg.textContent='Subject and message are required.';return; }
  if(!resendReady()){ msg.style.display='block';msg.style.color='#e24b4a';msg.textContent='Email not configured.';return; }
  btn.disabled=true; btn.textContent='Sending…';
  try{
    var html = emailWrap(
      '<p style="font-size:14px;color:#3d3d35;line-height:1.7;white-space:pre-wrap">'+body.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</p>'
    );
    await resendSend(inq.email, subject, html);
    msg.style.display='block';msg.style.color='var(--matcha)';msg.textContent='✅ Email sent to '+inq.email;
    btn.textContent='Sent!';
    setTimeout(function(){ document.getElementById('inq-reply-overlay').remove(); },1500);
  }catch(e){
    msg.style.display='block';msg.style.color='#e24b4a';msg.textContent='Failed: '+e.message;
    btn.disabled=false;btn.textContent='Send Email';
  }
};

// ─── QUOTATION PRINT / PDF ───────────────────────────────────────────────────
window.printQuotation = function(id){
  var qt = (state.quotations||[]).find(function(q){ return q.id===id; });
  if(!qt) return;
  var linesHtml = (qt.lastQuote&&qt.lastQuote.lines||[]).map(function(l){
    var sub = (l.qty||0)*(l.price||0);
    return '<tr>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">'+l.desc+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:center">'+l.qty+' '+l.unit+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right">₱'+Number(l.price).toLocaleString('en-PH',{minimumFractionDigits:2})+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">₱'+Number(sub).toLocaleString('en-PH',{minimumFractionDigits:2})+'</td>'
      +'</tr>';
  }).join('') || '<tr><td colspan="4" style="padding:8px;color:#888;text-align:center">No line items.</td></tr>';
  var quote = qt.lastQuote||{};
  var date = qt.createdAt&&qt.createdAt.seconds ? new Date(qt.createdAt.seconds*1000).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'});
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quotation — '+qt.name+'</title>'
    +'<style>body{font-family:\'DM Sans\',sans-serif;font-size:13px;color:#1e1e1a;margin:0;padding:2rem}'
    +'h1{font-family:\'Cormorant Garamond\',serif;font-size:32px;font-weight:400;margin:0 0 4px}'
    +'table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:7px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;text-align:left}'
    +'.total{font-size:16px;font-weight:700;color:#3d5a3e;text-align:right;padding:10px;border-top:2px solid #e5e7eb}'
    +'</style></head><body>'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:2rem">'
    +'<div><h1>Zen &amp; Sip</h1><div style="color:#8a8070;font-size:12px">Quotation</div></div>'
    +'<div style="text-align:right;font-size:12px;color:#8a8070"><div><strong>#'+id.slice(-6).toUpperCase()+'</strong></div><div>'+date+'</div></div>'
    +'</div>'
    +'<div style="background:#f9fafb;border-radius:8px;padding:1rem;margin-bottom:1.5rem;font-size:13px">'
    +'<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8a8070;margin-bottom:.4rem">Prepared For</div>'
    +'<div><strong>'+qt.name+'</strong></div>'
    +(qt.business?'<div style="color:#6b7280">'+qt.business+'</div>':'')
    +'<div style="color:#6b7280">'+qt.email+'</div>'
    +(qt.phone?'<div style="color:#6b7280">'+qt.phone+'</div>':'')
    +'</div>'
    +'<table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Subtotal</th></tr></thead>'
    +'<tbody>'+linesHtml+'</tbody></table>'
    +'<div class="total">Total: ₱'+Number(quote.total||0).toLocaleString('en-PH',{minimumFractionDigits:2})+'</div>'
    +(quote.validity?'<p style="font-size:12px;color:#8a8070;margin-top:1rem">⏳ '+quote.validity+'</p>':'')
    +(quote.notes?'<p style="font-size:13px;color:#555;margin-top:.5rem;white-space:pre-wrap">'+quote.notes+'</p>':'')
    +'<div style="margin-top:2rem;border-top:1px dashed #ddd;padding-top:.8rem;text-align:center;font-size:11px;color:#8a8070">Thank you for your interest! 🍵 — '+OWNER_EMAIL+'</div>'
    +'</body></html>';
  var win = window.open('','_blank');
  if(!win){ toast('Please allow popups to print quotations'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = function(){ win.print(); };
};

// ─── SESSION TIMEOUT — redirect to login on expiry ───────────────────────────
(function patchSessionTimeout(){
  var _origExtend = window.extendSession;
  // Override the session expired toast to also open the login modal
  var origOnAuthChanged = null;
  onAuthStateChanged(auth, function(user){
    if(!user && adminLoggedIn){
      // User got signed out (token expired) — open login again
      setTimeout(function(){
        if(!adminLoggedIn) openSecretLogin();
      }, 200);
    }
  });
})();

// ─── EXPORT ORDERS CSV ────────────────────────────────────────────────────────
window.exportOrdersCSV = function(){
  var orders = state.orders||[];
  if(!orders.length){ toast('No orders to export'); return; }
  var rows = [['Ref','Customer','Email','Phone','Items','Total','Status','Payment','Date']];
  orders.forEach(function(o){
    var items=(o.items||[]).map(function(it){return it.name+(it.variant?' ('+it.variant+')':'')+'×'+(it.qty||1);}).join('; ');
    var date=o.createdAt&&o.createdAt.seconds?new Date(o.createdAt.seconds*1000).toLocaleDateString('en-PH'):'-';
    rows.push([o.ref||o.id,o.customer||'',o.email||'',o.phone||'',items,'₱'+Number(o.total||0).toLocaleString(),o.status||'',o.paymentMethod||'',date]);
  });
  var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='zen-sip-orders-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  URL.revokeObjectURL(url);
  toast('✅ CSV exported — '+orders.length+' orders');
};

// ─── ADMIN PUSH NOTIFICATION REGISTRATION (OneSignal) ───────────────────────
var ONESIGNAL_APP_ID = 'ae3f25c8-9db0-4776-87a6-739cd5d1b4f1';

window.enablePushNotifications = async function(){
  var statusEl = document.getElementById('push-status');
  if(statusEl) statusEl.textContent = 'Enabling…';
  await registerAdminPushOneSignal();
};

async function registerAdminPushOneSignal(){
  var statusEl = document.getElementById('push-status');
  function setStatus(msg){ if(statusEl) statusEl.textContent = msg; }
  setStatus('Setting up…');

  // Wait up to 10 seconds for OneSignal to initialize
  var waited = 0;
  while(!window._oneSignalReady && !window._oneSignalError && waited < 10000){
    await new Promise(function(r){ setTimeout(r, 300); });
    waited += 300;
  }

  if(window._oneSignalError){
    setStatus('❌ Init error: ' + window._oneSignalError);
    return;
  }
  if(!window._oneSignalReady || !window.OneSignal){
    setStatus('❌ OneSignal failed to load. Check if OneSignalSDKWorker.js is uploaded.');
    return;
  }

  try{
    await window.OneSignal.Notifications.requestPermission();
    if(!window.OneSignal.Notifications.permission){
      setStatus('❌ Permission denied. Enable notifications in browser settings.');
      return;
    }
    await window.OneSignal.login('zen-sip-admin');
    setStatus('✅ Notifications enabled on this device!');
    toast('🔔 Push notifications enabled ✓');
  }catch(e){
    setStatus('❌ Error: ' + e.message);
    console.warn('OneSignal failed:', e.message);
  }
}


