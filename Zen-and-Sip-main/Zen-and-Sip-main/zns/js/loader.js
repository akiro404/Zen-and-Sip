import "./firebase.js";

// Read version from meta tag — update this in index.html on each deploy
const VERSION = document.querySelector('meta[name="app-version"]')?.content || '1';

const base = (() => {
  const el = document.querySelector('script[src*="loader.js"]');
  return el ? el.src.replace(/loader\.js[^?]*.*$/, '') : '/js/';
})();

const modules = [
  "state.js",
  "email.js",
  "listeners.js",
  "products.js",
  "promos-discounts.js",
  "checkout-orders.js",
  "cart.js",
  "admin.js",
  "wholesale.js",
  "reviews.js",
  "carousel.js",
];

// async=false: browser fetches all in parallel but executes in insertion order
const promises = modules.map(src => new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.async = false;
  s.src = base + src + '?v=' + VERSION;
  s.onload = resolve;
  s.onerror = () => reject(new Error('Failed to load: ' + src));
  document.head.appendChild(s);
}));

Promise.all(promises)
  .then(() => console.log('Zen & Sip: all modules loaded ✓'))
  .catch(e => console.error('Zen & Sip loader error:', e));
