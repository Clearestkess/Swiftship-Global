/**
 * SwiftShip Global — EmailJS Configuration
 * Set EMAILJS_CONFIG.enabled = true and fill in your keys to activate email notifications
 */

const EMAILJS_CONFIG = {
  enabled:           false,              // ← Set to true after adding your keys
  publicKey:         'YOUR_PUBLIC_KEY',
  serviceId:         'YOUR_SERVICE_ID',
  quoteTemplateId:   'YOUR_QUOTE_TEMPLATE_ID',
  contactTemplateId: 'YOUR_CONTACT_TEMPLATE_ID',
  chatTemplateId:    'YOUR_CHAT_TEMPLATE_ID',
  adminEmail:        'info@swiftshipglobal.com',
  fromName:          'SwiftShip Global Website',
};

function initEmailJS() {
  if (!EMAILJS_CONFIG.enabled) return false;
  if (typeof emailjs === 'undefined') return false;
  try { emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey }); return true; }
  catch(e) { console.error('[EmailJS] Init error:', e); return false; }
}

async function emailQuoteNotification(data, refNumber) {
  if (!EMAILJS_CONFIG.enabled || typeof emailjs === 'undefined') return { skipped: true };
  try {
    return await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.quoteTemplateId, {
      to_email: EMAILJS_CONFIG.adminEmail, from_name: data.name || '',
      company: data.company || '—', from_email: data.email || '',
      phone: data.phone || '—', origin: data.origin || '',
      destination: data.destination || '', cargo_type: data.cargoType || '',
      shipment_mode: data.mode || '', weight: data.weight || '—',
      volume: data.volume || '—', message: data.message || '—',
      ref_number: refNumber, submitted_at: new Date().toLocaleString(),
    });
  } catch(e) { console.error('[EmailJS] Quote email failed:', e); throw e; }
}

async function emailContactNotification(data, ticketNumber) {
  if (!EMAILJS_CONFIG.enabled || typeof emailjs === 'undefined') return { skipped: true };
  try {
    return await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.contactTemplateId, {
      to_email: EMAILJS_CONFIG.adminEmail, from_name: data.name || '',
      from_email: data.email || '', phone: data.phone || '—',
      subject: data.subject || '', message: data.message || '',
      ticket_number: ticketNumber, submitted_at: new Date().toLocaleString(),
    });
  } catch(e) { console.error('[EmailJS] Contact email failed:', e); throw e; }
}

async function emailChatNotification(visitorName, visitorEmail, sessionId, firstMessage) {
  if (!EMAILJS_CONFIG.enabled || typeof emailjs === 'undefined') return { skipped: true };
  try {
    return await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.chatTemplateId, {
      to_email: EMAILJS_CONFIG.adminEmail, visitor_name: visitorName || 'Visitor',
      visitor_email: visitorEmail || '—', session_id: sessionId || '',
      first_message: firstMessage || '', submitted_at: new Date().toLocaleString(),
    });
  } catch(e) { console.warn('[EmailJS] Chat notification failed (non-fatal):', e); return { error: e.message }; }
}

document.addEventListener('DOMContentLoaded', initEmailJS);
