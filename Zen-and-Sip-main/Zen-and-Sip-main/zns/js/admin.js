// ─── HERO CAROUSEL IMAGE UPLOAD ───────────────────────────────────────────────
var _carouselImages = [];

function compressCarouselImage(file, cb){
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var canvas=document.createElement('canvas');
      var max=600,w=img.width,h=img.height;
      if(w>max){h=Math.round(h*max/w);w=max;}
      if(h>max){w=Math.round(w*max/h);h=max;}
      canvas.width=w;canvas.height=h;
      var ctx=canvas.getContext('2d');
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.drawImage(img,0,0,w,h);
      var useWebP=canvas.toDataURL('image/webp').startsWith('data:image/webp');
      cb(useWebP?canvas.toDataURL('image/webp',0.60):canvas.toDataURL('image/jpeg',0.55));
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderCarouselPreview(){
  var prev=document.getElementById('carousel-preview');
  var saveBtn=document.getElementById('carousel-save-btn');
  var clearBtn=document.getElementById('carousel-clear-btn');
  if(!prev) return;
  prev.innerHTML=_carouselImages.map(function(src,i){
    return '<div style="position:relative;display:inline-block">'
      +'<img src="'+src+'" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">'
      +'<button onclick="removeCarouselImage('+i+')" style="position:absolute;top:-6px;right:-6px;background:#e24b4a;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:18px;text-align:center;padding:0">✕</button>'
      +'</div>';
  }).join('');
  if(saveBtn) saveBtn.style.display=_carouselImages.length?'':'none';
  if(clearBtn) clearBtn.style.display=_carouselImages.length?'':'none';
}
window.removeCarouselImage=function(i){_carouselImages.splice(i,1);renderCarouselPreview();};
window.handleCarouselSelect=function(e){
  var files=Array.from(e.target.files);
  var done=0;
  files.forEach(function(file){compressCarouselImage(file,function(b64){_carouselImages.push(b64);done++;if(done===files.length)renderCarouselPreview();});});
  e.target.value='';
};
window.handleCarouselDrop=function(e){
  e.preventDefault();
  document.getElementById('carousel-drop-zone').classList.remove('drag-over');
  var files=Array.from(e.dataTransfer.files).filter(function(f){return f.type.startsWith('image/');});
  if(!files.length)return;
  var done=0;
  files.forEach(function(file){compressCarouselImage(file,function(b64){_carouselImages.push(b64);done++;if(done===files.length)renderCarouselPreview();});});
};
window.saveCarouselImages=async function(){
  var btn=document.getElementById('carousel-save-btn');
  if(btn){btn.textContent='Saving…';btn.disabled=true;}
  try{
    await setDoc(doc(db,'settings','hero-carousel'),{images:_carouselImages,updatedAt:serverTimestamp()});
    toast('✅ Carousel images saved');
    applyHeroCarousel();
  }catch(e){toast('Error saving carousel: '+e.message);}
  if(btn){btn.textContent='💾 Save Carousel';btn.disabled=false;}
};
window.clearCarouselImages=async function(){
  if(!confirm('Remove all carousel images?'))return;
  _carouselImages=[];renderCarouselPreview();
  try{await setDoc(doc(db,'settings','hero-carousel'),{images:[],updatedAt:serverTimestamp()});toast('Carousel cleared');applyHeroCarousel();}catch(e){}
};
async function loadHeroCarousel(){
  try{
    var snap=await getDoc(doc(db,'settings','hero-carousel'));
    if(snap.exists()){_carouselImages=snap.data().images||[];renderCarouselPreview();applyHeroCarousel();}
  }catch(e){}
}
function applyHeroCarousel(){
  if(typeof buildHomeGallery === 'function') buildHomeGallery(_carouselImages);
  var heroRight = document.querySelector('.hero-right');
  if(heroRight){
    heroRight.querySelectorAll('img[data-cidx]').forEach(function(el){ el.remove(); });
  }
  if(window._carouselTimer){ clearInterval(window._carouselTimer); window._carouselTimer=null; }
}

window.adminLogout = async function(){
  await signOut(auth);
  showPage('home');
};

(function(){ if(localStorage.getItem('zs_theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); })();
window.toggleDarkMode = function(){
  var isDark=document.documentElement.getAttribute('data-theme')==='dark';
  var btn=document.getElementById('dark-toggle');
  if(isDark){ document.documentElement.removeAttribute('data-theme'); localStorage.setItem('zs_theme','light'); if(btn)btn.textContent='🌙'; }
  else { document.documentElement.setAttribute('data-theme','dark'); localStorage.setItem('zs_theme','dark'); if(btn)btn.textContent='☀️'; }
};
document.addEventListener('DOMContentLoaded',function(){ var btn=document.getElementById('dark-toggle'); if(btn)btn.textContent=document.documentElement.getAttribute('data-theme')==='dark'?'☀️':'🌙'; });
window.toggleMobileNav = function(){
  var links=document.querySelector('.nav-links'); var burger=document.getElementById('nav-hamburger');
  if(!links||!burger)return; var isOpen=links.classList.toggle('mobile-open'); burger.classList.toggle('open',isOpen);
};
document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.nav-link').forEach(function(btn){ btn.addEventListener('click',function(){ var l=document.querySelector('.nav-links');var b=document.getElementById('nav-hamburger'); if(l)l.classList.remove('mobile-open');if(b)b.classList.remove('open'); }); });
});

var _adminsUnsub = null;

var _origShowDash3 = window.showDash;
window.showDash = function(id, btn){
  _origShowDash3(id, btn);
  if(id === 'overview' && typeof updateStats === 'function'){
    updateStats();
    if(typeof renderOverviewOrders === 'function') renderOverviewOrders();
  }
  if(id === 'accounts') loadAdminsList();
  if(id === 'reviews' && typeof renderAdminReviews === 'function') renderAdminReviews();
  if(id === 'settings' && typeof loadWsAnnouncementAdmin === 'function') loadWsAnnouncementAdmin();
  var sel = document.getElementById('dash-mobile-nav');
  if(sel) sel.value = id;
};

window.dashMobileNav = function(val){
  var sel = document.getElementById('dash-mobile-nav');
  if(val === 'preview-wholesale'){
    if(typeof adminPreviewWholesale === 'function') adminPreviewWholesale();
    if(sel) sel.value = 'overview';
  } else if(val === 'back-to-store'){
    if(typeof showPage === 'function') showPage('home');
    if(sel) sel.value = 'overview';
  } else {
    showDash(val, null);
  }
};

function loadAdminsList(){
  var el = document.getElementById('admins-list');
  if(!el) return;
  if(_adminsUnsub) _adminsUnsub();
  _adminsUnsub = onSnapshot(collection(db,'admins'), function(snap){
    if(!snap.docs.length){
      el.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:.5rem 0">No admins registered yet.</div>';
      return;
    }
    el.innerHTML = snap.docs.map(function(d){
      var a = Object.assign({id:d.id}, d.data());
      var isActive = a.active !== false;
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.8rem 0;border-bottom:1px solid var(--border)">'
        +'<div>'
          +'<div style="font-size:14px;font-weight:500;color:var(--dark)">'+esc(a.name||'Admin')+'</div>'
          +'<div style="font-size:12px;color:var(--text-muted)">'+esc(a.email||'')+'</div>'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:.5rem">'
          +'<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:'+(isActive?'var(--matcha-pale)':'#f3f4f6')+';color:'+(isActive?'var(--matcha)':'var(--stone)')+'">'+(isActive?'Active':'Deactivated')+'</span>'
          +(isActive
            ? '<button onclick="deactivateAdmin(\'' + a.id + '\')" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:4px;background:none;color:var(--stone);cursor:pointer">Deactivate</button>'
            : '<button onclick="reactivateAdmin(\'' + a.id + '\')" style="font-size:11px;padding:4px 10px;border:1px solid var(--matcha);border-radius:4px;background:none;color:var(--matcha);cursor:pointer">Reactivate</button>'
          )
        +'</div>'
        +'</div>';
    }).join('');
  }, function(err){ if(err.code!=='permission-denied') console.warn('loadAdminsList:', err); });
}

window.createAdminAccount = async function(){
  var name   = (document.getElementById('new-admin-name')||{}).value?.trim();
  var email  = (document.getElementById('new-admin-email')||{}).value?.trim();
  var pw     = (document.getElementById('new-admin-password')||{}).value;
  var msg    = document.getElementById('new-admin-msg');
  if(!name)  { showAdminMsg(msg,'Please enter a name.','error'); return; }
  if(!email) { showAdminMsg(msg,'Please enter an email.','error'); return; }
  if(!pw || pw.length < 8){ showAdminMsg(msg,'Password must be at least 8 characters.','error'); return; }
  showAdminMsg(msg,'Creating account…','info');
  try{
    await addDoc(collection(db,'admins'),{
      name: name, email: email, active: true,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.email || 'owner',
    });
    showAdminMsg(msg,'✅ Admin record created. Now create the Firebase Auth account at console.firebase.google.com with email: '+email+' and the password you set.','success');
    document.getElementById('new-admin-name').value='';
    document.getElementById('new-admin-email').value='';
    document.getElementById('new-admin-password').value='';
  }catch(e){ showAdminMsg(msg,'❌ Error: '+e.message,'error'); }
};

window.deactivateAdmin = async function(id){
  if(!confirm('Deactivate this admin? They will no longer be listed as active.')) return;
  try{ await updateDoc(doc(db,'admins',id),{active:false}); toast('Admin deactivated'); }
  catch(e){ toast('Error: '+e.message); }
};
window.reactivateAdmin = async function(id){
  try{ await updateDoc(doc(db,'admins',id),{active:true}); toast('Admin reactivated ✓'); }
  catch(e){ toast('Error: '+e.message); }
};
function showAdminMsg(el, text, type){
  if(!el) return;
  el.style.display='block';
  el.style.color = type==='error'?'#991b1b':type==='success'?'#166534':'var(--text-muted)';
  el.textContent = text;
}
