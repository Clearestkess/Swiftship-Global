# SwiftShip Global — Transport & Logistics Service

## Project Overview
- **Name**: SwiftShip Global
- **Goal**: Full-featured logistics & freight company website with real-time shipment tracking, quote requests, live chat, and admin portal
- **Replica of**: https://swiftship-d8b13.web.app

## Live Preview
- **Sandbox**: https://3000-ihw8ank0wi7wziyonfbju-b9b802c4.sandbox.novita.ai
- **Admin Login**: https://3000-ihw8ank0wi7wziyonfbju-b9b802c4.sandbox.novita.ai/admin/login.html

## Features

### ✅ Completed Features
1. **Hero Section** — Full-screen gradient hero with animated counters (180+ countries, 50K+ shipments, 99% on-time)
2. **Real-Time Tracking** — Shipment tracking with 3 demo shipments, step progress indicator, and history timeline
3. **Features Strip** — 4 highlight feature cards
4. **About Section** — Company profile with image gallery and 20+ years badge
5. **Services Grid** — 6 service cards (Sea, Air, Road, Rail, Warehousing, Customs) with hover animations
6. **Why Us** — Performance metrics with animated progress bars
7. **Counter Section** — Dark gradient section with animated number counters
8. **Projects Gallery** — 3 project cards with hover overlay effects
9. **Quote Request Form** — Full form with validation, anti-spam honeypot, consent checkbox, character counter
10. **Leadership Team** — Premium team section with 4 team members and avatar initials
11. **Contact Section** — Contact info + contact form with validation
12. **Partners Strip** — Trusted partners logos (DHL, FedEx, Maersk, MSC, etc.)
13. **Footer** — Full footer with navigation, social links, newsletter signup
14. **Live Chat Widget** — FAB chat button, animated chat window, auto-replies with pattern matching, typing indicators
15. **Admin Login Page** — Demo login page (admin@swiftshipglobal.com / SwiftShip2026!)
16. **Responsive Design** — Mobile-first, breakpoints at 1024px, 768px, 480px
17. **Sticky Navbar** — Transparent → dark on scroll, mobile hamburger menu

### Interactive Demo
- **Tracking Demo IDs**: SWG-DEMO001ABC, SWG-DEMO002XYZ, SWG-DEMO003DEL
- **Admin Demo Login**: admin@swiftshipglobal.com / SwiftShip2026!

## URLs / Routes
| Route | Description |
|-------|-------------|
| `/` | Main homepage |
| `/admin/login.html` | Admin portal login |
| `/#tracking` | Shipment tracking section |
| `/#about` | About section |
| `/#services` | Services section |
| `/#quote` | Quote request form |
| `/#contact` | Contact form |
| `/api/health` | API health check |

## Tech Stack
- **Framework**: Hono v4 on Cloudflare Workers
- **Build**: Vite + @hono/vite-build
- **Frontend**: Vanilla JS, Tailwind-style custom CSS
- **Icons**: Font Awesome 6.4.0 (CDN)
- **Fonts**: Google Fonts — Inter
- **Platform**: Cloudflare Pages

## Project Structure
```
webapp/
├── src/
│   └── index.tsx          # Hono worker (serves HTML)
├── public/
│   ├── index.html         # Main landing page
│   ├── css/
│   │   └── style.css      # Complete stylesheet
│   ├── js/
│   │   ├── main.js        # Navbar, counters, animations
│   │   ├── tracking.js    # Shipment tracking module
│   │   ├── forms.js       # Quote & contact forms
│   │   └── livechat.js    # Live chat widget
│   └── admin/
│       ├── login.html     # Admin login page
│       └── login.css      # Admin login styles
├── dist/                  # Built output
├── ecosystem.config.cjs   # PM2 config
├── wrangler.jsonc         # Cloudflare config
├── vite.config.ts         # Vite build config
└── package.json
```

## Deployment
- **Platform**: Cloudflare Pages (Workers)
- **Status**: ✅ Running in sandbox
- **Build**: `npm run build` → `dist/_worker.js`
- **Deploy**: `npm run deploy`
- **Last Updated**: 2026-06-05
