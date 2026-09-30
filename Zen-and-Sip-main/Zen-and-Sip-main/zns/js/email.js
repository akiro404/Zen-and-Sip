// ─── EMAIL CONFIG ─────────────────────────────────────────────────────────────
// Emails are sent via a Cloudflare Worker (email-worker.js) to avoid CORS.
// After deploying the Worker, paste its URL below.
var EMAIL_WORKER_URL = 'https://zensip-email.dimalanta-r21.workers.dev';
var OWNER_EMAIL      = 'zennsip.ph@gmail.com'; // order + inquiry alerts go here

// ─── RATE LIMITING (client-side guard against form spam) ─────────────────────
var _rl = { order: [], email: [] };
function _rateLimitOk(key, maxPerMin){
  var now = Date.now();
  _rl[key] = (_rl[key]||[]).filter(function(t){ return now-t < 60000; });
  if(_rl[key].length >= maxPerMin) return false;
  _rl[key].push(now);
  return true;
}

// ─── INPUT SANITISER ─────────────────────────────────────────────────────────
function _sanitise(str){
  return String(str)
    .replace(/[<>"'`]/g,'')           // strip HTML/JS special chars
    .replace(/javascript:/gi,'')       // block JS URI scheme
    .replace(/on\w+\s*=/gi,'')        // strip event handlers (onclick= etc)
    .replace(/\\x[0-9a-f]{2}/gi,'')  // strip hex escapes
    .trim()
    .slice(0,500);
}

// ─── AUTH GUARD ───────────────────────────────────────────────────────────────
// All admin writes are protected by Firebase Auth (request.auth != null in
// Firestore Security Rules). The old ADMIN_TOKEN has been removed — it was
// client-readable and provided no real security. Firestore rules are the gate.
function requireAuth(){
  if(!auth.currentUser) throw new Error('Not authenticated');
}

// ─── LOGIN RATE LIMITING (brute-force protection) ────────────────────────────
var _loginAttempts = [];
var _loginLocked = false;
var _loginLockUntil = 0;
var MAX_LOGIN_ATTEMPTS = 5;   // attempts allowed
var LOGIN_WINDOW_MS    = 300000; // within 5 minutes
var LOCKOUT_MS         = 900000; // lock for 15 minutes after too many failures

function loginRateLimitOk(){
  var now = Date.now();
  if(_loginLocked && now < _loginLockUntil){
    var mins = Math.ceil((_loginLockUntil - now) / 60000);
    return { ok: false, msg: 'Too many failed attempts. Try again in ' + mins + ' minute' + (mins===1?'':'s') + '.' };
  }
  if(_loginLocked && now >= _loginLockUntil){
    _loginLocked = false;
    _loginAttempts = [];
  }
  _loginAttempts = _loginAttempts.filter(function(t){ return now - t < LOGIN_WINDOW_MS; });
  return { ok: true };
}

function recordLoginFailure(){
  _loginAttempts.push(Date.now());
  if(_loginAttempts.length >= MAX_LOGIN_ATTEMPTS){
    _loginLocked = true;
    _loginLockUntil = Date.now() + LOCKOUT_MS;
  }
}

function recordLoginSuccess(){
  _loginAttempts = [];
  _loginLocked = false;
}

function resendReady(){ return EMAIL_WORKER_URL && !EMAIL_WORKER_URL.includes('YOUR_SUBDOMAIN'); }

// ─── PUSH NOTIFICATION (via Cloudflare Worker + OneSignal) ───────────────────
async function sendAdminPushNotification(title, body, url){
  if(!resendReady()) return;
  try{
    var res = await fetch(EMAIL_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type:'push', pushTitle:title, pushBody:body, pushUrl:url||'https://zennsip.com' })
    });
    var result = await res.json();
    console.log('[Push]', JSON.stringify(result));
  }catch(e){ console.warn('[Push] Failed:', e.message); }
}

async function sendOrderPushNotification(order){
  var total = Number(order.total||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  var ref   = order.ref || '';
  sendAdminPushNotification(
    '🛍️ New Order' + (ref ? ' #'+ref : ''),
    (order.customer||'Customer') + ' • ₱'+total,
    'https://zennsip.com/?dash=orders'
  );
}

// Core email send function — routes through Cloudflare Worker to avoid CORS
async function resendSend(to, subject, html, attachments){
  if(!resendReady()){ console.warn('Email worker URL not configured'); return; }
  if(!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){ console.warn('resendSend: invalid to address'); return; }
  var body = { to, subject, html };
  if(attachments && attachments.length) body.attachments = attachments;
  var res = await fetch(EMAIL_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  var data = await res.json();
  if(!res.ok){
    console.error('Email worker error:', res.status, data);
    throw new Error(data.error || 'HTTP '+res.status);
  }
  console.log('Email sent OK, id:', data.id);
  return data;
}

// Shared email wrapper — clean branded template
function emailWrap(body){
  var logoSrc = "https://zennsip.com/logo.jpg";
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zen &amp; Sip</title></head>'
    +'<body style="margin:0;padding:0;background:#f0ebe0;font-family:Georgia,\'Times New Roman\',serif">'
    +'<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ebe0;padding:32px 16px">'
    +'<tr><td align="center">'
    +'<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">'
    +'<tr><td style="background:#3a5438;padding:28px 32px;text-align:center">'
    +'<img src="'+logoSrc+'" alt="Zen &amp; Sip" style="width:56px;height:56px;object-fit:contain;display:block;margin:0 auto 10px">'
    +'<div style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#ffffff;letter-spacing:0.04em;line-height:1">Zen &amp; Sip</div>'
    +'<div style="font-family:Arial,sans-serif;font-size:10px;color:rgba(255,255,255,0.65);letter-spacing:0.15em;text-transform:uppercase;margin-top:6px">Premium Ceremonial Matcha</div>'
    +'</td></tr>'
    +'<tr><td style="padding:36px 36px 28px">'
    +'<div style="font-family:Georgia,serif;font-size:14px;color:#3d3d35;line-height:1.7">'
    +body
    +'</div>'
    +'</td></tr>'
    +'<tr><td style="padding:0 36px"><div style="height:1px;background:#f0ebe0"></div></td></tr>'
    +'<tr><td style="background:#faf7f2;padding:24px 32px;text-align:center">'
    +'<div style="margin-bottom:14px">'
    +'<a href="https://www.facebook.com/zennsip.ph" style="display:inline-block;background:#3a5438;color:#ffffff;text-decoration:none;padding:7px 18px;border-radius:20px;font-size:11px;letter-spacing:0.08em;font-family:Arial,sans-serif;margin:0 4px">Facebook</a>'
    +'<a href="https://www.instagram.com/zennsip.ph" style="display:inline-block;background:#3a5438;color:#ffffff;text-decoration:none;padding:7px 18px;border-radius:20px;font-size:11px;letter-spacing:0.08em;font-family:Arial,sans-serif;margin:0 4px">Instagram</a>'
    +'</div>'
    +'<div style="font-family:Arial,sans-serif;font-size:11px;color:#9a8f80;line-height:1.8">'
    +'<a href="https://zennsip.com" style="color:#3a5438;text-decoration:none;font-weight:600">zennsip.com</a>'
    +' &nbsp;·&nbsp; <a href="mailto:zennsip.ph@gmail.com" style="color:#9a8f80;text-decoration:none">zennsip.ph@gmail.com</a><br>'
    +'© '+new Date().getFullYear()+' Zen &amp; Sip · Philippines'
    +'</div>'
    +'</td></tr>'
    +'</table>'
    +'</td></tr>'
    +'</table>'
    +'</body></html>';
}

// ─── SEND OWNER ALERT (new order) ────────────────────────────────────────────
async function sendOwnerEmail(order){
  if(!resendReady()) return;
  var itemsList = (order.items||[]).map(function(i){
    return '<tr><td style="padding:6px 0;border-bottom:1px solid #f0ebe0">'+i.name+(i.variant?' <span style="color:#8a8070">('+i.variant+')</span>':'')+'</td>'
      +'<td style="padding:6px 0;border-bottom:1px solid #f0ebe0;text-align:center">×'+i.qty+'</td>'
      +'<td style="padding:6px 0;border-bottom:1px solid #f0ebe0;text-align:right">₱'+(i.price*i.qty).toLocaleString()+'</td></tr>';
  }).join('');
  var html = emailWrap(
    '<h2 style="font-size:18px;color:#2d3a2e;margin:0 0 4px">🛒 New Order: '+order.ref+'</h2>'
    +'<p style="font-size:13px;color:#8a8070;margin:0 0 20px">A new order just came in — verify payment proof in the dashboard.</p>'
    +'<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">'
    +'<tr style="background:#f5f0e8"><td style="padding:8px;font-weight:600">Customer</td><td colspan="2" style="padding:8px">'+order.customer+' · '+order.email+' · '+order.phone+'</td></tr>'
    +'<tr><td style="padding:8px;font-weight:600">Address</td><td colspan="2" style="padding:8px">'+order.address+'</td></tr>'
    +'</table>'
    +'<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">'+itemsList
    +'<tr><td colspan="2" style="padding:8px 0;font-weight:600;font-size:15px">Total</td>'
    +'<td style="padding:8px 0;font-weight:600;font-size:15px;text-align:right;color:#3d5a3e">₱'+Number(order.total).toLocaleString()+'</td></tr>'
    +'</table>'
    +'<p style="font-size:13px;color:#8a8070;margin:0">Payment via: <strong>'+(state.selectedPayMethod?state.selectedPayMethod.name:'E-Wallet')+'</strong> — check dashboard for proof.</p>'
  );
  await resendSend(OWNER_EMAIL, '🛒 New Order '+order.ref+' — Zen & Sip', html);
}

// ─── SEND CUSTOMER STATUS EMAIL ───────────────────────────────────────────────
async function sendCustomerEmail(order){
  if(!resendReady()) return;
  var itemsList = (order.items||[]).map(function(i){
    return i.name+(i.variant?' ('+i.variant+')':'')+' ×'+i.qty;
  }).join(', ');

  var isLalamove = (order.shippingMethod||order.courier||'').toLowerCase().includes('lalamove');
  var statusMsg = isLalamove
    ? ({
        'Pending':        'We\'ve received your order and are waiting to verify your payment.',
        'Processing':     '🎉 Great news! Your payment has been verified. Your order is now being prepared!',
        'Packed':         '📦 Your order has been packed! We will send you the Lalamove pickup details shortly.',
        'Request Pickup': '🛵 Your order is ready for pickup! Please check the separate email we sent for pickup address and instructions.',
        'Delivered':      '🍵 Your order has been delivered! We hope you enjoy your matcha. Thank you for choosing Zen & Sip!',
        'Cancelled':      '😔 Your order has been cancelled. If you have questions, please reach out to us.',
      }[order.status] || 'Your order status has been updated to: '+order.status)
    : ({
        'Pending':    'We\'ve received your order and are waiting to verify your payment.',
        'Processing': '🎉 Great news! Your payment has been verified. Your order is now being prepared!',
        'Packed':     '📦 Your order has been packed and is ready for pickup by the courier. We\'ll notify you once it\'s shipped!',
        'Shipped':    '🚚 Your order is on its way! Courier: '+(order.courier||'TBD')+'. Tracking: '+(order.tracking||'TBD')+'.',
        'Delivered':  '🍵 Your order has been delivered! We hope you enjoy your matcha. Thank you for choosing Zen & Sip!',
        'Cancelled':  '😔 Your order has been cancelled. If you have questions, please reach out to us.',
      }[order.status] || 'Your order status has been updated to: '+order.status);

  var statusEmoji = {'Pending':'⏳','Processing':'✅','Packed':'📦','Shipped':'🚚','Delivered':'🍵','Cancelled':'❌','Request Pickup':'🛵'}[order.status]||'📋';
  var trackUrl = 'https://zennsip.com';

  // Invoice: PDF as attachment, image inline
  var invoiceBlock = '';
  var attachments = [];
  if(order.invoiceFile){
    var isPdf = (order.invoiceFileType||'').includes('pdf');
    var fileName = order.invoiceFileName || (isPdf ? 'invoice.pdf' : 'invoice.jpg');
    if(isPdf){
      attachments.push({ filename: fileName, content: order.invoiceFile.replace(/^data:[^;]+;base64,/, '') });
      invoiceBlock = '<div style="margin-top:20px;padding:14px 16px;background:#f5f0e8;border-radius:8px;border-left:3px solid #3a5438;font-size:13px;color:#3d3d35">'
        +'<strong>📄 Invoice:</strong> <em>'+fileName+'</em><br>'
        +'<span style="color:#8a8070">Your invoice is attached as a PDF to this email.</span>'
        +'</div>';
    } else {
      invoiceBlock = '<div style="margin-top:20px">'
        +'<div style="font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8a8070;margin-bottom:8px">Invoice</div>'
        +'<img src="'+order.invoiceFile+'" alt="Invoice" style="max-width:100%;border-radius:8px;border:1px solid #e8e0d4;display:block">'
        +'</div>';
    }
  }
  var html = emailWrap(
    '<p style="font-size:14px;color:#3d3d35;margin:0 0 6px">Hi <strong>'+order.customer+'</strong>,</p>'
    +'<h2 style="font-size:20px;color:#2d3a2e;margin:0 0 8px">'+statusEmoji+' Order '+order.ref+'</h2>'
    +'<p style="font-size:14px;color:#5a5a50;line-height:1.6;margin:0 0 20px">'+statusMsg+'</p>'
    +'<div style="background:#f5f0e8;border-radius:8px;padding:16px;margin-bottom:20px;font-size:13px">'
    +'<div style="margin-bottom:6px"><span style="color:#8a8070">Items:</span> '+itemsList+'</div>'
    +(function(){
      var sf=Number(order.shipping||order.shippingFee||0);
      var courier=order.courier||order.shippingMethod||'';
      return (sf>0?'<div style="margin-bottom:4px"><span style="color:#8a8070">Shipping:</span> ₱'+sf.toLocaleString('en-PH',{minimumFractionDigits:2})+(courier?' via '+courier:'')+'</div>':'')
        +'<div><span style="color:#8a8070">Total:</span> <strong>₱'+Number(order.total).toLocaleString()+'</strong></div>'
        +(order.tracking?'<div style="margin-top:6px"><span style="color:#8a8070">Tracking:</span> <strong>'+(courier?courier+' — ':'')+order.tracking+'</strong></div>':'')
        +(!order.tracking&&courier?'<div style="margin-top:4px"><span style="color:#8a8070">Courier:</span> '+courier+'</div>':'');
    })()
    +'</div>'
    +invoiceBlock
    +'<div style="text-align:center;margin-top:20px">'
    +'<a href="'+trackUrl+'" style="display:inline-block;background:#3a5438;color:#fff;text-decoration:none;padding:13px 32px;border-radius:6px;font-size:13px;letter-spacing:.06em;font-weight:600;font-family:Arial,sans-serif">Track Your Order →</a>'
    +'</div>'
  );
  await resendSend(order.email, statusEmoji+' Your Zen & Sip Order — '+order.ref, html, attachments);
}

// ─── SEND LALAMOVE ORDER CONFIRMATION (no shipping fee) ──────────────────────
async function sendLalamoveOrderEmail(order){
  if(!resendReady()) return;
  var itemsList = (order.items||[]).map(function(i){
    return '<tr><td style="padding:6px 0;border-bottom:1px solid #f0ebe0">'+i.name+(i.variant?' <span style="color:#8a8070">('+i.variant+')</span>':'')+'</td>'
      +'<td style="padding:6px 0;border-bottom:1px solid #f0ebe0;text-align:center">×'+i.qty+'</td>'
      +'<td style="padding:6px 0;border-bottom:1px solid #f0ebe0;text-align:right">₱'+(i.price*i.qty).toLocaleString()+'</td></tr>';
  }).join('');
  var subtotal = (order.items||[]).reduce(function(s,i){ return s+(i.price*i.qty); },0);
  var discount = order.discount
    ? (order.discount.type==='percent' ? Math.round(subtotal*order.discount.value/100) : order.discount.value)
    : 0;
  var productTotal = subtotal - Math.min(discount, subtotal);
  var html = emailWrap(
    '<p style="font-size:14px;color:#3d3d35;margin:0 0 6px">Hi <strong>'+order.customer+'</strong>,</p>'
    +'<h2 style="font-size:20px;color:#2d3a2e;margin:0 0 8px">✅ Order Confirmed — '+order.ref+'</h2>'
    +'<p style="font-size:14px;color:#5a5a50;line-height:1.6;margin:0 0 20px">Thank you for your order! Your payment has been received. We are preparing your items.</p>'
    +'<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">'+itemsList
    +(discount?'<tr><td colspan="2" style="padding:6px 0;color:#16a34a">Discount ('+order.discount.code+')</td><td style="padding:6px 0;text-align:right;color:#16a34a">-₱'+discount.toLocaleString()+'</td></tr>':'')
    +'<tr><td colspan="2" style="padding:8px 0;font-weight:600;font-size:15px">Product Total</td>'
    +'<td style="padding:8px 0;font-weight:600;font-size:15px;text-align:right;color:#3d5a3e">₱'+productTotal.toLocaleString()+'</td></tr>'
    +'</table>'
    +'<div style="background:#fef9ec;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#92400e;line-height:1.6">'
    +'<strong>🛵 Lalamove Delivery</strong><br>'
    +'You\'ve selected <strong>Lalamove</strong> as your delivery method. You will book and pay the rider fee directly through the Lalamove app.<br><br>'
    +'<strong>📦 Pickup details</strong> (pickup address, contact, and instructions) will be sent to you in a separate email once your order is packed and ready.'
    +'</div>'
    +'<p style="font-size:13px;color:#8a8070;margin:0">If you have any questions, reply to this email or message us on Facebook/Instagram.</p>'
  );
  await resendSend(order.email, '✅ Order Confirmed — Zen & Sip '+order.ref, html);
}

// ─── SEND LALAMOVE PICKUP DETAILS EMAIL ───────────────────────────────────────
// PICKUP_ADDRESS is kept private — only sent when order status = Request Pickup
var LALAMOVE_PICKUP = {
  address:  'Lot 9 Ritzwood Lane Westdrive, Corner N Ipil, Marikina',
  mapsUrl:  'https://www.google.com/maps?q=Mamala%27s+Home,+Lot+9+Ritzwood+Lane+Westdrive,+Corner+N+Ipil,+Marikina,+Philippines&ftid=0x3397b90014687645:0xd95a87f370d967f6&entry=gps&shh=CAE&lucs=,94297699,100794548,94231188,94280568,47071704,100809208,94218641,94282134,100799877,94286869&g_ep=CAISEjI2LjIwLjQuOTEzODcwMjQ0MBgAIPCqBypdLDk0Mjk3Njk5LDEwMDc5NDU0OCw5NDIzMTE4OCw5NDI4MDU2OCw0NzA3MTcwNCwxMDA4MDkyMDgsOTQyMTg2NDEsOTQyODIxMzQsMTAwNzk5ODc3LDk0Mjg2ODY5QgJKUA%3D%3D&skid=f6b7733a-6780-4807-9217-97487530f204&g_st=ic',
  contact:  'Zen & Sip',
  phone:    '09918092032',
  note:     'Please contact us first through Facebook/Instagram before booking Lalamove. We will confirm the exact pickup window at that time.'
};

async function sendPickupEmail(order){
  if(!resendReady()) return;
  var html = emailWrap(
    '<p style="font-size:14px;color:#3d3d35;margin:0 0 6px">Hi <strong>'+order.customer+'</strong>,</p>'
    +'<h2 style="font-size:20px;color:#2d3a2e;margin:0 0 8px">📦 Your Order is Ready for Pickup!</h2>'
    +'<p style="font-size:14px;color:#5a5a50;line-height:1.6;margin:0 0 20px">Great news! Your order <strong>'+order.ref+'</strong> is packed and ready. Here are the pickup details for your Lalamove booking:</p>'
    +'<div style="background:#f5f0e8;border-radius:10px;padding:20px;margin-bottom:20px;font-size:13px">'
    +'<div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8a8070;margin-bottom:12px">Pickup Details</div>'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<tr><td style="padding:6px 0;font-weight:600;width:120px;color:#3d3d35">Address</td><td style="padding:6px 0;color:#5a5a50">'+LALAMOVE_PICKUP.address+'</td></tr>'
    +'<tr><td style="padding:6px 0;font-weight:600;color:#3d3d35">Contact</td><td style="padding:6px 0;color:#5a5a50">'+LALAMOVE_PICKUP.contact+'</td></tr>'
    +'<tr><td style="padding:6px 0;font-weight:600;color:#3d3d35">Phone</td><td style="padding:6px 0;color:#5a5a50">'+LALAMOVE_PICKUP.phone+'</td></tr>'
    +'</table>'
    +'<a href="'+LALAMOVE_PICKUP.mapsUrl+'" target="_blank" style="display:inline-block;margin-top:14px;background:#3a5438;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:600">📍 View on Google Maps</a>'
    +'</div>'
    +'<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#92400e;line-height:1.6">'
    +'⚠️ <strong>Important:</strong> '+LALAMOVE_PICKUP.note
    +'</div>'
    +'<p style="font-size:13px;color:#8a8070;margin:0">Thank you for choosing Zen &amp; Sip! 🍵</p>'
  );
  await resendSend(order.email, '📦 Your Order is Ready for Pickup — Zen & Sip', html);
}

// ─── SEND OWNER INQUIRY ALERT ─────────────────────────────────────────────────
async function sendInquiryEmail(inq){
  if(!resendReady()) return;
  try{
    var html = emailWrap(
      '<h2 style="font-size:18px;color:#2d3a2e;margin:0 0 4px">📋 New Wholesale Inquiry</h2>'
      +'<p style="font-size:13px;color:#8a8070;margin:0 0 20px">A new wholesale application was submitted — review it in your admin dashboard.</p>'
      +'<table style="width:100%;border-collapse:collapse;font-size:13px">'
      +'<tr style="background:#f5f0e8"><td style="padding:8px;font-weight:600;width:35%">Name</td><td style="padding:8px">'+inq.name+'</td></tr>'
      +(inq.business?'<tr><td style="padding:8px;font-weight:600">Business</td><td style="padding:8px">'+inq.business+'</td></tr>':'')
      +'<tr style="background:#f5f0e8"><td style="padding:8px;font-weight:600">Email</td><td style="padding:8px">'+inq.email+'</td></tr>'
      +'<tr><td style="padding:8px;font-weight:600">Phone</td><td style="padding:8px">'+inq.phone+'</td></tr>'
      +(inq.address?'<tr style="background:#f5f0e8"><td style="padding:8px;font-weight:600">Address</td><td style="padding:8px">'+inq.address+'</td></tr>':'')
      +(inq.comment?'<tr><td style="padding:8px;font-weight:600">Comment</td><td style="padding:8px">'+inq.comment+'</td></tr>':'')
      +'</table>'
    );
    await resendSend(OWNER_EMAIL, '📋 New Wholesale Inquiry — '+inq.name, html);
  }catch(e){ console.warn('Inquiry email failed:', e.message); }
}

// ─── SEND CUSTOMER WHOLESALE STATUS EMAIL ────────────────────────────────────
async function sendWholesaleStatusEmail(inq, msgObj, val){
  if(!resendReady()) return;
  var catalogueBtn = msgObj.catalogueUrl
    ? '<div style="text-align:center;margin-top:20px"><a href="'+msgObj.catalogueUrl+'" style="display:inline-block;background:#3d5a3e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:13px;letter-spacing:.06em;font-weight:600">View Wholesale Catalogue →</a></div>'
    : '';
  var reasonBlock = msgObj.reasonBox
    ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px">'
      +'<tr><td style="background:#fdf6ec;border:1px solid #e8d9c0;border-radius:6px;padding:14px 16px">'
      +'<p style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px">Reason</p>'
      +'<p style="font-size:14px;color:#3d3d35;line-height:1.6;margin:0">'+msgObj.reasonBox+'</p>'
      +'</td></tr></table>'
    : '';
  var html = emailWrap(
    '<p style="font-size:14px;color:#3d3d35;margin:0 0 6px">Hi <strong>'+inq.name+'</strong>,</p>'
    +'<h2 style="font-size:20px;color:#2d3a2e;margin:0 0 16px">'+msgObj.title+'</h2>'
    +'<p style="font-size:14px;color:#5a5a50;line-height:1.6;margin:0 0 16px">'+msgObj.body+'</p>'
    +reasonBlock
    +catalogueBtn
  );
  await resendSend(inq.email, msgObj.title+' — Zen & Sip Wholesale', html);
}

// ─── NOTIFY OWNER: PAYMENT PROOF RECEIVED ────────────────────────────────────
async function notifyOwnerProofReceived(ref){
  if(!resendReady()) return;
  var label = ref ? 'Order '+ref : 'a manual order';
  sendAdminPushNotification(
    '💳 Payment Proof Received',
    label+' — customer uploaded their screenshot',
    'https://zennsip.com/?dash=orders'
  );
  try{
    var html = emailWrap(
      '<h2 style="font-size:18px;color:#2d3a2e;margin:0 0 4px">💳 Payment Proof Received</h2>'
      +'<p style="font-size:13px;color:#8a8070;margin:0 0 20px">A customer has uploaded their payment screenshot for <strong>'+ref+'</strong>. Please verify in your dashboard.</p>'
      +'<div style="text-align:center;margin-top:16px">'
      +'<a href="https://zennsip.com/?dash=orders" style="display:inline-block;background:#3a5438;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:13px;font-weight:600">View Dashboard →</a>'
      +'</div>'
    );
    await resendSend(OWNER_EMAIL, '💳 Payment Proof — '+ref+' — Zen & Sip', html);
  }catch(e){ console.warn('Proof notification email failed:', e.message); }
}

// ─── EXPOSE TO WINDOW (called from checkout-orders.js and other modules) ─────
window.sendOwnerEmail          = sendOwnerEmail;
window.sendCustomerEmail       = sendCustomerEmail;
window.sendLalamoveOrderEmail  = sendLalamoveOrderEmail;
window.sendPickupEmail         = sendPickupEmail;
window.sendInquiryEmail        = sendInquiryEmail;
window.sendWholesaleStatusEmail    = sendWholesaleStatusEmail;
window.notifyOwnerProofReceived    = notifyOwnerProofReceived;