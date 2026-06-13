/**
 * SwiftShip Global — Main Site JavaScript
 * Navbar, counters, animations, scroll effects
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initCounters();
  initScrollAnimations();
  initTrackingForm();
  initSmoothScroll();
});

// ── Navbar ──
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('navMenu');

  // Sticky on scroll
  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 50);
  });

  // Mobile toggle
  hamburger?.addEventListener('click', () => {
    navMenu?.classList.toggle('open');
    hamburger.classList.toggle('active');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (navMenu?.classList.contains('open') && !navbar?.contains(e.target)) {
      navMenu.classList.remove('open');
      hamburger?.classList.remove('active');
    }
  });

  // Close on nav link click
  navMenu?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
      hamburger?.classList.remove('active');
    });
  });
}

// ── Animated Counters ──
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(c => observer.observe(c));
}

function animateCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const steps = 60;
  const increment = target / steps;
  let current = 0;
  const interval = setInterval(() => {
    current = Math.min(current + increment, target);
    el.textContent = Math.round(current).toLocaleString() + suffix;
    if (current >= target) clearInterval(interval);
  }, duration / steps);
}

// ── Scroll Animations (fade-in) ──
function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in, .slide-up, .slide-left, .slide-right');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => observer.observe(el));
}

// ── Shipment Tracking Form ──
function initTrackingForm() {
  const form   = document.getElementById('trackingForm');
  const input  = document.getElementById('trackInput');
  const result = document.getElementById('trackResult');
  if (!form || !input) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = input.value.trim().toUpperCase();
    if (!id) { input.focus(); return; }
    result.style.display = 'block';
    result.innerHTML = '<div class="track-loading"><i class="fas fa-circle-notch fa-spin"></i><span>Tracking shipment…</span></div>';

    try {
      const shipment = await lookupTracking(id);
      if (!shipment) {
        result.innerHTML = `
          <div class="track-not-found">
            <i class="fas fa-search"></i>
            <p><strong>${id}</strong> was not found.</p>
            <small>Check the tracking ID and try again. Demo IDs: SWG-DEMO001ABC, SWG-DEMO002XYZ, SWG-DEMO003DEL</small>
          </div>`;
      } else {
        renderTrackingResult(shipment, 'trackResult');
      }
    } catch(err) {
      result.innerHTML = `<div class="track-error"><i class="fas fa-exclamation-triangle"></i> Error: ${err.message}</div>`;
    }
  });

  // Demo links
  document.querySelectorAll('[data-track-demo]').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.trackDemo;
      form.dispatchEvent(new Event('submit'));
    });
  });
}

// ── Smooth Scroll for anchor links ──
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}
