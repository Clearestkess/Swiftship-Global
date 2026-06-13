/**
 * SwiftShip Global — Live Chat Widget
 * Auto-replies with intelligent pattern matching
 */

'use strict';

const CHAT_CONFIG = {
  agentName:   'SwiftShip Support',
  agentAvatar: 'SS',
  greetDelay:  1200,
  typingDelay: 1400,
  soundEnabled: true,
  autoReplies: [
    { match: /track|tracking|shipment|where.*package|where.*order/i,
      reply: '📦 To track your shipment, enter your tracking ID in the tracking section above — or share it here and I\'ll look it up for you!' },
    { match: /quote|price|cost|rate|how much/i,
      reply: '💰 I\'d love to get you a quote! Please fill out the Request a Quote form on this page, or tell me your origin, destination, and cargo type here.' },
    { match: /sea|ocean|fcl|lcl/i,
      reply: '🚢 Our sea freight service covers FCL & LCL to any major port worldwide. Transit times vary by route — typical trans-Atlantic is 10–14 days.' },
    { match: /air|express|urgent|fast|quick/i,
      reply: '✈️ Need it fast? Our air freight express service delivers in 1–3 business days to most global destinations. Shall I connect you with an agent for a quote?' },
    { match: /road|truck|trucking|ground/i,
      reply: '🚛 Our road freight covers FTL and LTL across North America and Europe with GPS-tracked vehicles and real-time updates.' },
    { match: /custom|import|export|duty|clearance/i,
      reply: '📋 Our customs brokerage team handles clearance in 180+ countries. We manage all documentation, duties, and compliance on your behalf.' },
    { match: /warehouse|storage|inventory/i,
      reply: '🏭 We offer flexible warehousing solutions — short and long term — with full inventory management and distribution services.' },
    { match: /hello|hi|hey|good morning|good afternoon|good evening|howdy/i,
      reply: 'Hello! 👋 Welcome to SwiftShip Global. How can I help you today? I can assist with tracking, quotes, services, and more.' },
    { match: /thank|thanks|thank you/i,
      reply: 'You\'re welcome! 😊 Is there anything else I can help you with?' },
    { match: /bye|goodbye|see you|that.*all/i,
      reply: 'Thanks for reaching out to SwiftShip Global! 🚀 Safe travels and happy shipping. Our team is here 24/7 if you need us.' },
    { match: /human|agent|person|representative|speak to someone/i,
      reply: '👤 I\'ll connect you with a live agent right away! In the meantime, you can also reach us at info@swiftshipglobal.com or call +1 (800) 123-4567.' },
    { match: /phone|call|number|contact/i,
      reply: '📞 You can reach us at +1 (800) 123-4567, Mon–Fri 8am–8pm, Sat 9am–4pm. Or email us at info@swiftshipglobal.com.' },
  ],
  defaultReply: '🤔 Thanks for your message! Let me connect you with our support team. You can also reach us at info@swiftshipglobal.com or call +1 (800) 123-4567 for immediate assistance.'
};

// ── State ──
let _chatOpen     = false;
let _unreadCount  = 0;
let _messages     = [];
let _greeted      = false;
let _audioCtx     = null;
let _userName     = localStorage.getItem('swiftship_chat_name') || 'Visitor';
let _userEmail    = localStorage.getItem('swiftship_chat_email') || '';

// ── Session ──
function getSessionId() {
  let id = localStorage.getItem('swiftship_chat_session');
  if (!id) {
    id = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    localStorage.setItem('swiftship_chat_session', id);
  }
  return id;
}

// ── Notification sound ──
function playNotificationSound() {
  if (!CHAT_CONFIG.soundEnabled) return;
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.frequency.setValueAtTime(880, _audioCtx.currentTime);
    osc.frequency.setValueAtTime(1100, _audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.35);
    osc.start(_audioCtx.currentTime);
    osc.stop(_audioCtx.currentTime + 0.35);
  } catch(e) {}
}

// ── Auto-reply ──
function getAutoReply(text) {
  for (const rule of CHAT_CONFIG.autoReplies) {
    if (rule.match.test(text)) return rule.reply;
  }
  return CHAT_CONFIG.defaultReply;
}

// ── DOM helpers ──
function el(id) { return document.getElementById(id); }

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function appendMessage(msg, animate = true) {
  const body = el('chatBody');
  if (!body) return;

  const div = document.createElement('div');
  div.className = 'chat-msg ' + (msg.sender === 'user' ? 'chat-msg-user' : 'chat-msg-agent');
  div.innerHTML = msg.sender === 'agent'
    ? `<div class="chat-avatar">${CHAT_CONFIG.agentAvatar}</div>
       <div class="chat-bubble-wrap">
         <div class="chat-bubble">${msg.text}</div>
         <div class="chat-time">${CHAT_CONFIG.agentName} · ${formatTime(msg.ts || Date.now())}</div>
       </div>`
    : `<div class="chat-bubble-wrap">
         <div class="chat-bubble">${escapeHtml(msg.text)}</div>
         <div class="chat-time">${formatTime(msg.ts || Date.now())}</div>
       </div>`;

  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showTyping() {
  const body = el('chatBody');
  if (!body || el('chatTyping')) return;
  const div = document.createElement('div');
  div.id = 'chatTyping';
  div.className = 'chat-msg chat-msg-agent';
  div.innerHTML = `<div class="chat-avatar">${CHAT_CONFIG.agentAvatar}</div>
    <div class="chat-bubble-wrap"><div class="chat-bubble typing-bubble"><span></span><span></span><span></span></div></div>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function hideTyping() {
  const t = el('chatTyping');
  if (t) t.remove();
}

function setUnread(count) {
  _unreadCount = count;
  const badge = el('chatBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

// ── Send message ──
async function sendUserMessage(text) {
  text = text.trim();
  if (!text) return;

  const msg = { sender: 'user', text, ts: Date.now() };
  _messages.push(msg);
  appendMessage(msg);

  el('chatInput').value = '';
  el('chatInput').style.height = 'auto';
  el('chatSendBtn').disabled = true;

  // Persist user message to Firestore (with localStorage fallback)
  const sessionId = getSessionId();
  if (typeof saveLiveChatMessage === 'function') {
    saveLiveChatMessage(sessionId, text, _userName || 'Visitor', _userEmail || '').catch(() => {});
  } else {
    try {
      const key = 'swiftship_chat_' + sessionId;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      stored.push({ sender: 'user', text, ts: msg.ts });
      localStorage.setItem(key, JSON.stringify(stored));
    } catch(e) {}
  }

  showTyping();
  setTimeout(() => {
    hideTyping();
    const replyText = getAutoReply(text);
    const replyMsg  = { sender: 'agent', text: replyText, ts: Date.now() };
    _messages.push(replyMsg);
    appendMessage(replyMsg);

    // Persist agent reply to Firestore (with localStorage fallback)
    if (typeof saveLiveChatMessage === 'function') {
      saveLiveChatMessage(sessionId, '[Agent] ' + replyText, 'SwiftShip Support', '').catch(() => {});
    } else {
      try {
        const key = 'swiftship_chat_' + sessionId;
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        stored.push({ sender: 'agent', text: replyText, ts: replyMsg.ts });
        localStorage.setItem(key, JSON.stringify(stored));
      } catch(e) {}
    }

    if (!_chatOpen) {
      setUnread(_unreadCount + 1);
      playNotificationSound();
    }
  }, CHAT_CONFIG.typingDelay);
}

// ── Greeting ──
function showGreeting() {
  if (_greeted) return;
  _greeted = true;

  setTimeout(() => {
    showTyping();
    setTimeout(() => {
      hideTyping();
      const greet = { sender: 'agent', text: '👋 Hi there! Welcome to <strong>SwiftShip Global</strong>. How can I help you today?', ts: Date.now() };
      appendMessage(greet);
      if (!_chatOpen) {
        setUnread(1);
        // Add pulse to FAB
        const fab = el('chatToggleBtn');
        if (fab) { fab.classList.add('pulse'); setTimeout(() => fab.classList.remove('pulse'), 3500); }
        playNotificationSound();
      }
    }, 900);
  }, CHAT_CONFIG.greetDelay);
}

// ── Open / Close ──
function openChat() {
  _chatOpen = true;
  const win = el('chatWindow');
  const btn = el('chatToggleBtn');
  if (win) win.classList.add('open');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  setUnread(0);
  setTimeout(() => el('chatInput')?.focus(), 300);
}

function closeChat() {
  _chatOpen = false;
  const win = el('chatWindow');
  const btn = el('chatToggleBtn');
  if (win) win.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = el('chatToggleBtn');
  const closeBtn  = el('chatCloseBtn');
  const sendBtn   = el('chatSendBtn');
  const input     = el('chatInput');

  toggleBtn?.addEventListener('click', () => {
    if (_chatOpen) closeChat(); else openChat();
  });

  closeBtn?.addEventListener('click', closeChat);

  sendBtn?.addEventListener('click', () => {
    const text = input?.value?.trim();
    if (text) sendUserMessage(text);
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (text) sendUserMessage(text);
    }
  });

  input?.addEventListener('input', () => {
    if (sendBtn) sendBtn.disabled = !input.value.trim();
    // Auto-resize
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _chatOpen) closeChat();
  });

  // Show greeting after delay
  showGreeting();
});
