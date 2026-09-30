// ─── reviews.js — Product reviews & ratings (Firestore + admin moderation)

// ─── STATE ────────────────────────────────────────────────────────────────────
var _reviewStar       = 0;       // currently selected star in form
var _reviewProductId  = null;    // product being reviewed
var _adminReviewFilter = 'pending';

// ─── STAR HELPERS ─────────────────────────────────────────────────────────────
function starsHtml(rating, size){
  size = size || 14;
  var full  = Math.round(rating || 0);
  var html  = '<span class="stars-display" style="font-size:'+size+'px">';
  for(var i = 1; i <= 5; i++){
    html += '<span style="color:'+(i <= full ? '#f59e0b' : '#d1d5db')+'">★</span>';
  }
  html += '</span>';
  return html;
}

function ratingLabel(avg, count){
  if(!count) return '';
  return starsHtml(avg) + ' <span class="rating-label">'+avg.toFixed(1)+' ('+count+' review'+(count===1?'':'s')+')</span>';
}

// ─── LOAD REVIEWS FOR PRODUCT ────────────────────────────────────────────────
window.loadProductReviews = async function(productId){
  _reviewProductId = productId;
  _reviewStar = 0;

  var listEl    = document.getElementById('reviews-list');
  var loadingEl = document.getElementById('reviews-loading');
  var summaryEl = document.getElementById('modal-rating-summary');
  if(!listEl) return;

  if(loadingEl) loadingEl.style.display = 'block';
  listEl.innerHTML = '';

  try{
    var snap = await getDocs(
query(collection(db,'reviews'),
        where('productId','==', productId),
        where('approved','==', true)
      )
    );
    var reviews = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
    // Sort by date client-side (avoids composite index requirement)
    reviews.sort(function(a,b){ var ta=a.createdAt?(a.createdAt.seconds||0):0; var tb=b.createdAt?(b.createdAt.seconds||0):0; return tb-ta; });

    // Rating summary
    if(summaryEl){
      if(reviews.length){
        var avg = reviews.reduce(function(s,r){ return s + (r.rating||0); }, 0) / reviews.length;
        summaryEl.innerHTML = ratingLabel(avg, reviews.length);
      } else {
        summaryEl.innerHTML = '<span class="no-reviews-yet">No reviews yet — be the first!</span>';
      }
    }

    if(loadingEl) loadingEl.style.display = 'none';
    if(!reviews.length){
      listEl.innerHTML = '<div class="reviews-empty">No reviews yet.</div>';
      return;
    }
    listEl.innerHTML = reviews.map(function(r){
      var date = r.createdAt ? new Date(r.createdAt.seconds ? r.createdAt.seconds*1000 : r.createdAt).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '';
      return '<div class="review-card">'
        +'<div class="review-card-header">'
          +'<div class="review-card-meta">'
            +'<span class="review-author">'+_sanitise(r.name||'Anonymous')+'</span>'
            +(r.verified ? '<span class="review-verified">✓ Verified Purchase</span>' : '')
          +'</div>'
          +'<span class="review-date">'+date+'</span>'
        +'</div>'
        +'<div class="review-stars">'+starsHtml(r.rating, 13)+'</div>'
        +(r.body ? '<p class="review-body">'+_sanitise(r.body)+'</p>' : '')
        +'</div>';
    }).join('');
  } catch(e){
    if(loadingEl) loadingEl.style.display = 'none';
    listEl.innerHTML = '<div class="reviews-empty">Could not load reviews.</div>';
    console.warn('loadProductReviews error:', e.message);
  }
};

// ─── REVIEW FORM ─────────────────────────────────────────────────────────────
window.openReviewForm = function(){
  var form = document.getElementById('review-form');
  var btn  = document.getElementById('write-review-btn');
  if(form){ form.style.display = 'block'; }
  if(btn)  { btn.style.display = 'none'; }
  // Reset
  _reviewStar = 0;
  updateStarPicker(0);
  var nameEl = document.getElementById('review-name');
  var bodyEl = document.getElementById('review-body');
  var refEl  = document.getElementById('review-order-ref');
  if(nameEl) nameEl.value = '';
  if(bodyEl) bodyEl.value = '';
  if(refEl)  refEl.value  = '';
};

window.closeReviewForm = function(){
  var form = document.getElementById('review-form');
  var btn  = document.getElementById('write-review-btn');
  if(form){ form.style.display = 'none'; }
  if(btn)  { btn.style.display = 'inline-flex'; }
};

window.setReviewStar = function(val){
  _reviewStar = val;
  updateStarPicker(val);
};

function updateStarPicker(val){
  document.querySelectorAll('.star-pick').forEach(function(btn){
    var v = parseInt(btn.getAttribute('data-v'));
    btn.style.color = v <= val ? '#f59e0b' : '#d1d5db';
    btn.style.transform = v <= val ? 'scale(1.15)' : 'scale(1)';
  });
}

window.submitReview = async function(){
  if(!_reviewProductId){ toast('No product selected.'); return; }
  if(!_reviewStar){ toast('Please select a star rating.'); return; }

  var nameEl = document.getElementById('review-name');
  var bodyEl = document.getElementById('review-body');
  var refEl  = document.getElementById('review-order-ref');
  var name   = (nameEl ? nameEl.value : '').trim();
  var body   = (bodyEl ? bodyEl.value : '').trim();
  var ref    = (refEl  ? refEl.value  : '').trim();

  if(!name){ toast('Please enter your name.'); if(nameEl) nameEl.focus(); return; }

  // Check if order ref is valid (optional but marks as verified)
  var verified = false;
  if(ref){
    var matchOrder = state.orders.find(function(o){
      return (o.ref||'').toLowerCase() === ref.toLowerCase() && o.status !== 'Cancelled';
    });
    if(!matchOrder){
      toast('Order reference not found. You can still submit without it.');
    } else {
      verified = true;
    }
  }

  var submitBtn = document.querySelector('.review-submit-btn');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

  try{
    await addDoc(collection(db,'reviews'), {
      productId:  _reviewProductId,
      name:       _sanitise(name),
      rating:     _reviewStar,
      body:       _sanitise(body),
      orderRef:   ref || null,
      verified:   verified,
      approved:   false,   // requires admin approval
      createdAt:  serverTimestamp(),
    });
    closeReviewForm();
    toast('Review submitted! It will appear after approval. 🍵');
    // Reload summary to reflect pending count
    var listEl = document.getElementById('reviews-list');
    if(listEl && !listEl.innerHTML.includes('review-card')){
      listEl.innerHTML = '<div class="reviews-empty">No approved reviews yet.</div>';
    }
  } catch(e){
    toast('Could not submit review: '+e.message);
    console.warn('submitReview error:', e);
  } finally {
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Submit Review'; }
  }
};

// ─── ADMIN REVIEWS DASHBOARD ──────────────────────────────────────────────────
window.setReviewAdminFilter = function(filter, btn){
  _adminReviewFilter = filter;
  document.querySelectorAll('#dash-reviews .filter-chip').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  renderAdminReviews();
};

window.renderAdminReviews = async function(){
  var el = document.getElementById('admin-reviews-list');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:.5rem 0">Loading…</div>';

  try{
    var snap = await getDocs(query(collection(db,'reviews')));
    var all  = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });

    var filtered = all.filter(function(r){
      if(_adminReviewFilter === 'pending')  return !r.approved;
      if(_adminReviewFilter === 'approved') return  r.approved;
      return true;
    });

    if(!filtered.length){
      el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:1rem 0;text-align:center">No reviews in this category.</div>';
      return;
    }

    el.innerHTML = filtered.map(function(r){
      var product = state.products.find(function(p){ return p.id === r.productId; });
      var pName   = product ? product.name : r.productId;
      var date    = r.createdAt ? new Date(r.createdAt.seconds ? r.createdAt.seconds*1000 : r.createdAt).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—';
      return '<div class="admin-review-card" id="ar-'+r.id+'">'
        +'<div class="admin-review-header">'
          +'<div>'
            +'<div class="admin-review-product">'+pName+'</div>'
            +'<div class="admin-review-meta">'
              +starsHtml(r.rating, 12)
              +' <strong>'+_sanitise(r.name||'Anonymous')+'</strong>'
              +(r.verified ? ' <span class="review-verified">✓ Verified</span>' : '')
              +' · '+date
            +'</div>'
          +'</div>'
          +'<div class="admin-review-status">'
            +(r.approved
              ? '<span class="badge badge-processing">Approved</span>'
              : '<span class="badge badge-pending">Pending</span>')
          +'</div>'
        +'</div>'
        +(r.body ? '<p class="admin-review-body">'+_sanitise(r.body)+'</p>' : '<p class="admin-review-body" style="color:var(--text-muted);font-style:italic">No written review.</p>')
        +'<div class="admin-review-actions">'
          +(!r.approved ? '<button class="btn-secondary" style="padding:6px 14px;font-size:12px" onclick="approveReview(\''+r.id+'\')">✓ Approve</button>' : '')
          +(r.approved  ? '<button class="btn-archive"   onclick="unapproveReview(\''+r.id+'\')">Unpublish</button>' : '')
          +'<button class="btn-archive" style="border-color:#e24b4a;color:#e24b4a" onclick="deleteReview(\''+r.id+'\')">Delete</button>'
        +'</div>'
        +'</div>';
    }).join('');
  } catch(e){
    el.innerHTML = '<div style="color:#e24b4a;font-size:13px">Could not load reviews: '+e.message+'</div>';
  }
};

window.approveReview = async function(id){
  try{
    await updateDoc(doc(db,'reviews',id), { approved: true });
    toast('Review approved ✓');
    renderAdminReviews();
  } catch(e){ toast('Error: '+e.message); }
};

window.unapproveReview = async function(id){
  try{
    await updateDoc(doc(db,'reviews',id), { approved: false });
    toast('Review unpublished');
    renderAdminReviews();
  } catch(e){ toast('Error: '+e.message); }
};

window.deleteReview = async function(id){
  if(!confirm('Delete this review? This cannot be undone.')) return;
  try{
    await deleteDoc(doc(db,'reviews',id));
    toast('Review deleted');
    renderAdminReviews();
  } catch(e){ toast('Error: '+e.message); }
};
