/**
 * SwiftShip Global — Forms Module
 * Quote Request + Contact Us with validation and localStorage submission
 */

'use strict';

let _quoteFormLoadTime = 0;
let _contactFormLoadTime = 0;

document.addEventListener('DOMContentLoaded', () => {
  _quoteFormLoadTime = Date.now();
  _contactFormLoadTime = Date.now();
  initQuoteForm();
  initContactForm();
});

// ══════════════════════════
// QUOTE REQUEST FORM
// ══════════════════════════
function initQuoteForm() {
  const form = document.getElementById('quoteForm');
  if (!form) return;

  // Live validation on blur
  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('blur', () => validateQuoteField(field));
  });

  // Character counter
  const msgArea = document.getElementById('qMessage');
  const counter = document.getElementById('qMsgCounter');
  if (msgArea && counter) {
    msgArea.addEventListener('input', () => {
      counter.textContent = msgArea.value.length + '/500';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateQuoteForm()) return;

    // Anti-spam: honeypot
    const hp = document.getElementById('q_hp');
    if (hp && hp.value) return;
    // Anti-spam: timing
    if (Date.now() - _quoteFormLoadTime < 2000) {
      showQuoteError('Submission too fast. Please wait a moment.'); return;
    }
    // GDPR consent
    if (!document.getElementById('qConsent')?.checked) {
      showQuoteError('Please accept the privacy policy to continue.'); return;
    }

    setQuoteLoading(true);

    const data = {
      name:        getVal('qName'),
      company:     getVal('qCompany'),
      email:       getVal('qEmail'),
      phone:       getVal('qPhone'),
      origin:      getVal('qOrigin'),
      destination: getVal('qDestination'),
      cargoType:   getVal('qCargoType'),
      mode:        getVal('qMode'),
      weight:      getVal('qWeight'),
      volume:      getVal('qVolume'),
      message:     getVal('qMessage'),
      source:      'website-quote-form',
      status:      'new'
    };

    const refNo = 'REF-' + Math.random().toString(36).substr(2,6).toUpperCase();

    try {
      // 1. Save to Firebase Firestore (with localStorage fallback)
      if (typeof createQuoteRequest === 'function') {
        await createQuoteRequest({ ...data, ref_number: refNo });
      } else {
        saveQuoteToLocalStorage({ ...data, ref_number: refNo, created_at: new Date().toISOString() });
      }
      // 2. Send email notification via EmailJS
      if (typeof emailQuoteNotification === 'function') {
        await emailQuoteNotification(data, refNo).catch(() => {});
      }
      // 3. Show success
      showQuoteSuccess(data.name, refNo);
      form.reset();
      if (counter) counter.textContent = '0/500';
      _quoteFormLoadTime = Date.now();
    } catch(err) {
      showQuoteError('Submission failed. Please try again or contact us directly.');
      console.error('Quote submit error:', err);
    } finally {
      setQuoteLoading(false);
    }
  });
}

function saveQuoteToLocalStorage(data) {
  const key = 'swiftship_quotes';
  const quotes = JSON.parse(localStorage.getItem(key) || '[]');
  quotes.push({ ...data, id: Date.now().toString() });
  localStorage.setItem(key, JSON.stringify(quotes));
}

function validateQuoteField(field) {
  const errEl = document.getElementById(field.id + 'Err');
  if (!errEl) return true;
  let msg = '';
  const val = field.value.trim();
  if (field.required && !val) {
    msg = 'This field is required.';
  } else if (field.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    msg = 'Please enter a valid email.';
  } else if (field.id === 'qPhone' && val && !/^[\d\s\+\-\(\)]{6,20}$/.test(val)) {
    msg = 'Enter a valid phone number.';
  }
  errEl.textContent = msg;
  field.style.borderColor = msg ? '#ef4444' : '';
  return !msg;
}

function validateQuoteForm() {
  const form = document.getElementById('quoteForm');
  let valid = true;
  form.querySelectorAll('input[required], select[required], textarea[required]').forEach(f => {
    if (!validateQuoteField(f)) valid = false;
  });
  if (!valid) {
    showQuoteError('Please fix the highlighted errors before submitting.');
  }
  return valid;
}

function setQuoteLoading(state) {
  const btn = document.getElementById('quoteSendBtn');
  if (!btn) return;
  btn.disabled = state;
  btn.innerHTML = state
    ? '<i class="fas fa-circle-notch fa-spin"></i> Submitting…'
    : '<i class="fas fa-paper-plane"></i> Submit Request';
}

function showQuoteError(msg) {
  const el = document.getElementById('quoteError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  const succ = document.getElementById('quoteSuccess');
  if (succ) succ.style.display = 'none';
}

function showQuoteSuccess(name, ref) {
  const succ = document.getElementById('quoteSuccess');
  const err  = document.getElementById('quoteError');
  if (err) err.style.display = 'none';
  if (succ) {
    succ.innerHTML = `
      <i class="fas fa-check-circle" style="font-size:32px;color:#22c55e;display:block;margin-bottom:12px"></i>
      <strong>Thank you, ${name || 'there'}!</strong><br>
      Your quote request has been submitted. Reference: <strong>${ref}</strong><br>
      <small>Our team will contact you within 24 hours.</small>`;
    succ.style.display = 'block';
    succ.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ══════════════════════════
// CONTACT US FORM
// ══════════════════════════
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('blur', () => validateContactField(field));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateContactForm()) return;

    // Anti-spam
    const hp = document.getElementById('c_hp');
    if (hp && hp.value) return;
    if (Date.now() - _contactFormLoadTime < 1500) {
      showContactError('Submission too fast. Please wait.'); return;
    }

    setContactLoading(true);

    const data = {
      name:    getVal('cName'),
      email:   getVal('cEmail'),
      phone:   getVal('cPhone'),
      subject: getVal('cSubject'),
      message: getVal('cMessage'),
      source:  'website-contact-form',
      read:    false
    };

    const ticketNo = 'TKT-' + Math.random().toString(36).substr(2,6).toUpperCase();
    try {
      // 1. Save to Firebase Firestore (with localStorage fallback)
      if (typeof createContactMessage === 'function') {
        await createContactMessage({ ...data, ticket_number: ticketNo });
      } else {
        saveContactToLocalStorage({ ...data, ticket_number: ticketNo, created_at: new Date().toISOString() });
      }
      // 2. Send email notification via EmailJS
      if (typeof emailContactNotification === 'function') {
        await emailContactNotification(data, ticketNo).catch(() => {});
      }
      // 3. Show success
      showContactSuccess(data.name, ticketNo);
      form.reset();
      _contactFormLoadTime = Date.now();
    } catch(err) {
      showContactError('Failed to send. Please try again or email us directly.');
      console.error('Contact submit error:', err);
    } finally {
      setContactLoading(false);
    }
  });
}

function saveContactToLocalStorage(data) {
  const key = 'swiftship_contacts';
  const contacts = JSON.parse(localStorage.getItem(key) || '[]');
  contacts.push({ ...data, id: Date.now().toString() });
  localStorage.setItem(key, JSON.stringify(contacts));
}

function validateContactField(field) {
  const errEl = document.getElementById(field.id + 'Err');
  if (!errEl) return true;
  let msg = '';
  const val = field.value.trim();
  if (field.required && !val) msg = 'Required.';
  else if (field.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) msg = 'Invalid email.';
  errEl.textContent = msg;
  field.style.borderColor = msg ? '#ef4444' : '';
  return !msg;
}

function validateContactForm() {
  const form = document.getElementById('contactForm');
  let valid = true;
  form.querySelectorAll('input[required], select[required], textarea[required]').forEach(f => {
    if (!validateContactField(f)) valid = false;
  });
  if (!valid) showContactError('Please fill all required fields.');
  return valid;
}

function setContactLoading(state) {
  const btn = document.getElementById('contactSendBtn');
  if (!btn) return;
  btn.disabled = state;
  btn.innerHTML = state
    ? '<i class="fas fa-circle-notch fa-spin"></i> Sending…'
    : '<i class="fas fa-paper-plane"></i> Send Message';
}

function showContactError(msg) {
  const el = document.getElementById('contactError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  const succ = document.getElementById('contactSuccess');
  if (succ) succ.style.display = 'none';
}

function showContactSuccess(name, ticket) {
  const succ = document.getElementById('contactSuccess');
  const err  = document.getElementById('contactError');
  if (err) err.style.display = 'none';
  if (succ) {
    succ.innerHTML = `
      <i class="fas fa-check-circle" style="font-size:28px;color:#22c55e;display:block;margin-bottom:8px"></i>
      <strong>Message sent, ${name || 'thank you'}!</strong><br>
      Ticket: <strong>${ticket}</strong>. We'll reply within 24 hours.`;
    succ.style.display = 'block';
    succ.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ── Utility ──
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
