/* Public website logic: loads saved configuration, runs the enquiry form, sends the request. */
(function () {
  'use strict';

  var Cfg = window.SiteCfg;
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var C = Cfg.normalize(null);          /* current configuration (starts as defaults) */
  var configSource = 'default';         /* 'default' until settings load, then 'published' */

  /* Public settings and product data are read from Supabase. The public key is not a secret; RLS protects writes and private records. */

  function supabaseConfig() {
    var cfg = window.SUPABASE_CONFIG || {};
    return cfg.url && cfg.anonKey ? cfg : null;
  }

  function loadPublished() {
    var sc = supabaseConfig();
    if (!sc) return Promise.resolve(null);
    var url = sc.url.replace(/\/+$/, '') + '/rest/v1/site_settings?select=config&id=eq.1&limit=1';
    return fetch(url, { headers: { apikey: sc.anonKey } })
      .then(function (r) { if (!r.ok) return null; return r.json(); })
      .then(function (rows) { return Array.isArray(rows) && rows.length ? Cfg.normalize(rows[0].config) : null; })
      .catch(function () { return null; });
  }

  function loadPublicProducts() {
    var sc = supabaseConfig();
    if (!sc) return Promise.resolve([]);
    var url = sc.url.replace(/\/+$/, '') + '/rest/v1/products?select=id,name,description,category,price,availability,image_url,published,created_at&published=eq.true&order=created_at.desc';
    return fetch(url, { headers: { apikey: sc.anonKey } })
      .then(function (r) { if (!r.ok) throw new Error('Product request failed'); return r.json(); });
  }

  /* ------------------------------------------------------------------
     APPLY CONFIG TO THE PAGE (all values inserted as text, never HTML)
     ------------------------------------------------------------------ */
  function telHref(p) { return 'tel:' + String(p).replace(/[^0-9+]/g, ''); }

  function renderOpeningHours() {
    var rows = ((C.business && Array.isArray(C.business.openingHours)) ? C.business.openingHours : []).filter(function (r) { return r.hours; });
    ['openingHoursList', 'footerOpeningHours'].forEach(function (id) {
      var list = $(id); if (!list) return;
      if (list.parentNode) list.parentNode.hidden = !rows.length;   /* no hours entered: hide the whole block */
      list.innerHTML = '';
      rows.forEach(function (row) {
        var line = document.createElement('div');
        var day = document.createElement('dt'); day.textContent = row.day + ':';
        var hours = document.createElement('dd'); hours.textContent = row.hours;
        line.append(day, hours); list.appendChild(line);
      });
    });
  }

  function renderProducts(items, failed) {
    var grid = $('productGrid'); if (!grid) return;
    grid.innerHTML = '';
    if (failed) {
      var fail = document.createElement('p'); fail.className = 'lead'; fail.textContent = 'Products are temporarily unavailable. Please try again later.'; grid.appendChild(fail); return;
    }
    if (!Array.isArray(items) || !items.length) {
      var empty = document.createElement('p'); empty.className = 'lead'; empty.textContent = 'No products have been published yet.'; grid.appendChild(empty); return;
    }
    var availability = { available: 'Available', out_of_stock: 'Out of stock', preorder: 'Pre-order', ask: 'Contact us to check availability' };
    items.forEach(function (product) {
      var card = document.createElement('article'); card.className = 'product-card';
      if (product.image_url) {
        var img = document.createElement('img'); img.src = product.image_url; img.alt = product.name || 'Product image'; img.loading = 'lazy';
        img.onerror = function () { var placeholder = document.createElement('div'); placeholder.className = 'product-image-placeholder'; placeholder.textContent = 'Image unavailable'; img.replaceWith(placeholder); };
        card.appendChild(img);
      } else {
        var place = document.createElement('div'); place.className = 'product-image-placeholder'; place.textContent = 'No image provided'; card.appendChild(place);
      }
      if (product.category) { var cat = document.createElement('p'); cat.className = 'product-category'; cat.textContent = product.category; card.appendChild(cat); }
      var h = document.createElement('h3'); h.textContent = product.name; card.appendChild(h);
      if (product.description) { var desc = document.createElement('p'); desc.textContent = product.description; card.appendChild(desc); }
      if (product.price !== null && product.price !== undefined && product.price !== '') {
        var price = document.createElement('p'); price.className = 'product-price';
        var number = Number(product.price); price.textContent = Number.isFinite(number) ? '£' + number.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Ask for price'; card.appendChild(price);
      }
      var av = document.createElement('p'); av.className = 'product-availability'; av.textContent = availability[product.availability] || 'Contact us to check availability'; card.appendChild(av);
      var button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-p'; button.textContent = 'Ask about this product';
      button.addEventListener('click', function () { openProductEnquiry(product); }); card.appendChild(button);
      grid.appendChild(card);
    });
  }

  function applyConfig() {
    var b = C.business, c = C.content;
    document.title = b.name + ' — Electrical Services';
    all('[data-config-name]').forEach(function (el) { el.textContent = b.name; });
    all('[data-config-brand]').forEach(function (el) { el.textContent = b.name; });
    all('[data-config-phone]').forEach(function (el) {
      if (el.tagName === 'A') el.href = telHref(b.phone);
      el.textContent = b.phone;
      el.hidden = !b.phone;
    });
    all('[data-config-email]').forEach(function (el) {
      if (el.tagName === 'A') el.href = 'mailto:' + b.email;
      el.textContent = b.email;
      el.hidden = !b.email;
    });
    all('[data-config-fee]').forEach(function (el) { el.textContent = C.pricing.fee; });
    all('[data-config-fee-block]').forEach(function (el) { el.hidden = !C.pricing.fee; });   /* only shown when the owner has entered a fee */
    all('[data-config-policy]').forEach(function (el) { el.textContent = C.pricing.policy; });
    all('[data-config-policy-card]').forEach(function (el) {
      if (C.pricing.policy) el.textContent = C.pricing.policy;
    });
    var set = function (id, t) { var el = $(id); if (el) el.textContent = t; };
    set('heroKicker', c.kicker); set('heroTitle', c.headline); set('heroIntro', c.intro);
    set('heroBtn1', c.primaryButton); set('heroBtn2', c.secondaryButton);
    $('heroKicker').hidden = !c.kicker;

    renderOpeningHours();
    set('addressText', b.address); $('addressText').hidden = !b.address;

    /* trust statements */
    var tg = $('trustGrid'); tg.innerHTML = '';
    c.trust.forEach(function (t) {
      var card = document.createElement('div'); card.className = 'card';
      if (t.num) { var n = document.createElement('div'); n.className = 'num'; n.textContent = t.num; card.appendChild(n); }
      var h = document.createElement('h3'); h.textContent = t.title; card.appendChild(h);
      var p = document.createElement('p'); p.textContent = t.text; card.appendChild(p);
      tg.appendChild(card);
    });
    tg.hidden = !c.trust.length;

    /* banner: honest about where the content came from */
    var banner = $('demoBanner'), bt = $('demoBannerText');
    banner.hidden = !c.showDemoBanner;
    bt.textContent = 'Draft content. Please review all wording, coverage and prices before launch.';

    /* hero photo (genuine photo URL, otherwise typography-led hero) */
    var hp = $('heroPhoto'), him = $('heroPhotoImg'), he = $('heroEmpty');
    if (C.photos.heroUrl) {
      him.onerror = function () { hp.hidden = true; if (he) he.hidden = false; };
      him.src = C.photos.heroUrl; him.alt = C.photos.heroAlt || '';
      hp.hidden = false; if (he) he.hidden = true;
    } else { hp.hidden = true; him.removeAttribute('src'); if (he) he.hidden = false; }   /* no photo: show the empty navy image area */

    /* photo gallery: hidden when there are no photos; broken images are removed */
    var ps = $('photos'), pg = $('photoGal'); pg.innerHTML = '';
    C.photos.gallery.forEach(function (g) {
      var f = document.createElement('figure'), im = document.createElement('img');
      im.src = g.url; im.alt = g.caption || ''; im.loading = 'lazy';
      im.style.cssText = 'width:100%; height:220px; object-fit:cover; border-radius:12px;';
      im.onerror = function () { f.remove(); if (!pg.children.length) ps.hidden = true; };
      f.appendChild(im);
      if (g.caption) { var fc = document.createElement('figcaption'); fc.textContent = g.caption; f.appendChild(fc); }
      pg.appendChild(f);
    });
    ps.hidden = !C.photos.gallery.length;

    /* sample reviews are invented placeholders: only shown if the owner leaves them on */
    $('reviews').hidden = !c.showSampleReviews;

    /* coverage tags */
    var tags = $('areaTagsList'); tags.innerHTML = '';
    C.areas.forEach(function (h) {
      var li = document.createElement('li'); li.textContent = h.name + (h.zip ? ' (' + h.zip + ')' : ''); tags.appendChild(li);
    });
    $('areas').hidden = !C.areas.length;                     /* coverage section only appears once areas are entered */
    $('btnCheckStepArea').hidden = !C.areas.length;

    renderAppliances();
    renderSummaryTerms();
  }

  /* ------------------------------------------------------------------
     REPAIR CONCIERGE WIZARD
     ------------------------------------------------------------------ */
  var state = {
    step: 1, applianceId: null, applianceLabel: null, brand: null, symptom: null,
    customNotes: '', area: null, areaApproved: false, requestId: null, sending: false, sent: false
  };

  var appliancePicker = $('appliancePicker'), brandPicker = $('brandPicker'), symptomPicker = $('symptomPicker');
  var customIssueInput = $('customIssue'), areaInput = $('areaInput'), stepAreaMsg = $('stepAreaMsg');
  var btnNextStep = $('btnNextStep'), btnPrevStep = $('btnPrevStep'), stepNumText = $('stepNumText');
  var stepNodes = all('.step-node');
  var nameIn = $('custName'), phoneIn = $('custPhone'), emailIn = $('custEmail'), methodIn = $('custMethod');
  var contactMsg = $('stepContactMsg');

  function newRequestId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function pickButton(container, label, selected, onPick) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = label;
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    btn.addEventListener('click', function () {
      container.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      onPick();
    });
    container.appendChild(btn);
  }

  function renderAppliances() {
    appliancePicker.innerHTML = '';
    var list = C.appliances.filter(function (a) { return a.enabled; });
    if (state.applianceId && !list.some(function (a) { return a.id === state.applianceId; })) {
      state.applianceId = null; state.applianceLabel = null; state.symptom = null; symptomPicker.innerHTML = '';
    }
    list.forEach(function (app) {
      pickButton(appliancePicker, app.label, state.applianceId === app.id, function () {
        state.applianceId = app.id; state.applianceLabel = app.label; state.symptom = null;
        renderSymptoms(app.id);
      });
    });
  }

  function renderBrands() {
    brandPicker.innerHTML = '';
    Cfg.brands.forEach(function (br) {
      pickButton(brandPicker, br, false, function () { state.brand = br; });
    });
  }

  function renderSymptoms(id) {
    symptomPicker.innerHTML = '';
    Cfg.symptomsFor(id).forEach(function (item) {
      pickButton(symptomPicker, item, false, function () { state.symptom = item; });
    });
  }

  function renderSummaryTerms() { /* terms text is filled by applyConfig via data-config-* attributes */ }

  function validateStepArea() {
    var raw = areaInput.value.trim(), q = raw.toLowerCase();
    if (!q) {
      stepAreaMsg.textContent = 'Please enter your postcode or area.';
      stepAreaMsg.className = 'feedback-note warn'; state.areaApproved = false; return false;
    }
    var match = C.areas.filter(function (h) { return (h.zip && h.zip === q) || h.name.toLowerCase().indexOf(q) !== -1; })[0];
    if (match) {
      state.area = match.name + (match.zip ? ' (' + match.zip + ')' : '');
      stepAreaMsg.textContent = '✓ ' + match.name + ' is in our listed coverage area.';
    } else {
      state.area = raw;
      stepAreaMsg.textContent = C.areas.length ? 'Area noted. We will confirm whether we can cover it when we contact you.' : '';
    }
    state.areaApproved = true; stepAreaMsg.className = 'feedback-note ok';
    return true;
  }
  $('btnCheckStepArea').addEventListener('click', validateStepArea);

  /* ---- contact validation (the server repeats these checks) ---- */
  var EMAIL_RE = /^[^\s@<>"',;:()\[\]\\]+@[^\s@<>"',;:()\[\]\\]+\.[^\s@<>"',;:()\[\]\\]{2,}$/;
  function validateContact() {
    var name = nameIn.value.trim(), phone = phoneIn.value.trim(), email = emailIn.value.trim();
    var msg = '';
    if (!name) msg = 'Please enter your name.';
    else if (phone.replace(/\D/g, '').length < 7 || !/^[0-9+()\-.\s]{7,30}$/.test(phone)) msg = 'Please enter a valid phone number.';
    else if (email && (!EMAIL_RE.test(email) || email.length > 254)) msg = 'That email address does not look right.';
    else if (methodIn.value === 'Email' && !email) msg = 'Please add your email address, or choose another contact method.';
    contactMsg.textContent = msg;
    return !msg;
  }
  methodIn.addEventListener('change', function () { $('emailReq').textContent = methodIn.value === 'Email' ? '*' : ''; });

  function goToStep(target) {
    if (target < 1 || target > 5) return;
    if (target > state.step) {
      if (state.step === 1 && !state.applianceId) { alert('Please choose a service to continue.'); return; }
      if (state.step === 2 && !state.brand) { alert("Please choose a property type, or 'Other / not sure'."); return; }
      if (state.step === 3) {
        state.customNotes = customIssueInput.value.trim();
        if (!state.symptom && !state.customNotes) { alert('Please choose an option or describe the job.'); return; }
      }
      if (state.step === 4) {
        if (!validateStepArea()) return;
        if (!validateContact()) return;
      }
    }
    state.step = target;
    all('.pane').forEach(function (p) { p.classList.remove('active'); });
    var pane = document.querySelector('.pane[data-pane="' + target + '"]');
    if (pane) pane.classList.add('active');
    stepNodes.forEach(function (node, idx) {
      var i = idx + 1;
      node.classList.remove('active', 'completed');
      if (i === target) node.classList.add('active'); else if (i < target) node.classList.add('completed');
    });
    var bar = document.querySelector('.stepper'); if (bar) bar.setAttribute('aria-valuenow', target);
    btnPrevStep.style.visibility = target === 1 ? 'hidden' : 'visible';
    if (target === 5) { btnNextStep.style.display = 'none'; updateSummary(); }
    else { btnNextStep.style.display = 'inline-flex'; btnNextStep.textContent = 'Continue →'; }
    stepNumText.textContent = target;
  }
  btnNextStep.addEventListener('click', function () { goToStep(state.step + 1); });
  btnPrevStep.addEventListener('click', function () { goToStep(state.step - 1); });
  all('[data-edit-step]').forEach(function (btn) {
    btn.addEventListener('click', function (e) { goToStep(parseInt(e.currentTarget.getAttribute('data-edit-step'), 10)); });
  });

  function updateSummary() {
    $('sumAppliance').textContent = state.applianceLabel || 'Not selected';
    $('sumBrand').textContent = state.brand || 'Not selected';
    var desc = state.symptom || '';
    if (state.customNotes) desc += (desc ? ' — ' : '') + '"' + state.customNotes + '"';
    $('sumIssue').textContent = desc || 'General enquiry';
    $('sumArea').textContent = state.area || 'Not provided';
    var contact = nameIn.value.trim() + ' · ' + phoneIn.value.trim() + (emailIn.value.trim() ? ' · ' + emailIn.value.trim() : '') + ' · prefers: ' + methodIn.value;
    $('sumContact').textContent = contact;
  }

  /* ------------------------------------------------------------------
     SENDING (success is shown ONLY after the server confirms the email provider accepted it)
     ------------------------------------------------------------------ */
  var btnSend = $('btnSend'), btnRetry = $('btnRetry'), sendStatus = $('sendStatus');

  function setSending(on) {
    state.sending = on;
    btnSend.disabled = on || state.sent;
    btnRetry.disabled = on;
    btnSend.textContent = on ? 'Sending…' : (state.sent ? 'Enquiry Sent ✓' : 'Send Enquiry');
  }
  function showStatus(text, retry) {
    sendStatus.textContent = text;
    btnRetry.hidden = !retry;
  }

  function sendRequest() {
    if (state.sending || state.sent) return;            /* blocks double-clicks */
    if (!validateContact()) { goToStep(4); return; }
    if (!state.requestId) state.requestId = newRequestId(); /* same id on retry lets the server de-duplicate */
    var payload = {
      enquiryType: 'repair',
      clientRequestId: state.requestId,
      appliance: state.applianceLabel || '',
      brand: state.brand || '',
      symptom: state.symptom || '',
      notes: state.customNotes || '',
      area: state.area || '',
      name: nameIn.value.trim(),
      phone: phoneIn.value.trim(),
      email: emailIn.value.trim(),
      contactMethod: methodIn.value,
      website: $('hpWebsite').value          /* honeypot: must stay empty */
    };
    setSending(true); showStatus('Sending your request…', false);
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; setSending(false); showStatus('This is taking longer than expected. Please try again, or call ' + C.business.phone + '.', true); } }, 20000);

    fetch('/api/send-repair-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      if (done) return; done = true; clearTimeout(timer);
      if (res.status === 200 && res.body && res.body.ok === true && res.body.saved === true) {
        state.sent = true; setSending(false);
        if (res.body.notificationSent) showStatus('✓ Your enquiry was saved and the business was notified. We will contact you by ' + methodIn.value.toLowerCase() + '.', false);
        else showStatus('Your enquiry was saved, but the notification email could not be sent. The business may not have been notified. Please call ' + (C.business.phone || 'the business') + ' if urgent.', false);
      } else if (res.status === 503 && res.body && res.body.error === 'setup_required') {
        setSending(false);
        showStatus('Online enquiries are not configured yet, so your request could not be saved. Please call ' + (C.business.phone || 'the business') + '.', true);
      } else if (res.status === 400 && res.body && res.body.message) {
        setSending(false); showStatus('Please check your details: ' + res.body.message, false);
      } else if (res.status === 429) {
        setSending(false); showStatus('Too many requests. Please wait a minute and try again, or call ' + C.business.phone + '.', true);
      } else {
        setSending(false); showStatus('We could not save your request. Please try again, or call ' + (C.business.phone || 'the business') + '.', true);
      }
    }).catch(function () {
      if (done) return; done = true; clearTimeout(timer);
      setSending(false);
      showStatus('We could not reach the request service, so your request may not have been saved. Check your connection and try again, or call ' + (C.business.phone || 'the business') + '.', true);
    });
  }
  btnSend.addEventListener('click', sendRequest);
  btnRetry.addEventListener('click', sendRequest);

  function resetConcierge() {
    state.step = 1; state.applianceId = null; state.applianceLabel = null; state.brand = null; state.symptom = null;
    state.customNotes = ''; state.area = null; state.areaApproved = false; state.requestId = null; state.sent = false; state.sending = false;
    [customIssueInput, areaInput, nameIn, phoneIn, emailIn, $('hpWebsite')].forEach(function (el) { el.value = ''; });
    methodIn.value = 'Phone call'; $('emailReq').textContent = '';
    stepAreaMsg.textContent = ''; contactMsg.textContent = ''; showStatus('', false);
    symptomPicker.innerHTML = '';
    all('.pick button').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    setSending(false); goToStep(1);
  }
  $('btnRestartConcierge').addEventListener('click', resetConcierge);

  /* a changed answer after a failed or finished send must produce a new request id */
  ['input', 'change'].forEach(function (ev) {
    $('conciergeForm').addEventListener(ev, function () { if (!state.sending && !state.sent) state.requestId = null; });
  });

  /* ------------------------------------------------------------------
     STANDALONE COVERAGE CHECKER + MOBILE NAV
     ------------------------------------------------------------------ */
  var hubQuery = $('hubQuery'), hubStatus = $('hubStatus');
  function handleHubSearch() {
    var q = hubQuery.value.trim().toLowerCase();
    if (!q) { hubStatus.textContent = 'Please enter a postcode or area.'; hubStatus.className = 'feedback-note warn'; return; }
    var found = C.areas.filter(function (h) { return (h.zip && h.zip === q) || h.name.toLowerCase().indexOf(q) !== -1; })[0];
    if (found) {
      hubStatus.textContent = '✓ ' + found.name + ' is in our listed coverage area.';
      hubStatus.className = 'feedback-note ok';
    } else {
      hubStatus.textContent = 'ℹ "' + hubQuery.value.trim() + '" is not in our listed areas. Send an enquiry or call' + (C.business.phone ? ' ' + C.business.phone : '') + ' and we will confirm whether we can help.';
      hubStatus.className = 'feedback-note warn';
    }
  }
  $('btnHubLookup').addEventListener('click', handleHubSearch);
  hubQuery.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); handleHubSearch(); } });

  var menuBtn = $('menuBtn'), navLinks = $('navLinks');
  menuBtn.addEventListener('click', function () {
    var open = navLinks.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', open);
  });
  all('#navLinks a').forEach(function (l) {
    l.addEventListener('click', function () { navLinks.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); });
  });

  $('year').textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     PRODUCT ENQUIRY FORM
     ------------------------------------------------------------------ */
  var productDialog = $('productEnquiryDialog');
  var productForm = $('productEnquiryForm');
  var selectedProduct = null, productRequestId = null, productSending = false, productSent = false;
  function productMessage(text, kind) {
    var el = $('productEnquiryStatus'); el.textContent = text || ''; el.className = 'product-dialog-status ' + (kind || '');
  }
  function openProductEnquiry(product) {
    selectedProduct = product; productRequestId = null; productSending = false; productSent = false;
    $('productEnquiryProduct').textContent = product.name || 'Selected product';
    $('productEnquiryForm').reset(); $('productEnquirySubmit').disabled = false;
    productMessage('');
    if (typeof productDialog.showModal === 'function') productDialog.showModal();
    else { productDialog.setAttribute('open', 'open'); }
  }
  $('productEnquiryClose').addEventListener('click', function () { if (productDialog.close) productDialog.close(); else productDialog.removeAttribute('open'); });
  productForm.addEventListener('input', function () { if (!productSending && !productSent) productRequestId = null; });
  productForm.addEventListener('change', function () { if (!productSending && !productSent) productRequestId = null; });
  productForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (productSending || productSent || !selectedProduct) return;
    var name = $('productEnquiryName').value.trim();
    var phone = $('productEnquiryPhone').value.trim();
    var email = $('productEnquiryEmail').value.trim();
    if (!name || !phone || !$('productEnquiryMessage').value.trim()) { productMessage('Please complete your name, phone number and message.', 'err'); return; }
    if ($('productEnquiryMethod').value === 'Email' && !email) { productMessage('Enter your email address or choose another contact method.', 'err'); return; }
    if (!productRequestId) productRequestId = newRequestId();
    var payload = {
      enquiryType: 'product', clientRequestId: productRequestId,
      productId: selectedProduct.id, productName: selectedProduct.name,
      name: name, phone: phone, email: email,
      contactMethod: $('productEnquiryMethod').value,
      notes: $('productEnquiryMessage').value.trim(), website: $('productEnquiryWebsite').value
    };
    productSending = true; $('productEnquirySubmit').disabled = true; productMessage('Saving your enquiry…');
    fetch('/api/send-repair-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (result) {
        if (result.status === 200 && result.body && result.body.ok && result.body.saved) {
          productSent = true;
          productMessage(result.body.notificationSent ? 'Your product enquiry was saved and the business was notified.' : 'Your enquiry was saved, but the notification email could not be sent. The business may not have been notified.', result.body.notificationSent ? 'ok' : 'err');
          $('productEnquirySubmit').textContent = 'Enquiry saved';
        } else {
          productMessage((result.body && result.body.message) || 'We could not save your enquiry. Please check your details and try again.', 'err');
          $('productEnquirySubmit').disabled = false;
        }
      }).catch(function () {
        productMessage('We could not reach the enquiry service. Your enquiry may not have been saved; please try again.', 'err');
        $('productEnquirySubmit').disabled = false;
      }).finally(function () { productSending = false; });
  });

  /* ------------------------------------------------------------------
     START: use saved Supabase settings and published products when configured
     ------------------------------------------------------------------ */
  renderBrands();
  renderOpeningHours();
  renderProducts([], false);
  var hasSupabase = !!supabaseConfig();
  if (hasSupabase) {
    document.body.style.visibility = 'hidden';
    var shown = false;
    var reveal = function () { if (!shown) { shown = true; applyConfig(); document.body.style.visibility = ''; } };
    var timeout = setTimeout(reveal, 2500);
    loadPublished().then(function (published) {
      if (published) { C = published; configSource = 'published'; }
      clearTimeout(timeout); shown ? (published && applyConfig()) : reveal();
    });
    loadPublicProducts().then(function (items) { renderProducts(items, false); }).catch(function () { renderProducts([], true); });
  } else {
    applyConfig();
  }

})();
