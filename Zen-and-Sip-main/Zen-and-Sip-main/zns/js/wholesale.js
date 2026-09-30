// ─── INQUIRIES ────────────────────────────────────────────────────────────────
function listenInquiries(){
  onSnapshot(collection(db,'inquiries'), snap=>{
    state.inquiries = snap.docs.map(d=>({id:d.id,...d.data()}));
    state.inquiries.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    renderInquiries('','');
    var newCount=state.inquiries.filter(i=>i.status==='New').length;
    document.getElementById('stat-inquiries') && (document.getElementById('stat-inquiries').textContent=newCount);
  }, function(err){ if(err.code!=='permission-denied') console.warn('listenInquiries:',err.code); });
}

window.openInquiryModal = function(productId){
  var email  = wsApprovedEmail||'';
  // Use session-stored partner details (populated on login); fall back to inquiry record for admin previews
  var rec = (state.inquiries||[]).find(function(i){
    return (i.email||'').toLowerCase()===email.toLowerCase();
  });
  var pName  = wsPartnerName  || (rec ? (rec.name||'')     : '');
  var pBiz   = wsPartnerBiz   || (rec ? (rec.business||'') : '');
  var pPhone = wsPartnerPhone || (rec ? (rec.phone||'')    : '');

  var body = document.getElementById('inquiry-modal-body');
  body.innerHTML =
    '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--stone);margin-bottom:.3rem">Wholesale Inquiry</div>'
    +'<h2 style="font-family:var(--font-display);font-size:26px;font-weight:400;color:var(--dark);margin-bottom:1.2rem">What would you like to order?</h2>'
    // Partner info — read-only chip
    +'<div style="display:flex;align-items:center;gap:.8rem;background:var(--warm-white);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;margin-bottom:1.4rem">'
    +'<div style="width:34px;height:34px;border-radius:50%;background:var(--matcha-muted);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">👤</div>'
    +'<div><div style="font-size:14px;font-weight:600;color:var(--dark)">'+esc(pName||email)+'</div>'
    +'<div style="font-size:12px;color:var(--text-muted)">'+(pBiz?esc(pBiz)+' &middot; ':'')+esc(email)+(pPhone?' &middot; '+esc(pPhone):'')+'</div></div>'
    +'</div>'
    // Items header
    +'<div class="inq-items-header">'
    +'<span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Product</span>'
    +'<span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Variant</span>'
    +'<span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Qty</span>'
    +'<span></span>'
    +'</div>'
    +'<div id="inq-items-list"></div>'
    +'<button type="button" onclick="addInqItem()" style="background:none;border:1px dashed var(--border);color:var(--matcha);padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer;width:100%;margin-top:.4rem;margin-bottom:1.4rem">+ Add another product</button>'
    // Courier + Province
    +(function(){
      var regionGroups={NCR:[],LUZON:[],VISAYAS:[],MINDANAO:[],ISLAND:[]};
      Object.keys(PROVINCE_REGION).forEach(function(p){ (regionGroups[PROVINCE_REGION[p]]||[]).push(p); });
      var rLabels={NCR:'Metro Manila / NCR',LUZON:'Luzon',VISAYAS:'Visayas',MINDANAO:'Mindanao',ISLAND:'Island / Remote'};
      var provOpts='<option value="">— Select your province —</option>';
      ['NCR','LUZON','VISAYAS','MINDANAO','ISLAND'].forEach(function(r){
        provOpts+='<optgroup label="'+rLabels[r]+'">';
        (regionGroups[r]||[]).sort().forEach(function(p){ provOpts+='<option value="'+p+'">'+p+'</option>'; });
        provOpts+='</optgroup>';
      });
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:1rem">'
        +'<div><label class="form-label">Courier <span style="color:#e24b4a">*</span></label>'
        +'<select class="form-input" id="inq-courier" style="margin:0" onchange="var p=document.getElementById(\'inq-province-wrap\');if(p)p.style.display=this.value===\'jnt\'?\'block\':\'none\'">'
        +'<option value="jnt">J&amp;T Express</option>'
        +'<option value="lalamove">Lalamove</option>'
        +'</select></div>'
        +'<div id="inq-province-wrap"><label class="form-label">Province <span style="color:#e24b4a">*</span></label>'
        +'<select class="form-input" id="inq-province" style="margin:0">'+provOpts+'</select></div>'
        +'</div>';
    })()
    // Comment
    +'<div class="form-group" style="margin-bottom:1.4rem">'
    +'<label class="form-label">Message / Notes <span style="font-weight:400;color:var(--text-muted)">(optional)</span></label>'
    +'<textarea class="form-input" id="inq-comment" rows="3" placeholder="Special requests, preferred delivery schedule, anything else..."></textarea>'
    +'</div>'
    // Hidden partner data
    +'<input type="hidden" id="inq-p-email" value="'+esc(email)+'">'
    +'<input type="hidden" id="inq-p-name"  value="'+esc(pName)+'">'
    +'<input type="hidden" id="inq-p-biz"   value="'+esc(pBiz)+'">'
    +'<input type="hidden" id="inq-p-phone" value="'+esc(pPhone)+'">'
    +'<button class="btn-atc" onclick="submitInquiry()" id="inq-submit-btn">Send Inquiry</button>'
    +'<p style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:1rem">We\'ll get back to you within 1–2 business days.</p>';

  // Add the initial product row
  document.getElementById('inq-items-list').innerHTML='';
  addInqItem(productId);

  document.getElementById('inquiry-overlay').classList.add('open');
};

window.addInqItem = function(productId){
  var list=document.getElementById('inq-items-list');
  if(!list) return;
  var wsProds=(state.products||[]).filter(function(p){return p.category==='wholesale';});
  var opts=wsProds.map(function(p){
    return '<option value="'+p.id+'"'+(p.id===productId?' selected':'')+'>'+esc(p.name)+'</option>';
  }).join('');
  var row=document.createElement('div');
  row.className='inq-item-row';
  row.innerHTML=
    '<select onchange="updateInqVariants(this)">'+opts+'</select>'
    +'<select></select>'
    +'<input type="number" min="1" value="1" placeholder="Qty">'
    +'<button type="button" onclick="this.closest(\'.inq-item-row\').remove()" style="background:none;border:none;color:#e24b4a;cursor:pointer;font-size:20px;line-height:1;padding:0" title="Remove">×</button>';
  list.appendChild(row);
  // Populate variant dropdown for the initially selected product
  var prodSel=row.querySelectorAll('select')[0];
  updateInqVariants(prodSel);
};

window.updateInqVariants = function(prodSelect){
  var row=prodSelect.closest('.inq-item-row');
  if(!row) return;
  var varSel=row.querySelectorAll('select')[1];
  if(!varSel) return;
  var pid=prodSelect.value;
  var prod=(state.products||[]).find(function(p){return p.id===pid;});
  var variants=prod&&prod.variants&&prod.variants.length
    ? prod.variants.map(function(v){return typeof v==='object'?v:{label:String(v),price:null};})
    : [];
  varSel.innerHTML=variants.length
    ? variants.map(function(v){return '<option value="'+esc(v.label)+'">'+esc(v.label)+'</option>';}).join('')
    : '<option value="">Standard</option>';
};
window.closeInquiryModal = function(e){
  if(e.target===document.getElementById('inquiry-overlay'))
    document.getElementById('inquiry-overlay').classList.remove('open');
};
// ─── WHOLESALE GATED ACCESS ───────────────────────────────────────────────────
// Session-only memory of approved partner (cleared on page close)
var wsApprovedEmail  = sessionStorage ? (sessionStorage.getItem('ws_partner')||'')       : '';
var wsPartnerName    = sessionStorage ? (sessionStorage.getItem('ws_partner_name')||'')  : '';
var wsPartnerBiz     = sessionStorage ? (sessionStorage.getItem('ws_partner_biz')||'')   : '';
var wsPartnerPhone   = sessionStorage ? (sessionStorage.getItem('ws_partner_phone')||'') : '';

// Check on page load if session has a stored approved email
(function wsRestoreSession(){
  if(!wsApprovedEmail) return;
  setTimeout(async function(){
    try{
      var approved = false;
      // Try indexed query first
      try{
        var snap = await getDocs(query(
          collection(db,'inquiries'),
          where('email','==',wsApprovedEmail.toLowerCase())
        ));
        approved = snap.docs.some(function(d){
          var s = d.data().status||'';
          return s==='Approved';
        });
      }catch(e){ /* index missing, fall through */ }
      // Full scan fallback
      if(!approved){
        var snapAll = await getDocs(collection(db,'inquiries'));
        approved = snapAll.docs.some(function(d){
          var data = d.data();
          return (data.email||'').toLowerCase()===wsApprovedEmail.toLowerCase()
            && (data.status==='Approved'||data.status==='Active Partner');
        });
      }
      if(approved) wsGrantAccess(wsApprovedEmail);
      else {
        sessionStorage.removeItem('ws_partner');
        sessionStorage.removeItem('ws_partner_name');
        sessionStorage.removeItem('ws_partner_biz');
        sessionStorage.removeItem('ws_partner_phone');
        wsApprovedEmail=''; wsPartnerName=''; wsPartnerBiz=''; wsPartnerPhone='';
      }
    }catch(e){ /* silent fail */ }
  }, 800);
})();

window.wsShowTab = function(tab){
  var isAccess = tab==='access';
  document.getElementById('ws-panel-access').style.display = isAccess?'block':'none';
  document.getElementById('ws-panel-apply').style.display  = isAccess?'none':'block';
  document.getElementById('ws-tab-access').style.background = isAccess?'var(--matcha)':'none';
  document.getElementById('ws-tab-access').style.color     = isAccess?'#fff':'var(--stone)';
  document.getElementById('ws-tab-apply').style.background = isAccess?'none':'var(--matcha)';
  document.getElementById('ws-tab-apply').style.color      = isAccess?'var(--stone)':'#fff';
};

window.checkWholesaleAccess = async function(){
  var email = (document.getElementById('ws-access-email').value||'').trim().toLowerCase();
  var msgEl = document.getElementById('ws-access-msg');
  var btn   = document.getElementById('ws-access-btn');
  if(!email){ showWsMsg('Please enter your email address.','#991b1b'); return; }
  btn.textContent='Checking…'; btn.disabled=true;
  msgEl.style.display='none';
  try{
    var snap = await getDoc(doc(db,'partner_status',email));
    if(!snap.exists()){
      showWsMsg('No application found for that email. Please apply for access below.','#991b1b');
    } else {
      var status = snap.data().status||'';
      if(status==='Approved'){
        var pd = snap.data();
        wsApprovedEmail = email;
        wsPartnerName   = pd.name     || '';
        wsPartnerBiz    = pd.business || '';
        wsPartnerPhone  = pd.phone    || '';
        if(sessionStorage){
          sessionStorage.setItem('ws_partner',       email);
          sessionStorage.setItem('ws_partner_name',  wsPartnerName);
          sessionStorage.setItem('ws_partner_biz',   wsPartnerBiz);
          sessionStorage.setItem('ws_partner_phone', wsPartnerPhone);
        }
        wsGrantAccess(email);
      } else if(status==='Rejected'){
        showWsMsg('Your application was not approved. Please contact us for more information.','#991b1b');
      } else {
        showWsMsg('Your application is still under review. We\'ll email you once approved!','#92400e');
      }
    }
  }catch(e){ showWsMsg('Error checking access: '+e.message,'#991b1b'); }
  btn.textContent='View Catalogue →'; btn.disabled=false;
};

function showWsMsg(msg, color){
  var el = document.getElementById('ws-access-msg');
  el.textContent = msg;
  el.style.color = color;
  el.style.display = 'block';
}

function wsGrantAccess(email){
  document.getElementById('ws-gate').style.display='none';
  document.getElementById('ws-catalogue').style.display='block';
  document.getElementById('ws-partner-email').textContent=email;
  renderWholesale();
  loadWsAnnouncement();
}

window.adminPreviewWholesale = function(){
  showPage('wholesale');
  document.getElementById('ws-gate').style.display='none';
  document.getElementById('ws-catalogue').style.display='block';
  document.getElementById('ws-partner-email').textContent='Admin Preview';
  renderWholesale();
  loadWsAnnouncement();
};

// ─── WHOLESALE ANNOUNCEMENT BANNER ───────────────────────────────────────────
function loadWsAnnouncement(){
  var bar=document.getElementById('ws-announcement-bar');
  if(!bar) return;
  if(sessionStorage&&sessionStorage.getItem('ws_ann_dismissed')){bar.style.display='none';return;}
  getDoc(doc(db,'settings','ws-announcement')).then(function(snap){
    if(snap.exists()&&snap.data().active&&(snap.data().text||'').trim()){
      document.getElementById('ws-announcement-text').innerHTML=esc(snap.data().text).replace(/\n/g,'<br>');
      bar.style.display='flex';
    } else {
      bar.style.display='none';
    }
  }).catch(function(){});
}

window.dismissWsAnnouncement=function(){
  var bar=document.getElementById('ws-announcement-bar');
  if(bar) bar.style.display='none';
  if(sessionStorage) sessionStorage.setItem('ws_ann_dismissed','1');
};

window.saveWsAnnouncement=async function(){
  try{requireAuth();}catch(e){toast('Admin access required.');return;}
  var text=(document.getElementById('ws-ann-input').value||'').trim();
  if(!text){toast('Enter announcement text first.');return;}
  await setDoc(doc(db,'settings','ws-announcement'),{text:text,active:true,updatedAt:serverTimestamp()});
  if(sessionStorage) sessionStorage.removeItem('ws_ann_dismissed');
  loadWsAnnouncement();
  toast('Announcement published ✓');
};

window.clearWsAnnouncement=async function(){
  try{requireAuth();}catch(e){toast('Admin access required.');return;}
  await setDoc(doc(db,'settings','ws-announcement'),{text:'',active:false,updatedAt:serverTimestamp()});
  var bar=document.getElementById('ws-announcement-bar');
  if(bar) bar.style.display='none';
  document.getElementById('ws-ann-input').value='';
  toast('Announcement cleared ✓');
};

window.loadWsAnnouncementAdmin=async function(){
  try{
    var snap=await getDoc(doc(db,'settings','ws-announcement'));
    var inp=document.getElementById('ws-ann-input');
    if(inp&&snap.exists()&&snap.data().active) inp.value=snap.data().text||'';
  }catch(e){}
};

window.wsLogout = function(){
  wsApprovedEmail=''; wsPartnerName=''; wsPartnerBiz=''; wsPartnerPhone='';
  if(sessionStorage){
    sessionStorage.removeItem('ws_partner');
    sessionStorage.removeItem('ws_partner_name');
    sessionStorage.removeItem('ws_partner_biz');
    sessionStorage.removeItem('ws_partner_phone');
  }
  document.getElementById('ws-catalogue').style.display='none';
  document.getElementById('ws-gate').style.display='block';
  document.getElementById('ws-access-email').value='';
  document.getElementById('ws-access-msg').style.display='none';
};

// ─── INLINE INQUIRY (Apply tab) ───────────────────────────────────────────────
window.submitInlineInquiry = async function(){
  var name=document.getElementById('ws-inq-name').value.trim();
  var email=document.getElementById('ws-inq-email').value.trim();
  var phone=document.getElementById('ws-inq-phone').value.trim();
  var biz=(document.getElementById('ws-inq-biz')?document.getElementById('ws-inq-biz').value.trim():'');
  var address=(document.getElementById('ws-inq-address')?document.getElementById('ws-inq-address').value.trim():'');
  var comment=document.getElementById('ws-inq-comment').value.trim();
  if(!name||!email||!phone){alert('Please fill in Name, Email, and Phone.');return;}
  var btn=document.getElementById('ws-inq-btn');
  btn.textContent='Sending…'; btn.disabled=true;
  // Duplicate email check
  var emailLc=email.toLowerCase();
  var dupe=(state.inquiries||[]).find(function(i){
    return (i.email||'').toLowerCase()===emailLc&&i.status!=='Rejected';
  });
  if(dupe){ alert('An inquiry from this email is already on record (Status: '+dupe.status+'). Please contact us directly if you have any updates.'); btn.textContent='Submit Application'; btn.disabled=false; return; }
  // reCAPTCHA v3 check
  try{
    await new Promise(function(resolve, reject){
      grecaptcha.ready(function(){
        grecaptcha.execute('6LdZJt4sAAAAADghH01uYyM_M_wTJbwDzG5Ok_Yx', {action:'wholesale_apply'}).then(function(token){
          if(!token){ reject(new Error('reCAPTCHA failed. Please try again.')); return; }
          resolve(token);
        }).catch(reject);
      });
    });
  }catch(e){ btn.textContent='Submit Application'; btn.disabled=false; showErrorModal('reCAPTCHA check failed. Please refresh the page and try again.',e.message,'https://zennsip.com/?dash=inquiries'); return; }
  try{
    await addDoc(collection(db,'inquiries'),{
      name,business:biz,email,phone,address,comment,
      productId:'',productName:'General Inquiry',
      status:'New',createdAt:serverTimestamp(),
    });
    try{ await setDoc(doc(db,'partner_status',email),{status:'New',name:name,business:biz,phone:phone,updatedAt:serverTimestamp()}); }catch(e){}
    document.getElementById('ws-inq-name').value='';
    document.getElementById('ws-inq-email').value='';
    document.getElementById('ws-inq-phone').value='';
    if(document.getElementById('ws-inq-biz')) document.getElementById('ws-inq-biz').value='';
    if(document.getElementById('ws-inq-address')) document.getElementById('ws-inq-address').value='';
    document.getElementById('ws-inq-comment').value='';
    toast("Application sent! We'll review and email you shortly 🍵");
    sendInquiryEmail({name,business:biz,email,phone,address,comment});
    sendAdminPushNotification('📋 New Wholesale Inquiry', name+(biz?' — '+biz:''), 'https://zennsip.com/?dash=inquiries');
    // Switch to access tab so they know where to come back
    wsShowTab('access');
    document.getElementById('ws-access-email').value=email;
    showWsMsg('Application received! Once approved, enter your email here to unlock the catalogue.','var(--matcha)');
  }catch(e){ showErrorModal('We couldn\'t submit your application. Please check your internet connection and try again.',e.message,'https://zennsip.com/?dash=inquiries'); }
  btn.textContent='Submit Application'; btn.disabled=false;
};

window.submitInquiry = async function(){
  var email   = (document.getElementById('inq-p-email').value||'').trim();
  var name    = (document.getElementById('inq-p-name').value||'').trim();
  var biz     = (document.getElementById('inq-p-biz').value||'').trim();
  var phone   = (document.getElementById('inq-p-phone').value||'').trim();
  var courier  = (document.getElementById('inq-courier').value||'jnt').trim();
  var province = (document.getElementById('inq-province').value||'').trim();
  var comment  = (document.getElementById('inq-comment').value||'').trim();
  if(!email){ toast('Session expired — please sign in again.'); return; }
  if(courier==='jnt'&&!province){ alert('Please select your province so we can calculate the J&T shipping fee.'); return; }

  // Collect items from rows
  var items=[];
  document.querySelectorAll('.inq-item-row').forEach(function(row){
    var sels=row.querySelectorAll('select');
    var inp=row.querySelector('input');
    var pid=sels[0]?sels[0].value:'';
    var type=sels[1]?sels[1].value:'Bulk Order';
    var qty=inp?inp.value.trim():'';
    var prod=(state.products||[]).find(function(p){return p.id===pid;});
    if(pid) items.push({productId:pid,productName:prod?prod.name:'',type:type,quantity:qty});
  });
  if(!items.length){ alert('Please add at least one product.'); return; }

  var btn=document.getElementById('inq-submit-btn');
  btn.textContent='Sending…'; btn.disabled=true;
  var pname=items.length===1?items[0].productName:items.map(function(i){return i.productName;}).join(', ');
  try{
    await addDoc(collection(db,'quotations'),{
      name,business:biz,email,phone,courier,province,comment,
      items:items,
      productId:items.length===1?items[0].productId:'',
      productName:pname,
      status:'New',
      createdAt:serverTimestamp(),
    });
    document.getElementById('inquiry-overlay').classList.remove('open');
    toast("Request sent! We'll get back to you soon 🍵");
    sendInquiryEmail({name,business:biz,email,phone,comment,items:items});
    sendAdminPushNotification('💬 New Quotation Request', name+' — '+pname, 'https://zennsip.com/?dash=quotations');
  }catch(e){ showErrorModal('We couldn\'t send your request. Please check your internet connection and try again.',e.message,'https://zennsip.com/?dash=quotations'); }
  btn.textContent='Send Inquiry'; btn.disabled=false;
};

var _inqStatusColor={
  'New':'background:#fef3c7;color:#92400e',
  'Approved':'background:#dcfce7;color:#166534',
  'Rejected':'background:#fee2e2;color:#991b1b',
};
function renderInquiries(filter, statusFilter){
  state.inqFilter=filter||'';
  state.inqStatusFilter=statusFilter||'';
  var isArchiveView=_archiveView['inquiries']==='archive';
  updateArchiveCounts('inquiries', state.inquiries||[]);
  var list=(state.inquiries||[]).filter(function(i){
    var inArchive=isAutoArchived(i,'inquiries');
    if(isArchiveView!==inArchive) return false;
    var q=!filter||((i.name||'').toLowerCase().includes(filter.toLowerCase())||
      (i.business||'').toLowerCase().includes(filter.toLowerCase())||
      (i.email||'').toLowerCase().includes(filter.toLowerCase()));
    var s=!statusFilter||i.status===statusFilter;
    return q&&s;
  });
  var all=state.inquiries||[];
  function setStat(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
  setStat('inq-stat-new',      all.filter(function(i){return i.status==='New';}).length);
  setStat('inq-stat-approved', all.filter(function(i){return i.status==='Approved';}).length);
  setStat('inq-stat-rejected', all.filter(function(i){return i.status==='Rejected';}).length);
  var page=pgGet('inquiries');
  var pages=Math.ceil(list.length/PG_SIZE)||1;
  if(page>pages){pgSet('inquiries',1);page=1;}
  var slice=list.slice((page-1)*PG_SIZE,page*PG_SIZE);
  document.getElementById('inquiries-tbody').innerHTML=slice.length
    ? slice.map(function(i){
        var date=i.createdAt&&i.createdAt.seconds?new Date(i.createdAt.seconds*1000).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'--';
        var sc=_inqStatusColor[i.status]||'background:#f3f4f6;color:#6b7280';
        var comment=i.comment&&i.comment.length>60?i.comment.slice(0,60)+'…':(i.comment||'—');
        return '<tr>'
          +'<td style="font-size:12px;color:var(--text-muted);white-space:nowrap">'+date+'</td>'
          +'<td><strong>'+esc(i.name||'')+'</strong></td>'
          +'<td style="font-size:12px;color:var(--stone)">'+(i.business?esc(i.business):'—')+'</td>'
          +'<td style="font-size:12px">'+esc(i.email||'')+'</td>'
          +'<td style="font-size:12px;white-space:nowrap">'+esc(i.phone||'')+'</td>'
          +'<td style="font-size:12px;color:var(--text-muted);max-width:160px">'+esc(comment)+'</td>'
          +'<td><span style="'+sc+';padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap">'+esc(i.status)+'</span></td>'
          +'<td><button class="btn-sm" onclick="viewInquiry(\''+i.id+'\')">View</button></td>'
          +'</tr>';
      }).join('')
    : '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">No inquiries yet.</td></tr>';
  renderPagination('inquiries', list.length);
}

// ─── INQUIRY DETAIL MODAL ─────────────────────────────────────────────────────
window.viewInquiry = function(id){
  var inq=(state.inquiries||[]).find(function(i){return i.id===id;});
  if(!inq) return;
  var overlay=document.getElementById('inq-detail-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='inq-detail-overlay';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:300;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.onclick=function(e){if(e.target===overlay)overlay.style.display='none';};
    document.body.appendChild(overlay);
  }
  var date=inq.createdAt&&inq.createdAt.seconds?new Date(inq.createdAt.seconds*1000).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}):'—';
  var sc=_inqStatusColor[inq.status]||'background:#f3f4f6;color:#6b7280';
  var allStatuses=['New','Approved','Rejected'];
  var statusOpts=allStatuses.map(function(s){
    return '<option value="'+s+'"'+(s===inq.status?' selected':'')+'>'+s+'</option>';
  }).join('');
  overlay.innerHTML='<div style="background:#fff;border-radius:12px;padding:2rem;max-width:480px;width:100%;max-height:90vh;overflow-y:auto;position:relative">'
    +'<button onclick="document.getElementById(\'inq-detail-overlay\').style.display=\'none\'" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:20px;cursor:pointer;color:var(--stone);line-height:1">✕</button>'
    +'<div style="display:flex;align-items:flex-start;gap:.8rem;margin-bottom:1.4rem;padding-right:2rem">'
    +'<div style="flex:1"><div style="font-size:18px;font-weight:600;margin-bottom:2px">'+esc(inq.name||'')+'</div>'
    +'<div style="font-size:12px;color:var(--text-muted)">'+date+'</div></div>'
    +'<span style="'+sc+';padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap">'+esc(inq.status)+'</span>'
    +'</div>'
    +'<table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:1.2rem">'
    +'<tr><td style="color:var(--text-muted);padding:5px 0;width:90px;vertical-align:top">Business</td><td style="padding:5px 0">'+esc(inq.business||'—')+'</td></tr>'
    +'<tr><td style="color:var(--text-muted);padding:5px 0;vertical-align:top">Email</td><td style="padding:5px 0"><a href="mailto:'+esc(inq.email||'')+'" style="color:var(--matcha)">'+esc(inq.email||'—')+'</a></td></tr>'
    +'<tr><td style="color:var(--text-muted);padding:5px 0;vertical-align:top">Phone</td><td style="padding:5px 0">'+esc(inq.phone||'—')+'</td></tr>'
    +(inq.address?'<tr><td style="color:var(--text-muted);padding:5px 0;vertical-align:top">Address</td><td style="padding:5px 0">'+esc(inq.address)+'</td></tr>':'')
    +(inq.productName&&inq.productName!=='General Inquiry'?'<tr><td style="color:var(--text-muted);padding:5px 0;vertical-align:top">Product</td><td style="padding:5px 0">'+esc(inq.productName)+'</td></tr>':'')
    +'</table>'
    // Items list (partner inquiries)
    +(inq.items&&inq.items.length
      ?'<div style="margin-bottom:1.4rem">'
       +'<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">Products Requested</div>'
       +'<table style="width:100%;font-size:13px;border-collapse:collapse">'
       +'<thead><tr>'
       +'<th style="text-align:left;padding:4px 8px;font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border)">Product</th>'
       +'<th style="text-align:left;padding:4px 8px;font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border)">Type</th>'
       +'<th style="text-align:left;padding:4px 8px;font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border)">Qty / Weight</th>'
       +'</tr></thead><tbody>'
       +inq.items.map(function(item){
         return '<tr>'
           +'<td style="padding:6px 8px;border-bottom:1px solid var(--border)">'+esc(item.productName||'—')+'</td>'
           +'<td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text-muted)">'+esc(item.type||'—')+'</td>'
           +'<td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--matcha);font-weight:600">'+(item.quantity?esc(item.quantity):'—')+'</td>'
           +'</tr>';
       }).join('')
       +'</tbody></table></div>'
      :'')
    +'<div style="margin-bottom:1.4rem">'
    +'<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem">Message</div>'
    +'<div style="background:var(--warm-white);border:1px solid var(--border);border-radius:6px;padding:.8rem;font-size:13px;line-height:1.6;white-space:pre-wrap;min-height:50px">'+esc(inq.comment||'—')+'</div>'
    +'</div>'
    +(function(){
        var imgs=inq.proofURLs&&inq.proofURLs.length?inq.proofURLs:(inq.proofURL?[inq.proofURL]:[]);
        if(!imgs.length) return '';
        return '<div style="margin-bottom:1.2rem">'
          +'<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem">Proof of Payment</div>'
          +'<div style="display:flex;flex-wrap:wrap;gap:.5rem">'
          +imgs.map(function(src,i){
            return '<img src="'+src+'" onclick="window.open(this.src)" style="max-width:'+(imgs.length>1?'calc(50% - .25rem)':'100%')+';max-height:180px;object-fit:contain;border-radius:6px;border:1px solid var(--border);cursor:pointer" title="Screenshot '+(i+1)+' — click to open">';
          }).join('')
          +'</div>'
          +'</div>';
      })()
    // Reject reason section (shown on click)
    +'<div id="inq-modal-reject-wrap" style="display:none;margin-bottom:1rem">'
    +'<label style="font-size:12px;font-weight:600;display:block;margin-bottom:.4rem">Reason for rejection <span style="font-weight:400;color:var(--text-muted)">(optional — sent in email)</span></label>'
    +'<textarea id="inq-modal-reject-reason" rows="2" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-family:var(--font-body);font-size:13px;resize:vertical" placeholder="e.g. Not in service area"></textarea>'
    +'<div style="display:flex;gap:.5rem;margin-top:.6rem">'
    +'<button onclick="confirmInqReject(\''+id+'\')" style="background:#991b1b;color:#fff;border:none;padding:7px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500">Confirm Reject</button>'
    +'<button onclick="document.getElementById(\'inq-modal-reject-wrap\').style.display=\'none\';document.getElementById(\'inq-modal-reject-btn\').style.display=\'inline-block\'" style="background:none;border:1px solid var(--border);padding:7px 14px;border-radius:6px;font-size:13px;cursor:pointer">Cancel</button>'
    +'</div>'
    +'</div>'
    // Primary actions (Approve / Reject — always visible)
    +'<div style="display:flex;gap:.6rem;margin-bottom:.8rem">'
    +'<button onclick="approveInquiryFromModal(\''+id+'\')" style="background:#dcfce7;color:#166534;border:1px solid #bbf7d0;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500">✓ Approve</button>'
    +'<button id="inq-modal-reject-btn" onclick="document.getElementById(\'inq-modal-reject-wrap\').style.display=\'block\';this.style.display=\'none\'" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500">✕ Reject</button>'
    +'</div>'
    // Change status (always visible)
    +'<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;padding:.8rem;background:var(--warm-white);border:1px solid var(--border);border-radius:8px">'
    +'<span style="font-size:12px;color:var(--text-muted);white-space:nowrap">Change status:</span>'
    +'<select id="inq-status-sel" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:13px">'+statusOpts+'</select>'
    +'<button onclick="changeInqStatus(\''+id+'\')" style="background:var(--matcha);color:#fff;border:none;padding:7px 14px;border-radius:5px;font-size:12px;cursor:pointer;white-space:nowrap;font-weight:500">Save</button>'
    +'</div>'
    // Footer: Delete + Close
    +'<div style="display:flex;gap:.6rem;padding-top:.8rem;border-top:1px solid var(--border)">'
    +'<button onclick="deleteInquiry(\''+id+'\')" style="background:none;border:1px solid #fecaca;color:#991b1b;padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer">Delete</button>'
    +'<button onclick="document.getElementById(\'inq-detail-overlay\').style.display=\'none\'" style="background:none;border:1px solid var(--border);padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;margin-left:auto">Close</button>'
    +'</div>'
    +'</div>';
  overlay.style.display='flex';
};

window.approveInquiryFromModal = async function(id){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  document.getElementById('inq-detail-overlay').style.display='none';
  await updateInquiryStatus(id,'Approved');
};

window.confirmInqReject = async function(id){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  var local=(state.inquiries||[]).find(function(i){return i.id===id;});
  var reason=(document.getElementById('inq-modal-reject-reason').value||'').trim();
  var upd={status:'Rejected',updatedAt:serverTimestamp()};
  if(reason) upd.rejectionReason=reason;
  try{
    await updateDoc(doc(db,'inquiries',id),upd);
    if(local) Object.assign(local,upd);
    document.getElementById('inq-detail-overlay').style.display='none';
    if(resendReady()&&local){
      var def=INQ_MSG_DEFAULTS['Rejected'];
      try{
        await sendWholesaleStatusEmail(local,{title:def.title,body:def.body,catalogueUrl:'',reasonBox:reason||null},'Rejected');
        toast('Inquiry rejected — email sent to '+local.email);
      }catch(e){ toast('Inquiry rejected (email failed: '+e.message+')'); }
    } else {
      toast('Inquiry rejected');
    }
  }catch(e){ toast('Error: '+e.message); }
};

window.changeInqStatus = async function(id){
  var sel=document.getElementById('inq-status-sel');
  if(!sel) return;
  var val=sel.value;
  document.getElementById('inq-detail-overlay').style.display='none';
  await updateInquiryStatus(id,val);
};

window.deleteInquiry = async function(id){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  if(!confirm('Delete this inquiry permanently? This cannot be undone.')) return;
  var inq=(state.inquiries||[]).find(function(i){return i.id===id;});
  try{
    await deleteDoc(doc(db,'inquiries',id));
    if(inq && inq.email){ try{ await deleteDoc(doc(db,'partner_status',(inq.email||'').toLowerCase())); }catch(e){} }
    toast('Inquiry deleted');
    document.getElementById('inq-detail-overlay').style.display='none';
  }catch(e){ toast('Error: '+e.message); }
};
// Default email messages per status
var INQ_MSG_DEFAULTS = {
  'Approved':       { title: 'Your inquiry has been approved!', body: 'Great news! Your wholesale inquiry has been approved. We will be in touch shortly with pricing, terms, and next steps. Welcome to the Zen & Sip wholesale family!', catalogueUrl: '' },
  'Rejected':       { title: 'Update on your inquiry', body: 'Thank you for your interest in Zen & Sip wholesale. After careful review, we are unable to proceed with your inquiry at this time. We appreciate you reaching out and hope to work together in the future.', catalogueUrl: '' },
};

// Open approval modal with editable email preview
window.openApprovalModal = function(id, val){
  var inq = (state.inquiries||[]).find(function(i){ return i.id===id; });
  if(!inq) return;
  var msgObj = INQ_MSG_DEFAULTS[val] || {};
  // Build modal
  var overlay = document.getElementById('approval-email-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'approval-email-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:300;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:2rem;max-width:520px;width:90%;max-height:90vh;overflow-y:auto;position:relative">'
      +'<button onclick="document.getElementById(\'approval-email-overlay\').style.display=\'none\'" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:18px;cursor:pointer;color:var(--stone)">✕</button>'
      +'<h3 id="aem-title" style="font-family:var(--font-display);font-size:22px;font-weight:400;margin-bottom:.4rem"></h3>'
      +'<p id="aem-to" style="font-size:12px;color:var(--text-muted);margin-bottom:1.2rem"></p>'
      +'<label style="font-size:12px;font-weight:500;display:block;margin-bottom:.3rem">Email Subject</label>'
      +'<input id="aem-subject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-family:var(--font-body);font-size:13px;margin-bottom:.8rem">'
      +'<label style="font-size:12px;font-weight:500;display:block;margin-bottom:.3rem">Message Body</label>'
      +'<textarea id="aem-body" rows="5" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-family:var(--font-body);font-size:13px;resize:vertical;margin-bottom:1.2rem"></textarea>'
      +'<div style="display:flex;gap:.6rem;justify-content:flex-end">'
        +'<button id="aem-skip" style="background:none;border:1px solid var(--border);padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer">Update Status Only</button>'
        +'<button id="aem-send" style="background:var(--matcha);color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500">Update & Send Email</button>'
      +'</div>'
    +'</div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  document.getElementById('aem-title').textContent = 'Set status: ' + val;
  document.getElementById('aem-to').textContent = 'To: ' + inq.name + ' <' + inq.email + '>';
  document.getElementById('aem-subject').value = msgObj.title || '';
  document.getElementById('aem-body').value = msgObj.body || '';
  document.getElementById('aem-skip').onclick = async function(){
    overlay.style.display = 'none';
    await updateInquiryStatus(id, val, null);
  };
  document.getElementById('aem-send').onclick = async function(){
    overlay.style.display = 'none';
    var customMsg = {
      title: document.getElementById('aem-subject').value,
      body: document.getElementById('aem-body').value,
      catalogueUrl: msgObj.catalogueUrl || ''
    };
    await updateInquiryStatus(id, val, customMsg);
  };
};

window.toggleInqNotes = function(id){
  var row = document.getElementById('inq-notes-'+id);
  if(row) row.style.display = row.style.display === 'none' ? '' : 'none';
};

window.saveInqNotes = async function(id){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  var txt = document.getElementById('inq-notes-txt-'+id);
  if(!txt) return;
  await updateDoc(doc(db,'inquiries',id),{adminNotes: txt.value});
  toast('Notes saved ✓');
};


// ─── QUOTATIONS ───────────────────────────────────────────────────────────────
function listenQuotations(){
  onSnapshot(collection(db,'quotations'), snap=>{
    state.quotations = snap.docs.map(d=>({id:d.id,...d.data()}));
    state.quotations.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    renderQuotations('','');
  }, function(err){ if(err.code!=='permission-denied') console.warn('listenQuotations:',err.code); });
}

function renderQuotations(filter, statusFilter){
  state.qtFilter=filter||'';
  state.qtStatusFilter=statusFilter||'';
  var isArchiveView = _archiveView['quotations']==='archive';
  updateArchiveCounts('quotations', state.quotations||[]);
  var list=(state.quotations||[]).filter(function(q){
    var inArchive = isAutoArchived(q, 'quotations');
    if(isArchiveView !== inArchive) return false;
    var f=filter||'';
    var match=!f||((q.name||'').toLowerCase().includes(f.toLowerCase())||
      (q.productName||'').toLowerCase().includes(f.toLowerCase())||
      (q.email||'').toLowerCase().includes(f.toLowerCase()));
    var s=!statusFilter||q.status===statusFilter;
    return match&&s;
  });
  var all=state.quotations||[];
  function setQt(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
  setQt('qt-stat-new',    all.filter(function(q){return q.status==='New';}).length);
  setQt('qt-stat-quoted', all.filter(function(q){return q.status==='Quoted';}).length);
  setQt('qt-stat-accepted',all.filter(function(q){return q.status==='Accepted';}).length);
  var statusColor={
    'New':'background:#fef3c7;color:#92400e',
    'Quoted':'background:#fef9c3;color:#854d0e',
    'Accepted':'background:#dcfce7;color:#166534',
    'Declined':'background:#fee2e2;color:#991b1b',
  };
  var page=pgGet('quotations');
  var pages=Math.ceil(list.length/PG_SIZE)||1;
  if(page>pages){ pgSet('quotations',1); page=1; }
  var slice=list.slice((page-1)*PG_SIZE, page*PG_SIZE);
  document.getElementById('quotations-tbody').innerHTML=slice.length
    ? slice.map(function(q){
        var date=q.createdAt&&q.createdAt.seconds?new Date(q.createdAt.seconds*1000).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'--';
        var sc=statusColor[q.status]||'background:#f3f4f6;color:#6b7280';
        var requested=(q.items&&q.items.length)
          ? q.items.map(function(it){
              return '<div style="font-size:12px;color:var(--matcha);white-space:nowrap">'+esc(it.productName||'')
                +(it.type?' <span style="color:var(--text-muted);font-size:11px">('+esc(it.type)+')</span>':'')
                +(it.quantity?' <strong>'+esc(it.quantity)+'</strong>':'')+'</div>';
            }).join('')
          : '<span style="font-size:12px;color:var(--matcha)">'+(q.productName||'—')+'</span>';
        return '<tr>'
          +'<td style="white-space:nowrap;font-size:12px">'+date+'</td>'
          +'<td><strong>'+esc(q.name||'')+'</strong></td>'
          +'<td style="color:var(--text-muted);font-size:12px">'+(q.business||'—')+'</td>'
          +'<td style="font-size:12px">'+esc(q.email||'')+'</td>'
          +'<td>'+requested+'</td>'
          +'<td><span style="'+sc+';padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap">'+esc(q.status)+'</span></td>'
          +'<td><button class="btn-sm" onclick="viewQuotation(\''+q.id+'\')">View</button></td>'
          +'</tr>';
      }).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">No quotation requests yet.</td></tr>';
  renderPagination('quotations', list.length);
}

window.updateQuotationStatus = async function(id, val){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  try{
    await updateDoc(doc(db,'quotations',id),{status:val,updatedAt:serverTimestamp()});
    toast('Status updated: '+val);
  }catch(e){ toast('Error: '+e.message); }
};

// ─── QUOTATION VIEW MODAL ────────────────────────────────────────────────────
window.viewQuotation = function(id){
  var qt=(state.quotations||[]).find(function(q){return q.id===id;});
  if(!qt) return;
  var existing=qt.quotation||null;
  var overlay=document.getElementById('qt-view-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='qt-view-overlay';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:300;display:flex;align-items:center;justify-content:center;padding:1rem';
    overlay.onclick=function(e){if(e.target===overlay)overlay.style.display='none';};
    document.body.appendChild(overlay);
  }
  var canConvert=qt.status==='Quoted';
  overlay.innerHTML='<div style="background:#fff;border-radius:12px;padding:2rem;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;position:relative">'
    +'<button onclick="document.getElementById(\'qt-view-overlay\').style.display=\'none\'" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:20px;cursor:pointer;color:var(--stone);line-height:1">✕</button>'
    +'<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--stone);margin-bottom:.3rem">Quotation Request</div>'
    +'<div style="font-size:18px;font-weight:600;color:var(--dark);margin-bottom:.2rem">'+esc(qt.name||'')+'</div>'
    +'<div style="font-size:12px;color:var(--text-muted);margin-bottom:1.4rem">'+(qt.business?esc(qt.business)+' &middot; ':'')+esc(qt.email||'')+(qt.phone?' &middot; '+esc(qt.phone):'')+'</div>'
    // Line items
    +'<div style="font-size:12px;font-weight:600;color:var(--dark);margin-bottom:.4rem">Line Items</div>'
    +'<div style="display:grid;grid-template-columns:1fr 60px 70px 100px 28px;gap:.3rem;padding:0 2px;margin-bottom:.3rem">'
    +'<span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Description</span>'
    +'<span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Qty</span>'
    +'<span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Unit</span>'
    +'<span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Unit Price (₱)</span>'
    +'<span></span>'
    +'</div>'
    +'<div id="qt-view-lines" style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.5rem"></div>'
    +'<button onclick="addQVLine()" style="background:none;border:1px dashed var(--border);padding:5px 14px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--stone);margin-bottom:1rem;width:100%">+ Add Line</button>'
    // Validity + Notes
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.8rem">'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:.3rem">Validity</label>'
    +'<input id="qt-view-validity" value="'+(existing&&existing.validity?existing.validity:'Valid for 7 days')+'" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px"></div>'
    +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:.3rem">Notes / Terms</label>'
    +'<input id="qt-view-notes" value="'+(existing&&existing.notes?esc(existing.notes):'')+'" placeholder="Min order, payment terms..." style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px"></div>'
    +'</div>'
    // Courier + Shipping
    +(function(){
      var savedCourier=(existing&&existing.courier)||qt.courier||'jnt';
      var savedProvince=(existing&&existing.province)||qt.province||'';
      var savedWeight=(existing&&existing.weightKg)||'';
      var savedFee=(existing&&existing.shippingFee)||0;
      var regionGroups={NCR:[],LUZON:[],VISAYAS:[],MINDANAO:[],ISLAND:[]};
      Object.keys(PROVINCE_REGION).forEach(function(p){ (regionGroups[PROVINCE_REGION[p]]||[]).push(p); });
      var rLabels={NCR:'Metro Manila / NCR',LUZON:'Luzon',VISAYAS:'Visayas',MINDANAO:'Mindanao',ISLAND:'Island / Remote'};
      var provOpts='<option value="">— Select Province —</option>';
      ['NCR','LUZON','VISAYAS','MINDANAO','ISLAND'].forEach(function(r){
        provOpts+='<optgroup label="'+rLabels[r]+'">';
        (regionGroups[r]||[]).sort().forEach(function(p){ provOpts+='<option value="'+p+'"'+(p===savedProvince?' selected':'')+'>'+p+'</option>'; });
        provOpts+='</optgroup>';
      });
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.6rem">'
        +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:.3rem">Courier</label>'
        +'<select id="qt-view-courier" onchange="onQVCourierChange()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px">'
        +'<option value="jnt"'+(savedCourier==='jnt'?' selected':'')+'>J&amp;T Express</option>'
        +'<option value="lalamove"'+(savedCourier==='lalamove'?' selected':'')+'>Lalamove</option>'
        +'</select></div>'
        +'<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:.3rem">Shipping Fee (₱)</label>'
        +'<input type="number" id="qt-view-shipping" value="'+savedFee+'" min="0" placeholder="0" oninput="recalcQVTotal()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px">'
        +'<div id="qt-ship-hint" style="font-size:11px;color:var(--matcha);margin-top:.2rem"></div>'
        +'</div></div>'
        +'<div id="qt-jnt-section" style="display:'+(savedCourier==='jnt'?'grid':'none')+';grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.8rem;background:#f8f9f6;border:1px solid var(--border);border-radius:6px;padding:.8rem">'
        +'<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:.3rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Province / Destination</label>'
        +'<select id="qt-view-province" onchange="onQVCourierChange()" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px">'+provOpts+'</select></div>'
        +'<div><label style="font-size:11px;font-weight:600;display:block;margin-bottom:.3rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Total Weight (kg)</label>'
        +'<input type="number" id="qt-view-weight" value="'+savedWeight+'" min="0.1" step="0.1" placeholder="Auto-estimated" oninput="onQVCourierChange()" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px">'
        +'<div id="qt-weight-hint" style="font-size:10px;color:var(--text-muted);margin-top:.2rem">Estimated from items — override if needed</div>'
        +'</div></div>';
    })()
    // Total display
    +'<div id="qt-view-total" style="background:var(--warm-white);border:1px solid var(--border);border-radius:6px;padding:.8rem 1rem;font-size:14px;font-weight:600;margin-bottom:1.2rem;text-align:right">Total: ₱0</div>'
    // Footer actions
    +'<div style="display:flex;gap:.6rem;flex-wrap:wrap;padding-top:.8rem;border-top:1px solid var(--border)">'
    +'<button onclick="sendQuotFromModal(\''+id+'\')" style="background:var(--matcha);color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500">📧 Send Quotation</button>'
    +(canConvert?'<button onclick="convertQuotToOrder(\''+id+'\')" style="background:#166534;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500">✓ Accepted → Create Order</button>':'')
    +'<button onclick="updateQuotationStatus(\''+id+'\',\'Declined\');document.getElementById(\'qt-view-overlay\').style.display=\'none\'" style="background:#fee2e2;color:#991b1b;border:1px solid #fecaca;padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer">Decline</button>'
    +'<button onclick="deleteQuotation(\''+id+'\')" style="background:none;border:1px solid #fecaca;color:#991b1b;padding:8px 12px;border-radius:6px;font-size:13px;cursor:pointer">Delete</button>'
    +'<button onclick="document.getElementById(\'qt-view-overlay\').style.display=\'none\'" style="background:none;border:1px solid var(--border);padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer;margin-left:auto">Close</button>'
    +'</div>'
    +'</div>';
  overlay.style.display='flex';

  // Pre-fill lines: use saved quotation lines if exists, else build from requested items
  document.getElementById('qt-view-lines').innerHTML='';
  var lines=[];
  if(existing&&existing.lines&&existing.lines.length){
    lines=existing.lines;
  } else if(qt.items&&qt.items.length){
    lines=qt.items.map(function(it){
      var qty=Number(it.quantity)||1;
      var prod=(state.products||[]).find(function(p){return p.id===it.productId;});
      var variantPrice=0;
      if(prod){
        var variants=(prod.variants||[]).map(function(v){return typeof v==='object'?v:{label:String(v),price:null};});
        var matched=variants.find(function(v){return v.label===it.type;});
        variantPrice=matched&&matched.price!=null?Number(matched.price):(prod.price||0);
      }
      return {desc:it.productName,qty:qty,unit:it.type||'pcs',price:variantPrice};
    });
  } else {
    lines=[{desc:qt.productName||'',qty:1,unit:'pcs',price:0}];
  }
  lines.forEach(function(l){addQVLine(l);});
  recalcQVTotal();
  overlay.style.display='flex';
  // Auto-estimate J&T fee after lines are rendered
  setTimeout(function(){ if(typeof onQVCourierChange==='function') onQVCourierChange(); },0);
};

function recalcQVTotal(){
  var subtotal=0;
  document.querySelectorAll('#qt-view-lines > div').forEach(function(row){
    var inputs=row.querySelectorAll('input');
    var qty=parseFloat(inputs[1]&&inputs[1].value)||0;
    var price=parseFloat(inputs[3]&&inputs[3].value)||0;
    subtotal+=qty*price;
  });
  var shipping=parseFloat((document.getElementById('qt-view-shipping')||{}).value)||0;
  var total=subtotal+shipping;
  var el=document.getElementById('qt-view-total');
  if(el) el.innerHTML='<span style="font-weight:400;font-size:12px;color:var(--text-muted)">Subtotal ₱'+subtotal.toLocaleString('en-PH',{minimumFractionDigits:2})
    +(shipping?' &nbsp;+&nbsp; Shipping ₱'+shipping.toLocaleString('en-PH',{minimumFractionDigits:2}):'')
    +' &nbsp;=&nbsp; </span>Total: ₱'+total.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function calcQVWeight(lines){
  var total=0;
  (lines||[]).forEach(function(l){
    var unit=(l.unit||'').toLowerCase().trim();
    if(unit==='kg'){ total+=l.qty; }
    else if(unit==='g'){ total+=l.qty/1000; }
    else {
      var descLower=(l.desc||'').replace(/\s*\(.*?\)/g,'').trim().toLowerCase();
      var prod=(state.products||[]).find(function(p){ return (p.name||'').trim().toLowerCase()===descLower; });
      if(prod&&prod.weight&&Number(prod.weight)>0){ total+=Number(prod.weight)*l.qty; }
      else { total+=0.1*l.qty; }
    }
  });
  return Math.max(total,0.1);
}

window.onQVCourierChange = function(){
  var courier=(document.getElementById('qt-view-courier')||{}).value||'jnt';
  var jntSec=document.getElementById('qt-jnt-section');
  if(jntSec) jntSec.style.display=courier==='jnt'?'grid':'none';
  var hint=document.getElementById('qt-ship-hint');
  if(courier==='jnt'){
    var province=(document.getElementById('qt-view-province')||{}).value||'';
    var weightInput=document.getElementById('qt-view-weight');
    var weight=parseFloat(weightInput&&weightInput.value)||0;
    if(!weight){
      var lines=[];
      document.querySelectorAll('#qt-view-lines > div').forEach(function(row){
        var inputs=row.querySelectorAll('input');
        lines.push({desc:(inputs[0]&&inputs[0].value)||'',qty:parseFloat(inputs[1]&&inputs[1].value)||1,unit:(inputs[2]&&inputs[2].value)||'pcs'});
      });
      weight=calcQVWeight(lines);
      if(weightInput) weightInput.value=Math.round(weight*100)/100;
    }
    if(province&&weight>0){
      var region=getRegionFromProvince(province);
      var rateKey=regionToRateKey(region);
      var fee=getJTShippingFee(weight,rateKey);
      var shippingInput=document.getElementById('qt-view-shipping');
      if(shippingInput) shippingInput.value=fee;
      var regionNames={NCR:'Metro Manila',LUZON:'Luzon',VISAYAS:'Visayas',MINDANAO:'Mindanao',ISLAND:'Island/Remote'};
      if(hint) hint.textContent='J&T '+regionNames[region]+' · '+weight+'kg → ₱'+fee;
      recalcQVTotal();
    } else if(hint){
      hint.textContent=province?'Enter weight to calculate':'Select province to calculate fee';
    }
  } else {
    if(hint) hint.textContent='Enter Lalamove fee manually above';
    recalcQVTotal();
  }
};

window.addQVLine = function(prefill){
  var wrap=document.getElementById('qt-view-lines');
  if(!wrap) return;
  var l=prefill||{};
  var row=document.createElement('div');
  row.style.cssText='display:grid;grid-template-columns:1fr 60px 70px 100px 28px;gap:.3rem;align-items:center';
  row.innerHTML='<input placeholder="Description" value="'+esc(l.desc||'')+'" style="padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px">'
    +'<input type="number" placeholder="Qty" value="'+(l.qty||1)+'" min="0" style="padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px;text-align:center" oninput="recalcQVTotal()">'
    +'<input placeholder="Unit" value="'+esc(l.unit||'pcs')+'" style="padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px">'
    +'<input type="number" placeholder="0.00" value="'+(l.price||'')+'" min="0" style="padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px" oninput="recalcQVTotal()">'
    +'<button onclick="this.closest(\'div\').remove();recalcQVTotal()" style="background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:0;line-height:1">×</button>';
  wrap.appendChild(row);
};

window.sendQuotFromModal = async function(id){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  var qt=(state.quotations||[]).find(function(q){return q.id===id;});
  if(!qt) return;
  var lines=[]; var total=0;
  document.querySelectorAll('#qt-view-lines > div').forEach(function(row){
    var inputs=row.querySelectorAll('input');
    var desc=(inputs[0]&&inputs[0].value.trim())||'';
    var qty=parseFloat(inputs[1]&&inputs[1].value)||1;
    var unit=(inputs[2]&&inputs[2].value.trim())||'pcs';
    var price=parseFloat(inputs[3]&&inputs[3].value)||0;
    if(desc){lines.push({desc:desc,qty:qty,unit:unit,price:price});total+=qty*price;}
  });
  if(!lines.length){toast('Add at least one line item');return;}
  var validity=(document.getElementById('qt-view-validity').value||'').trim();
  var notes=(document.getElementById('qt-view-notes').value||'').trim();
  var shipping=parseFloat((document.getElementById('qt-view-shipping')||{}).value)||0;
  var courier=(document.getElementById('qt-view-courier')||{}).value||'jnt';
  var province=(document.getElementById('qt-view-province')||{}).value||'';
  var weightKg=parseFloat((document.getElementById('qt-view-weight')||{}).value)||0;
  var quotation={lines:lines,subtotal:total,shippingFee:shipping,total:total+shipping,courier:courier,province:province,weightKg:weightKg,validity:validity,notes:notes,sentAt:new Date().toISOString()};
  try{
    await updateDoc(doc(db,'quotations',id),{status:'Quoted',quotation:quotation,updatedAt:serverTimestamp()});
    document.getElementById('qt-view-overlay').style.display='none';
    if(resendReady()){
      await sendQuoteEmail(qt,quotation);
      toast('Quotation sent to '+qt.email+' 📧');
    } else {
      toast('Quotation saved — Resend not configured, no email sent.');
    }
  }catch(e){toast('Error: '+e.message);}
};

window.convertQuotToOrder = async function(id){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  var qt=(state.quotations||[]).find(function(q){return q.id===id;});
  if(!qt||!qt.quotation){ toast('Send the quotation first before converting.'); return; }
  if(!confirm('Convert this quotation to an order? This will create a new entry in the Orders tab.')) return;
  var q=qt.quotation;
  var items=q.lines.map(function(l){return {name:l.desc,qty:l.qty,variant:l.unit,price:l.price,total:l.qty*l.price};});
  var ref='WQ-'+Date.now().toString(36).toUpperCase();
  try{
    await addDoc(collection(db,'orders'),{
      ref:ref, customer:qt.name, email:qt.email, phone:qt.phone||'',
      address:qt.province||'', items:items, total:q.total,
      shipping:q.shippingFee||0,
      shippingMethod:q.courier==='lalamove'?'Lalamove':'J&T Express',
      courier:q.courier==='lalamove'?'Lalamove':'J&T Express',
      type:'wholesale-quotation',
      proofURL:qt.proofURL||null,
      status:'Processing', notes:q.notes||'', createdAt:serverTimestamp(),
    });
    await updateDoc(doc(db,'quotations',id),{status:'Accepted',updatedAt:serverTimestamp()});
    document.getElementById('qt-view-overlay').style.display='none';
    toast('Order created: '+ref+' — check the Orders tab');
    // Navigate to orders tab
    var ordersBtn=document.querySelector('[onclick*="showDash(\'orders\'"]') || document.querySelector('[onclick="showDash(\'orders\',this)"]');
    if(ordersBtn) ordersBtn.click();
  }catch(e){toast('Error: '+e.message);}
};

window.deleteQuotation = async function(id){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  if(!confirm('Delete this quotation permanently?')) return;
  try{
    await deleteDoc(doc(db,'quotations',id));
    toast('Quotation deleted');
    document.getElementById('qt-view-overlay').style.display='none';
  }catch(e){toast('Error: '+e.message);}
};

window.openQuoteModal = function(id){
  var inq = (state.inquiries||[]).find(function(i){ return i.id===id; });
  if(!inq) return;
  var p = inq.productId ? state.products.find(function(x){ return x.id===inq.productId; }) : null;

  var existing = inq.quotation || null;
  var overlay = document.getElementById('quote-modal-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'quote-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:300;display:flex;align-items:center;justify-content:center';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:2rem;max-width:560px;width:92%;max-height:90vh;overflow-y:auto;position:relative">'
    +'<button onclick="document.getElementById(\'quote-modal-overlay\').style.display=\'none\'" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:18px;cursor:pointer;color:#888">✕</button>'
    +'<div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#888;margin-bottom:.3rem">Send Quotation</div>'
    +'<h3 style="font-family:var(--font-display);font-size:22px;font-weight:400;color:var(--dark);margin-bottom:.2rem">'+(p?p.name:'General Quotation')+'</h3>'
    +'<p style="font-size:12px;color:var(--text-muted);margin-bottom:1.4rem">To: <strong>'+esc(inq.name||'')+'</strong> &lt;'+esc(inq.email||'')+'&gt;</p>'

    +'<label style="font-size:12px;font-weight:600;display:block;margin-bottom:.3rem">Products / Line Items</label>'
    +'<div id="quote-lines" style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:.5rem"></div>'
    +'<button onclick="addQuoteLine()" style="background:none;border:1px dashed var(--border);padding:5px 14px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--stone);margin-bottom:1rem">+ Add Line Item</button>'

    +'<label style="font-size:12px;font-weight:600;display:block;margin-bottom:.3rem">Validity</label>'
    +'<input id="quote-validity" placeholder="e.g. Valid for 7 days" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;margin-bottom:.9rem" value="'+(existing&&existing.validity?existing.validity:'Valid for 7 days')+'">'

    +'<label style="font-size:12px;font-weight:600;display:block;margin-bottom:.3rem">Notes / Terms</label>'
    +'<textarea id="quote-notes" rows="3" placeholder="Minimum order qty, payment terms, delivery, etc." style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;resize:vertical;margin-bottom:1.2rem">'+(existing&&existing.notes?existing.notes:'')+'</textarea>'

    +'<div style="display:flex;gap:.6rem;justify-content:flex-end">'
      +'<button onclick="document.getElementById(\'quote-modal-overlay\').style.display=\'none\'" style="background:none;border:1px solid var(--border);padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer">Cancel</button>'
      +'<button onclick="submitQuote(\''+id+'\')" style="background:var(--matcha);color:#fff;border:none;padding:8px 22px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500">Send Quotation 📧</button>'
    +'</div>'
  +'</div>';
  overlay.style.display = 'flex';

  // Populate lines from existing or default to one line from product
  var lines = existing && existing.lines && existing.lines.length ? existing.lines : [
    { desc: p ? p.name : (inq.productName||''), qty: 1, unit: 'pcs', price: p ? p.price : 0 }
  ];
  document.getElementById('quote-lines').innerHTML = '';
  lines.forEach(function(l){ addQuoteLine(l); });
};

window.addQuoteLine = function(prefill){
  var wrap = document.getElementById('quote-lines');
  if(!wrap) return;
  var row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 60px 70px 90px 28px;gap:.3rem;align-items:center';
  var l = prefill || {};
  row.innerHTML = '<input placeholder="Description" value="'+(l.desc||'')+'" style="padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px">'
    +'<input type="number" placeholder="Qty" value="'+(l.qty||1)+'" min="1" style="padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px;text-align:center">'
    +'<input placeholder="Unit" value="'+(l.unit||'pcs')+'" style="padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px">'
    +'<input type="number" placeholder="Unit Price" value="'+(l.price||'')+'" min="0" style="padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px">'
    +'<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:0;line-height:1">×</button>';
  wrap.appendChild(row);
};

window.submitQuote = async function(id){
  var inq = (state.inquiries||[]).find(function(i){ return i.id===id; });
  if(!inq){ toast('Inquiry not found'); return; }

  // Collect lines
  var rows = document.querySelectorAll('#quote-lines > div');
  var lines = [];
  var total = 0;
  rows.forEach(function(row){
    var inputs = row.querySelectorAll('input');
    var desc = inputs[0].value.trim();
    var qty = parseFloat(inputs[1].value)||1;
    var unit = inputs[2].value.trim()||'pcs';
    var price = parseFloat(inputs[3].value)||0;
    if(desc){ lines.push({desc:desc,qty:qty,unit:unit,price:price}); total+=qty*price; }
  });
  if(!lines.length){ toast('Add at least one line item'); return; }

  var validity = document.getElementById('quote-validity').value.trim();
  var notes = document.getElementById('quote-notes').value.trim();
  var quotation = { lines:lines, total:total, validity:validity, notes:notes, sentAt: new Date().toISOString() };

  // Save to Firebase
  await updateDoc(doc(db,'inquiries',id),{ status:'Quoted', quotation:quotation });
  document.getElementById('quote-modal-overlay').style.display='none';
  toast('Quotation saved ✓');

  // Send email
  if(resendReady()){
    try{
      await sendQuoteEmail(inq, quotation);
      toast('Quotation sent to '+inq.email+' 📧');
    }catch(e){
      console.error('Quote email failed:', e);
      var isCors = e instanceof TypeError || e.message==='Failed to fetch';
      if(isCors){
        var bodyLines = lines.map(function(l){ return l.desc+' ('+l.qty+' '+l.unit+') — ₱'+Number(l.qty*l.price).toLocaleString(); }).join('\n');
        var subject = encodeURIComponent('Your Zen & Sip Quotation');
        var body = encodeURIComponent('Hi '+inq.name+',\n\nHere is your quotation:\n\n'+bodyLines+'\n\nTotal: ₱'+Number(total).toLocaleString()+'\n\n'+validity+'\n\n'+(notes?notes+'\n\n':'')+'Thank you,\nZen & Sip');
        window.open('mailto:'+inq.email+'?subject='+subject+'&body='+body);
        toast('⚠️ Email blocked by browser — mailto opened instead.');
      } else {
        toast('❌ Email failed: '+e.message);
      }
    }
  } else {
    toast('⚠️ Resend not configured — status saved but no email sent.');
  }
};

async function sendQuoteEmail(inq, quotation){
  var rowsHtml = quotation.lines.map(function(l){
    var subtotal = (l.qty * l.price);
    return '<tr style="border-bottom:1px solid #e5e7eb">'
      +'<td style="padding:8px 12px;font-size:13px">'+l.desc+'</td>'
      +'<td style="padding:8px 12px;font-size:13px;text-align:center">'+l.qty+' '+l.unit+'</td>'
      +'<td style="padding:8px 12px;font-size:13px;text-align:right">₱'+Number(l.price).toLocaleString('en-PH',{minimumFractionDigits:2})+'</td>'
      +'<td style="padding:8px 12px;font-size:13px;text-align:right;font-weight:600">₱'+Number(subtotal).toLocaleString('en-PH',{minimumFractionDigits:2})+'</td>'
      +'</tr>';
  }).join('');
  var shipping = quotation.shippingFee||0;
  var shippingRow = shipping>0
    ? '<tr style="border-bottom:1px solid #e5e7eb"><td colspan="3" style="padding:8px 12px;font-size:13px;color:#666">Shipping Fee</td>'
      +'<td style="padding:8px 12px;font-size:13px;text-align:right">₱'+Number(shipping).toLocaleString('en-PH',{minimumFractionDigits:2})+'</td></tr>'
    : '';
  var siteUrl = window.location.origin+(window.location.pathname==='/'?'':window.location.pathname);
  var acceptUrl = inq.id ? siteUrl+'?qt_action=accept&qt_id='+inq.id : '';
  var declineUrl = inq.id ? siteUrl+'?qt_action=decline&qt_id='+inq.id : '';
  var actionBtns = acceptUrl
    ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px">'
      +'<tr><td align="center" style="padding:0 8px">'
      +'<a href="'+acceptUrl+'" style="display:inline-block;background:#3d5a3e;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:.03em">✓ Accept Quotation</a>'
      +'</td><td align="center" style="padding:0 8px">'
      +'<a href="'+declineUrl+'" style="display:inline-block;background:#fff;color:#991b1b;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;border:2px solid #fecaca">✕ Decline</a>'
      +'</td></tr></table>'
      +'<p style="font-size:11px;color:#aaa;text-align:center;margin:0 0 16px">Clicking a button will update your quotation status automatically.</p>'
    : '';
  var html = emailWrap(
    '<h2 style="font-size:20px;color:#2d3a2e;margin:0 0 4px">Your Quotation from Zen & Sip 📋</h2>'
    +'<p style="font-size:13px;color:#666;margin:0 0 20px">Hi '+inq.name+', here are the pricing details you requested.</p>'
    +'<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:1rem">'
    +'<thead><tr style="background:#f3f4f6">'
    +'<th style="padding:8px 12px;font-size:12px;text-align:left;color:#555">Description</th>'
    +'<th style="padding:8px 12px;font-size:12px;text-align:center;color:#555">Qty</th>'
    +'<th style="padding:8px 12px;font-size:12px;text-align:right;color:#555">Unit Price</th>'
    +'<th style="padding:8px 12px;font-size:12px;text-align:right;color:#555">Subtotal</th>'
    +'</tr></thead>'
    +'<tbody>'+rowsHtml+shippingRow+'</tbody>'
    +'<tfoot><tr style="background:#f9fafb">'
    +'<td colspan="3" style="padding:10px 12px;font-size:14px;font-weight:700;color:#2d3a2e">Total</td>'
    +'<td style="padding:10px 12px;font-size:14px;font-weight:700;color:#2d3a2e;text-align:right">₱'+Number(quotation.total).toLocaleString('en-PH',{minimumFractionDigits:2})+'</td>'
    +'</tr></tfoot>'
    +'</table>'
    +(quotation.validity?'<p style="font-size:12px;color:#888;margin-bottom:.5rem">⏳ '+quotation.validity+'</p>':'')
    +(quotation.notes?'<p style="font-size:13px;color:#555;margin-bottom:1rem;white-space:pre-wrap">'+quotation.notes+'</p>':'')
    +actionBtns
    +'<p style="font-size:13px;color:#555;margin-top:.5rem">Questions? Reply to this email or reach us at <a href="mailto:'+OWNER_EMAIL+'" style="color:#4a7c59">'+OWNER_EMAIL+'</a>.</p>'
  );
  await resendSend(inq.email, 'Your Zen & Sip Quotation — '+inq.name, html);
}

window.updateInquiryStatus = async function(id, val, customMsg){
  try{ requireAuth(); }catch(e){ toast('Admin access required.'); return; }
  var inq = (state.inquiries||[]).find(function(i){ return i.id===id; });
  await updateDoc(doc(db,'inquiries',id),{status:val});
  if(inq && inq.email){ try{ await setDoc(doc(db,'partner_status',(inq.email||'').toLowerCase()),{status:val,updatedAt:serverTimestamp()},{merge:true}); }catch(e){} }
  toast('Status updated: '+val);
  if(customMsg === null) return; // skip email
  if(inq && resendReady()){
    var msgObj = customMsg || INQ_MSG_DEFAULTS[val];
    if(msgObj && msgObj.body){
      try{
        await sendWholesaleStatusEmail(inq, msgObj, val);
        toast('Email sent to '+inq.email+' 📧');
      }catch(e){ alert('Email failed: '+e.message); }
    }
  }
};

