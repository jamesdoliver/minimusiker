// ============================================================
// Grundschul-Abschieds-Box · app.js
// ============================================================

// ----- Shopify config (placeholder — fill in later) -----
const SHOPIFY_CONFIG = {
  domain: 'IHR-SHOP.myshopify.com',            // TODO: deine Shopify-Domain
  storefrontAccessToken: '',                    // TODO: Storefront API Token
  variants: {
    box: 'gid://shopify/ProductVariant/0',           // TODO: Variant-ID der Box
    upsellLieder: 'gid://shopify/ProductVariant/0',  // TODO: Variant-ID des Upsells
  },
};

const PRICES = {
  box: 44.99,
  upsell: 0,
};

const VAT_RATE = 0.19;

const state = {
  qty: 1,
  upsellActive: false,
  paymentMethod: 'card',
};

// ----- Helpers -----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const formatPrice = (value) =>
  value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// ----- Totals -----
function updateTotals() {
  const subtotal = PRICES.box * state.qty + (state.upsellActive ? PRICES.upsell : 0);
  const vatIncluded = (subtotal * VAT_RATE) / (1 + VAT_RATE);

  $('#subtotal').textContent = formatPrice(subtotal);
  $('#vat').textContent = formatPrice(vatIncluded);
  $('#total').textContent = formatPrice(subtotal);
  $('#submit-total').textContent = formatPrice(subtotal);
  $('#qty-display').textContent = state.qty;
  $('#qty-value').textContent = state.qty;
  $('#base-price-display').textContent = formatPrice(PRICES.box * state.qty);
}

// ----- Quantity -----
function initQty() {
  const minus = $('#qty-minus');
  const plus = $('#qty-plus');
  const sync = () => {
    minus.disabled = state.qty <= 1;
    plus.disabled = state.qty >= 10;
  };
  plus.addEventListener('click', () => {
    if (state.qty < 10) { state.qty++; updateTotals(); sync(); }
  });
  minus.addEventListener('click', () => {
    if (state.qty > 1) { state.qty--; updateTotals(); sync(); }
  });
  sync();
}

// ----- Combobox -----
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const safeText = escapeHtml(text);
  const safeQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safeText.replace(new RegExp(safeQuery, 'gi'), (m) => `<mark>${m}</mark>`);
}

function createCombobox({ input, hiddenInput, listbox, items, toLabel, getId, onSelect, onClear }) {
  let filtered = [];
  let activeIndex = -1;
  const idPrefix = listbox.id + '-opt-';

  const render = (query) => {
    const q = query.trim().toLowerCase();
    filtered = q
      ? items.filter((it) => toLabel(it).toLowerCase().includes(q))
      : items.slice();

    if (!filtered.length) {
      listbox.innerHTML = '<li class="combobox-empty" role="presentation">Keine Schule gefunden</li>';
    } else {
      listbox.innerHTML = filtered
        .map((it, i) =>
          `<li id="${idPrefix}${i}" role="option" aria-selected="false" data-id="${escapeHtml(String(getId(it)))}">${highlightMatch(toLabel(it), q)}</li>`
        )
        .join('');
    }
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
  };

  const originalParent = listbox.parentElement;

  const positionListbox = () => {
    const r = input.getBoundingClientRect();
    listbox.style.position = 'fixed';
    listbox.style.top = r.bottom + 'px';
    listbox.style.left = r.left + 'px';
    listbox.style.width = r.width + 'px';
    listbox.style.right = 'auto';
  };

  const open = () => {
    if (!listbox.hidden) return;
    if (listbox.parentElement !== document.body) {
      document.body.appendChild(listbox);
    }
    positionListbox();
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    window.addEventListener('scroll', positionListbox, true);
    window.addEventListener('resize', positionListbox);
  };
  const close = () => {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    window.removeEventListener('scroll', positionListbox, true);
    window.removeEventListener('resize', positionListbox);
    if (listbox.parentElement === document.body) {
      originalParent.appendChild(listbox);
      listbox.style.position = '';
      listbox.style.top = '';
      listbox.style.left = '';
      listbox.style.width = '';
      listbox.style.right = '';
    }
  };

  const highlight = (i) => {
    const opts = listbox.querySelectorAll('li[role="option"]');
    opts.forEach((el) => el.setAttribute('aria-selected', 'false'));
    if (i < 0 || i >= opts.length) {
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      return;
    }
    opts[i].setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', opts[i].id);
    opts[i].scrollIntoView({ block: 'nearest' });
    activeIndex = i;
  };

  const select = (item) => {
    input.value = toLabel(item);
    hiddenInput.value = String(getId(item));
    close();
    if (onSelect) onSelect(item);
  };

  const clear = () => {
    input.value = '';
    hiddenInput.value = '';
    if (onClear) onClear();
  };

  input.addEventListener('focus', () => { render(input.value); open(); });
  input.addEventListener('input', () => {
    hiddenInput.value = '';
    render(input.value);
    open();
  });
  input.addEventListener('keydown', (e) => {
    const opts = listbox.querySelectorAll('li[role="option"]');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (listbox.hidden) { render(input.value); open(); }
      highlight(Math.min(opts.length - 1, activeIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(Math.max(0, activeIndex - 1));
    } else if (e.key === 'Enter') {
      if (!listbox.hidden && activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault();
        select(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Home' && !listbox.hidden) {
      e.preventDefault();
      highlight(0);
    } else if (e.key === 'End' && !listbox.hidden) {
      e.preventDefault();
      highlight(opts.length - 1);
    }
  });
  listbox.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[role="option"]');
    if (!li) return;
    e.preventDefault(); // don't blur input
    const id = li.dataset.id;
    const item = items.find((it) => String(getId(it)) === id);
    if (item) select(item);
  });
  input.addEventListener('blur', () => setTimeout(close, 150));

  return { clear, close };
}

// ----- Upsell -----
let schoolCombobox = null;

function initUpsell() {
  const wrap = $('#upsell-toggle');
  const cb = $('#upsell-checkbox');
  const schoolInput = $('#upsell-school');
  const schoolIdInput = $('#upsell-school-id');
  const schoolList = $('#upsell-school-list');
  const clearBtn = wrap.querySelector('.combobox-clear');

  if (schoolInput && schoolIdInput && schoolList && typeof SCHOOLS !== 'undefined') {
    schoolCombobox = createCombobox({
      input: schoolInput,
      hiddenInput: schoolIdInput,
      listbox: schoolList,
      items: SCHOOLS,
      toLabel: (s) => `${s.n} — ${s.c}`,
      getId: (s) => `${s.k}-${s.e}`,
      onSelect: () => {
        clearFieldError(schoolInput);
        if (clearBtn) clearBtn.hidden = false;
      },
      onClear: () => {
        if (clearBtn) clearBtn.hidden = true;
      },
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        schoolCombobox.clear();
        clearBtn.hidden = true;
        schoolInput.focus();
      });
    }
  }

  const apply = () => {
    state.upsellActive = cb.checked;
    wrap.classList.toggle('active', state.upsellActive);
    if (!state.upsellActive && schoolInput) clearFieldError(schoolInput);
    updateTotals();
  };
  cb.addEventListener('change', apply);
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('input, label, select, option, button, .combobox-listbox')) return;
    cb.checked = !cb.checked;
    apply();
  });
}

// ----- Payment radios -----
function initPayment() {
  $$('.payment-method').forEach((label) => {
    const input = label.querySelector('input[type="radio"]');
    label.addEventListener('click', () => {
      $$('.payment-method').forEach((m) => m.classList.remove('active'));
      label.classList.add('active');
      state.paymentMethod = input.value;
      input.checked = true;
    });
  });
}

// ----- Form validation -----
function setFieldError(input, message) {
  input.setAttribute('aria-invalid', 'true');
  let err = input.parentElement.querySelector('.field-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error';
    err.setAttribute('role', 'alert');
    input.parentElement.appendChild(err);
  }
  err.textContent = message;
}

function clearFieldError(input) {
  input.removeAttribute('aria-invalid');
  const err = input.parentElement.querySelector('.field-error');
  if (err) err.remove();
}

function validateForm(form) {
  let firstInvalid = null;
  const required = form.querySelectorAll('input[required]');
  required.forEach((input) => {
    clearFieldError(input);
    const value = input.value.trim();
    if (!value) {
      setFieldError(input, 'Bitte ausfüllen');
      if (!firstInvalid) firstInvalid = input;
      return;
    }
    if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError(input, 'Gültige E-Mail-Adresse angeben');
      if (!firstInvalid) firstInvalid = input;
      return;
    }
    if (input.id === 'zip' && !/^\d{4,5}$/.test(value)) {
      setFieldError(input, 'PLZ prüfen');
      if (!firstInvalid) firstInvalid = input;
    }
  });
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

function initFormValidation() {
  $$('#checkout-form input').forEach((input) => {
    input.addEventListener('input', () => clearFieldError(input));
  });
}

// ----- Checkout submit -----
function initCheckout() {
  const form = $('#checkout-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    // Upsell requires a school selection from the combobox
    const schoolInput = $('#upsell-school');
    const schoolIdInput = $('#upsell-school-id');
    if (state.upsellActive && !schoolIdInput.value) {
      setFieldError(schoolInput, 'Bitte eine Schule aus der Liste auswählen');
      schoolInput.focus();
      return;
    }

    const orderData = {
      email: $('#email').value,
      shipping: {
        firstName: $('#firstname').value,
        lastName: $('#lastname').value,
        address1: $('#street').value,
        zip: $('#zip').value,
        city: $('#city').value,
        country: $('#country').value,
      },
      lineItems: [
        { variantId: SHOPIFY_CONFIG.variants.box, quantity: state.qty },
      ],
      paymentMethod: state.paymentMethod,
    };

    if (state.upsellActive) {
      const [kundenId, eventId] = schoolIdInput.value.split('-');
      orderData.lineItems.push({
        variantId: SHOPIFY_CONFIG.variants.upsellLieder,
        quantity: 1,
        customAttributes: [
          { key: 'Schule', value: schoolInput.value.trim() },
          { key: 'KundenID', value: kundenId },
          { key: 'EventID', value: eventId },
        ],
      });
    }

    console.log('Bereit für Shopify Checkout:', orderData);

    // ============================================================
    // Shopify integration goes here. Three common patterns:
    //
    //  A) Storefront API (cartCreate)
    //     POST https://${domain}/api/2024-10/graphql.json
    //     with X-Shopify-Storefront-Access-Token header.
    //     → Get cart.checkoutUrl → window.location = checkoutUrl
    //
    //  B) Buy Button SDK
    //     <script src="https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js"></script>
    //     ShopifyBuy.UI.onReady(...).then(ui => ui.createComponent(...))
    //
    //  C) Permalink redirect (simplest)
    //     window.location = `https://${domain}/cart/${variantId}:${qty}?attributes...`
    // ============================================================

    alert(
      'Checkout vorbereitet!\n\nSobald die Shopify-Anbindung eingerichtet ist, geht es hier direkt zur Zahlung weiter.\n\n' +
        'Bestellung:\n' +
        JSON.stringify(orderData, null, 2)
    );
  });
}

// ----- Audio player (one at a time) -----
function initAudioPlayer() {
  let current = null; // { audio, button }

  const stop = () => {
    if (!current) return;
    current.audio.pause();
    current.audio.currentTime = 0;
    current.button.classList.remove('playing');
    current.button.setAttribute('aria-pressed', 'false');
    current = null;
  };

  $$('.song-item').forEach((item) => {
    const src = item.dataset.src;
    const button = item.querySelector('.song-play');
    if (!src || !button) return;

    const audio = new Audio();
    audio.preload = 'none';
    audio.src = src;
    audio.addEventListener('ended', () => {
      button.classList.remove('playing');
      button.setAttribute('aria-pressed', 'false');
      current = null;
    });

    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const isCurrent = current && current.button === button;
      stop();
      if (!isCurrent) {
        audio.play().then(
          () => {
            button.classList.add('playing');
            button.setAttribute('aria-pressed', 'true');
            current = { audio, button };
          },
          (err) => console.warn('Audio-Wiedergabe fehlgeschlagen:', err)
        );
      }
    });
  });
}

// ----- Reveal on scroll -----
function initReveal() {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal').forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  $$('.reveal').forEach((el) => io.observe(el));
}

// ----- Mobile sticky CTA -----
function initMobileCta() {
  const cta = $('#mobile-cta');
  const checkout = $('#checkout');
  if (!cta || !checkout) return;

  let checkoutVisible = false;

  const update = () => {
    const shouldShow = !checkoutVisible && window.scrollY > 400;
    cta.classList.toggle('visible', shouldShow);
    cta.setAttribute('aria-hidden', String(!shouldShow));
  };

  const io = new IntersectionObserver(
    (entries) => {
      checkoutVisible = entries[0].isIntersecting;
      update();
    },
    { threshold: 0.05 }
  );
  io.observe(checkout);

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  }, { passive: true });

  update();
}

// ----- Boot -----
document.addEventListener('DOMContentLoaded', () => {
  updateTotals();
  initQty();
  initUpsell();
  initPayment();
  initFormValidation();
  initCheckout();
  initAudioPlayer();
  initReveal();
  initMobileCta();
});
