
function lazyLoadCarouselImages(trackEl){
  if(!trackEl)return;
  var slides=trackEl.querySelectorAll('.carousel-slide img');
  slides.forEach(function(img,i){
    if(i===0)return;
    if(img.src&&!img.dataset.src){ img.dataset.src=img.src; img.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }
  });
  if(!window.IntersectionObserver){ slides.forEach(function(img){ if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src;} }); return; }
  var observer=new IntersectionObserver(function(entries){ entries.forEach(function(entry){ if(entry.isIntersecting){ var img=entry.target; if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src;} observer.unobserve(img); } }); },{rootMargin:'300px'});
  slides.forEach(function(img){ if(img.dataset.src)observer.observe(img); });
}
// ─── INIT ─────────────────────────────────────────────────────────────────────
var adminListenersStarted = false;

window.startAdminListeners = function startAdminListeners(){
  if(adminListenersStarted) return;
  adminListenersStarted = true;
  listenOrders();
  listenInquiries();
  listenQuotations();
  listenDiscountCodes();
  loadStoreSettings();
  loadHeroCarousel();
}

// remove old wholesale seed products — admin only
async function removeWholesaleDefaults(){
  if(!auth.currentUser) return; // skip if not admin
  const NAMES=['Bulk Ceremonial (1kg)','Latte Blend Bulk (5kg)','White Label Package'];
  try{
    const snap = await getDocs(collection(db,'products'));
    for(var d of snap.docs){
      if(NAMES.includes(d.data().name)) await deleteDoc(doc(db,'products',d.id));
    }
  }catch(e){ console.warn('removeWholesaleDefaults skipped:', e.code); }
}

(async function(){
  try{
    // Only run seed/cleanup if admin is already logged in
    if(auth.currentUser){
      await removeWholesaleDefaults();
      await seedProducts();
      await seedPromos();
      await seedHero();
    }
  }catch(e){console.warn('Seed skipped or failed:',e);}
  // Public listeners — always run, no auth needed
  listenProducts();
  listenPromos();
  listenHero();
})();


// ─── PRODUCT MODAL CAROUSEL ──────────────────────────────────────────────────
var modalCarouselIdx=0;
var modalCarouselImgs=[];
function buildModalCarousel(imgs,emoji){
  modalCarouselImgs=imgs;
  modalCarouselIdx=0;
  var track=document.getElementById('modal-carousel-track');
  var dots=document.getElementById('modal-dots');
  var prevBtn=document.getElementById('modal-prev');
  var nextBtn=document.getElementById('modal-next');
  if(!imgs||imgs.length===0){
    track.innerHTML='<div class="carousel-slide">'+(emoji||'🍵')+'</div>';
    dots.innerHTML='';
    prevBtn.style.display=nextBtn.style.display='none';
    return;
  }
  track.innerHTML=imgs.map(function(src){
    return '<div class="carousel-slide"><img src="'+src+'" loading="lazy"></div>';
  }).join('');
  prevBtn.style.display=nextBtn.style.display=imgs.length>1?'flex':'none';
  dots.innerHTML=imgs.length>1?imgs.map(function(_,i){
    return '<button class="carousel-dot'+(i===0?' active':'')+'" onclick="modalCarouselGoTo('+i+')"></button>';
  }).join(''):'';
  modalCarouselGoTo(0,false);
}
function modalCarouselGoTo(idx,animate){
  var track=document.getElementById('modal-carousel-track');
  if(animate===false){
    track.style.transition='none';
    setTimeout(function(){track.style.transition='';},50);
  }
  modalCarouselIdx=Math.max(0,Math.min(idx,modalCarouselImgs.length-1));
  track.style.transform='translateX(-'+modalCarouselIdx*100+'%)';
  document.querySelectorAll('#modal-dots .carousel-dot').forEach(function(d,i){d.classList.toggle('active',i===modalCarouselIdx);});
}
window.modalCarouselMove=function(dir){modalCarouselGoTo(modalCarouselIdx+dir);};
// Keyboard navigation for product modal carousel
document.addEventListener('keydown',function(e){
  var ov=document.getElementById('product-overlay');
  if(!ov||!ov.classList.contains('open')) return;
  if(e.key==='ArrowLeft') modalCarouselMove(-1);
  if(e.key==='ArrowRight') modalCarouselMove(1);
});

// ─── TOUCH / SWIPE HELPER ────────────────────────────────────────────────────
function addSwipe(el, onSwipeLeft, onSwipeRight){
  if(!el) return;
  var startX=0, startY=0, dragging=false;
  el.addEventListener('touchstart',function(e){
    startX=e.touches[0].clientX;
    startY=e.touches[0].clientY;
    dragging=true;
  },{passive:true});
  el.addEventListener('touchmove',function(e){
    if(!dragging) return;
    var dx=e.touches[0].clientX-startX;
    var dy=e.touches[0].clientY-startY;
    // Only prevent scroll if clearly a horizontal swipe
    if(Math.abs(dx)>Math.abs(dy)) e.preventDefault();
  },{passive:false});
  el.addEventListener('touchend',function(e){
    if(!dragging) return;
    dragging=false;
    var dx=e.changedTouches[0].clientX-startX;
    var dy=e.changedTouches[0].clientY-startY;
    if(Math.abs(dx)<Math.abs(dy)||Math.abs(dx)<30) return; // ignore vertical or tiny swipes
    if(dx<0) onSwipeLeft(); else onSwipeRight();
  },{passive:true});
}

// Attach swipe to modal carousel wrap (set up after DOM ready)
document.addEventListener('DOMContentLoaded',function(){
  var modalWrap=document.getElementById('modal-carousel-wrap');
  addSwipe(modalWrap,
    function(){ modalCarouselMove(1); },
    function(){ modalCarouselMove(-1); }
  );
});

// ─── WHOLESALE CAROUSEL MODAL ───────────────────────────────────────────────
var wsCarouselIdx=0;
var wsCarouselImgs=[];
function buildWsCarousel(imgs,emoji){
  wsCarouselImgs=imgs;
  wsCarouselIdx=0;
  var track=document.getElementById('ws-carousel-track');
  var dots=document.getElementById('ws-dots');
  var thumbStrip=document.getElementById('ws-thumb-strip');
  var prevBtn=document.getElementById('ws-prev');
  var nextBtn=document.getElementById('ws-next');
  if(!imgs||imgs.length===0){
    track.innerHTML='<div class="carousel-slide" style="font-size:80px">'+(emoji||'📦')+'</div>';
    dots.innerHTML='';thumbStrip.innerHTML='';
    prevBtn.style.display=nextBtn.style.display='none';
    return;
  }
  track.innerHTML=imgs.map(function(src){
    return '<div class="carousel-slide"><img src="'+src+'" loading="lazy"></div>';
  }).join('');
  prevBtn.style.display=nextBtn.style.display=imgs.length>1?'flex':'none';
  dots.innerHTML=imgs.length>1?imgs.map(function(_,i){
    return '<button class="carousel-dot'+(i===0?' active':'') +'" onclick="wsCarouselGoTo('+i+')"></button>';
  }).join(''):'';
  thumbStrip.innerHTML=imgs.length>1?imgs.map(function(src,i){
    return '<img class="thumb-mini'+(i===0?' active':'') +'" src="'+src+'" onclick="wsCarouselGoTo('+i+')" loading="lazy">';
  }).join(''):'';
  wsCarouselGoTo(0,false);
}
function wsCarouselGoTo(idx,animate){
  if(animate===false){
    document.getElementById('ws-carousel-track').style.transition='none';
    setTimeout(function(){document.getElementById('ws-carousel-track').style.transition='';},50);
  }
  wsCarouselIdx=Math.max(0,Math.min(idx,wsCarouselImgs.length-1));
  document.getElementById('ws-carousel-track').style.transform='translateX(-'+wsCarouselIdx*100+'%)';
  document.querySelectorAll('#ws-dots .carousel-dot').forEach(function(d,i){d.classList.toggle('active',i===wsCarouselIdx);});
  document.querySelectorAll('#ws-thumb-strip .thumb-mini').forEach(function(t,i){t.classList.toggle('active',i===wsCarouselIdx);});
}
window.wsCarouselMove=function(dir){wsCarouselGoTo(wsCarouselIdx+dir);};
// Attach swipe to wholesale carousel wrap
(function(){
  var _wsSwipeAttached=false;
  var _origBuildWs=buildWsCarousel;
  buildWsCarousel=function(imgs,emoji){
    _origBuildWs(imgs,emoji);
    if(!_wsSwipeAttached){
      var wsWrap=document.getElementById('ws-carousel-wrap')||document.querySelector('#ws-modal .carousel-wrap');
      addSwipe(wsWrap,
        function(){ wsCarouselMove(1); },
        function(){ wsCarouselMove(-1); }
      );
      _wsSwipeAttached=true;
    }
  };
})();
window.openWsModal=function(id){
  var p=state.products.find(x=>x.id===id);
  if(!p) return;
  var imgs=p.imageURLs&&p.imageURLs.length?p.imageURLs:(p.imageURL?[p.imageURL]:[]);
  buildWsCarousel(imgs,p.emoji);
  document.getElementById('ws-modal-name').textContent=p.name;

  // Normalise variants to objects
  var wsVariants=(p.variants||[]).map(function(v){
    if(typeof v==='object') return v;
    // handle legacy string format "30g:580"
    var parts=String(v).split(':');
    return {label:parts[0].trim(), price:parts[1]?parseFloat(parts[1]):null};
  });

  // Determine price display: if variants have prices, show range; else show base
  var variantPrices=wsVariants.map(function(v){return v.price;}).filter(function(x){return x!=null&&x>0;});
  var priceStr;
  if(variantPrices.length){
    var minP=Math.min.apply(null,variantPrices);
    var maxP=Math.max.apply(null,variantPrices);
    priceStr = minP===maxP
      ? '₱'+parseFloat(minP).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
      : '₱'+parseFloat(minP).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
        +' – ₱'+parseFloat(maxP).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  } else {
    priceStr=p.price&&p.price>0?'₱'+parseFloat(p.price).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}):'Price upon request';
  }
  document.getElementById('ws-modal-price').textContent=priceStr;
  document.getElementById('ws-modal-desc').innerHTML=esc(p.desc||'').replace(/\n/g,'<br>');

  // Render variants — clicking updates the displayed price, no add-to-cart
  var wsVWrap=document.getElementById('ws-modal-variants-wrap');
  var wsVEl=document.getElementById('ws-modal-variants');
  if(wsVariants.length){
    wsVEl.innerHTML=wsVariants.map(function(v){
      var varPrice = v.price!=null&&v.price>0 ? v.price : (p.price&&p.price>0 ? p.price : null);
      var priceTag = varPrice!=null
        ? ' — ₱'+parseFloat(varPrice).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})
        : '';
      return '<button class="variant-btn" data-vprice="'+(varPrice||'')+'" onclick="wsSelectVariant(this)">'
        +esc(v.label)+priceTag
        +'</button>';
    }).join('');
    wsVWrap.style.display='block';
    // Auto-select first variant so price shows immediately
    var firstBtn = wsVEl.querySelector('.variant-btn');
    if(firstBtn) wsSelectVariant(firstBtn);
  } else {
    wsVWrap.style.display='none';
  }
  var descEl=document.getElementById('ws-modal-desc');
  var quoteBtn=document.getElementById('ws-modal-quote-btn');
  if(window.innerWidth<=768){
    // Mobile: two-step — View Details reveals description, then Request Quote
    descEl.style.display='none';
    quoteBtn.textContent='View Details';
    quoteBtn.className='btn-atc';
    quoteBtn.style.cssText='width:100%;padding:14px;font-size:15px;flex-shrink:0;margin-top:auto';
    quoteBtn.onclick=function(){
      descEl.style.display='block';
      quoteBtn.textContent='Request Quote →';
      quoteBtn.className='btn-secondary';
      quoteBtn.style.cssText='width:100%;padding:13px;font-size:14px;flex-shrink:0;margin-top:1rem';
      quoteBtn.onclick=function(){closeWsModalDirect();openInquiryModal(id);};
    };
  } else {
    // Desktop: original behavior — show description immediately
    descEl.style.display='block';
    quoteBtn.textContent='Request Quote →';
    quoteBtn.className='btn-secondary';
    quoteBtn.style.cssText='width:100%;padding:11px;font-size:13px;flex-shrink:0;margin-top:.8rem';
    quoteBtn.onclick=function(){closeWsModalDirect();openInquiryModal(id);};
  }
  document.getElementById('ws-overlay').classList.add('open');
};
window.closeWsModal=function(e){if(e.target===document.getElementById('ws-overlay'))closeWsModalDirect();};
window.closeWsModalDirect=function(){document.getElementById('ws-overlay').classList.remove('open');};

// Updates the price display when a wholesale variant is selected
window.wsSelectVariant=function(btn){
  document.querySelectorAll('#ws-modal-variants .variant-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  var vp = btn.getAttribute('data-vprice');
  var priceEl = document.getElementById('ws-modal-price');
  if(priceEl && vp){
    priceEl.textContent = '₱'+parseFloat(vp).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
};
// Keyboard navigation for ws carousel
document.addEventListener('keydown',function(e){
  var ov=document.getElementById('ws-overlay');
  if(!ov||!ov.classList.contains('open')) return;
  if(e.key==='ArrowLeft') wsCarouselMove(-1);
  if(e.key==='ArrowRight') wsCarouselMove(1);
  if(e.key==='Escape') closeWsModalDirect();
});
// Initialize manual order form on load
document.addEventListener('DOMContentLoaded',function(){ if(typeof renderMoItems==='function') renderMoItems(); });
// Update shipping total when shipping input changes
document.addEventListener('input', function(e){
  if(e.target && e.target.id === 'mo-shipping') updateMoTotal();
});
