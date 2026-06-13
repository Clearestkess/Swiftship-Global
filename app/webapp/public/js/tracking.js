/**
 * SwiftShip Global — Shipment Tracking Module
 */

const TRACKING_STEPS = [
  { key: 'Processing',       icon: 'fas fa-cog',              label: 'Processing' },
  { key: 'In Transit',       icon: 'fas fa-truck',            label: 'In Transit' },
  { key: 'Customs Clearance',icon: 'fas fa-clipboard-check',  label: 'Customs Clearance' },
  { key: 'Out for Delivery', icon: 'fas fa-motorcycle',       label: 'Out for Delivery' },
  { key: 'Delivered',        icon: 'fas fa-check-circle',     label: 'Delivered' }
];

const DEMO_SHIPMENTS = [
  {
    trackingId: 'SWG-DEMO001ABC', sender: 'ABC Corp', receiver: 'XYZ Ltd',
    origin: 'New York, USA', destination: 'London, UK',
    mode: 'Sea Freight', status: 'In Transit', weight: '500 kg',
    eta: '2026-05-01',
    timeline: [
      { status: 'Processing',  date: '2026-04-01', note: 'Shipment received at warehouse' },
      { status: 'In Transit',  date: '2026-04-05', note: 'Vessel departed New York port' }
    ]
  },
  {
    trackingId: 'SWG-DEMO002XYZ', sender: 'Tech Inc', receiver: 'EU Imports',
    origin: 'Shanghai, China', destination: 'Frankfurt, Germany',
    mode: 'Air Freight', status: 'Customs Clearance', weight: '120 kg',
    eta: '2026-04-20',
    timeline: [
      { status: 'Processing',        date: '2026-04-10', note: 'Picked up from sender' },
      { status: 'In Transit',        date: '2026-04-11', note: 'Departed Shanghai Pudong Airport' },
      { status: 'Customs Clearance', date: '2026-04-14', note: 'Arrived Frankfurt, held at customs' }
    ]
  },
  {
    trackingId: 'SWG-DEMO003DEL', sender: 'Global Goods', receiver: 'Home Depot',
    origin: 'Dubai, UAE', destination: 'Toronto, Canada',
    mode: 'Sea Freight', status: 'Delivered', weight: '1200 kg',
    eta: '2026-04-10',
    timeline: [
      { status: 'Processing',         date: '2026-03-10', note: 'Order processed' },
      { status: 'In Transit',         date: '2026-03-15', note: 'Shipped from Jebel Ali Port' },
      { status: 'Customs Clearance',  date: '2026-04-02', note: 'Cleared Canadian customs' },
      { status: 'Out for Delivery',   date: '2026-04-09', note: 'Out for final delivery' },
      { status: 'Delivered',          date: '2026-04-10', note: 'Package delivered successfully' }
    ]
  }
];

async function lookupTracking(trackingId) {
  // 1. Try Firestore first if Firebase is enabled
  if (typeof getShipmentByTrackingId === 'function') {
    try {
      const result = await getShipmentByTrackingId(trackingId.toUpperCase());
      if (result) return result;
    } catch(e) {
      console.warn('[Tracking] Firestore lookup failed, using demo data:', e.message);
    }
  }
  // 2. Fallback to demo data
  return DEMO_SHIPMENTS.find(s => s.trackingId === trackingId.toUpperCase()) || null;
}

function renderTrackingResult(shipment, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const stepIndex = TRACKING_STEPS.findIndex(s => s.key === shipment.status);

  const stepsHtml = TRACKING_STEPS.map((step, i) => {
    let cls = '';
    if (i < stepIndex) cls = 'done';
    else if (i === stepIndex) cls = 'active';
    return `
      <div class="track-step ${cls}">
        <div class="step-dot"><i class="${step.icon}"></i></div>
        <div class="step-label">${step.label}</div>
      </div>`;
  }).join('');

  const timelineHtml = (shipment.timeline || []).map(t => `
    <div class="timeline-item">
      <div class="tl-dot"></div>
      <div class="tl-content">
        <div class="tl-status">${t.status}</div>
        <div class="tl-note">${t.note || ''}</div>
        <div class="tl-date">${t.date || ''}</div>
      </div>
    </div>`).reverse().join('') || '<p style="color:#94a3b8;font-size:13px">No timeline events yet.</p>';

  container.innerHTML = `
    <div class="track-result-header">
      <div class="track-id-display"><i class="fas fa-qrcode"></i> ${shipment.trackingId}</div>
      <span class="track-status-badge track-${(shipment.status||'').toLowerCase().replace(/\s+/g,'-')}">${shipment.status}</span>
    </div>
    <div class="track-meta-grid">
      <div class="track-meta-item"><span class="meta-label">From</span><span class="meta-val">${shipment.origin || '—'}</span></div>
      <div class="track-meta-item"><span class="meta-label">To</span><span class="meta-val">${shipment.destination || '—'}</span></div>
      <div class="track-meta-item"><span class="meta-label">Mode</span><span class="meta-val">${shipment.mode || '—'}</span></div>
      <div class="track-meta-item"><span class="meta-label">ETA</span><span class="meta-val">${shipment.eta || '—'}</span></div>
    </div>
    <div class="track-steps-wrapper">
      <div class="track-steps">${stepsHtml}</div>
    </div>
    <div class="track-timeline">
      <h4>Shipment History</h4>
      <div class="timeline-list">${timelineHtml}</div>
    </div>`;
}
