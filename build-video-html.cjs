#!/usr/bin/env node
/**
 * Build a self-contained hu-yang-video.html with base64-embedded photo.
 * Also adds Canvas + MediaRecorder video export capability.
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Administrator/powernowauto/public';
const photoB64 = fs.readFileSync(path.join(ROOT, 'images/hu-yang.b64.txt'), 'utf8');
const photoDataUri = `data:image/jpeg;base64,${photoB64}`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>胡杨 | PowerNow 即刻加电 — 中国汽车出口专家</title>
<style>
  :root {
    --accent: #f59e0b;
    --accent-hover: #d97706;
    --dark: #0f172a;
    --darker: #020617;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--darker);
    color: #e2e8f0;
    font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }

  /* ========== SCENE SYSTEM ========== */
  .video-container {
    position: relative;
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
    aspect-ratio: 16 / 9;
    background: var(--dark);
    overflow: hidden;
    border-radius: 12px;
    box-shadow: 0 25px 80px rgba(0,0,0,0.6);
  }

  .scene {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.8s ease;
  }
  .scene.active { opacity: 1; pointer-events: auto; }
  .scene.exit-left { animation: exitLeft 0.6s ease forwards; }
  .scene.exit-right { animation: exitRight 0.6s ease forwards; }
  .scene.enter-from-right { animation: enterFromRight 0.6s ease forwards; }
  .scene.enter-from-left { animation: enterFromLeft 0.6s ease forwards; }

  @keyframes exitLeft { to { transform: translateX(-110%) scale(0.95); opacity: 0; } }
  @keyframes exitRight { to { transform: translateX(110%) scale(0.95); opacity: 0; } }
  @keyframes enterFromRight { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes enterFromLeft { from { transform: translateX(-110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  /* ========== SCENE 1: OPENING — HU YANG ========== */
  .scene-1 {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
  }
  .scene-1 .particle {
    position: absolute; border-radius: 50%;
    background: radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%);
    animation: floatUp 4s infinite;
  }
  .scene-1 .particle:nth-child(1) { width: 300px; height: 300px; top: -100px; right: -50px; animation-delay: 0s; }
  .scene-1 .particle:nth-child(2) { width: 200px; height: 200px; bottom: -50px; left: -30px; animation-delay: 1.5s; }
  .scene-1 .particle:nth-child(3) { width: 150px; height: 150px; top: 50%; left: 60%; animation-delay: 3s; }

  @keyframes floatUp {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
    50% { transform: translateY(-30px) scale(1.1); opacity: 0.7; }
  }

  .opening-content { position: relative; z-index: 1; text-align: center; }
  .opening-content .pre-title {
    font-size: 1.1rem; letter-spacing: 6px; text-transform: uppercase;
    color: var(--accent); margin-bottom: 20px; opacity: 0;
    animation: fadeSlideUp 0.8s 0.3s forwards;
  }
  .opening-content .profile-photo {
    width: 180px; height: 180px; border-radius: 50%;
    object-fit: cover; border: 4px solid rgba(245,158,11,0.4);
    box-shadow: 0 0 60px rgba(245,158,11,0.25), 0 0 120px rgba(245,158,11,0.1);
    margin-bottom: 18px;
    opacity: 0; animation: fadeSlideUp 0.8s 0.5s forwards;
  }
  @media (max-width: 768px) {
    .opening-content .profile-photo { width: 130px; height: 130px; }
  }
  .opening-content .main-name {
    font-size: 4.5rem; font-weight: 900;
    background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 40%, #f59e0b 80%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 12px; opacity: 0;
    animation: fadeSlideUp 0.8s 0.7s forwards;
  }
  .opening-content .sub-title {
    font-size: 1.6rem; color: #94a3b8; font-weight: 300; opacity: 0;
    animation: fadeSlideUp 0.8s 1.1s forwards;
  }
  .opening-content .rwanda-tag {
    display: inline-flex; align-items: center; gap: 10px;
    margin-top: 28px; padding: 10px 24px;
    background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3);
    border-radius: 50px; font-size: 1rem; color: var(--accent); opacity: 0;
    animation: fadeSlideUp 0.8s 1.5s forwards;
  }
  .rwanda-tag .rwanda-flag { font-size: 1.5rem; }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ========== SCENE 2: COMPANY INTRO ========== */
  .scene-2 {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1a1c2e 100%);
  }
  .scene-2 .glow-orb {
    position: absolute; width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%);
    top: -100px; left: 50%; transform: translateX(-50%);
    animation: pulse 3s infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: translateX(-50%) scale(1); }
    50% { transform: translateX(-50%) scale(1.15); }
  }

  .company-content { position: relative; z-index: 1; text-align: center; padding: 40px; }
  .company-content .logo-text {
    font-size: 3rem; font-weight: 900; letter-spacing: 2px; margin-bottom: 8px;
    background: linear-gradient(135deg, #f59e0b, #fbbf24);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    opacity: 0; animation: fadeSlideUp 0.8s 0.2s forwards;
  }
  .company-content .logo-sub {
    font-size: 1.2rem; color: #94a3b8; margin-bottom: 30px;
    opacity: 0; animation: fadeSlideUp 0.8s 0.5s forwards;
  }
  .company-content .stat-row {
    display: flex; gap: 30px; justify-content: center; flex-wrap: wrap;
  }
  .company-content .stat-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px; padding: 22px 30px; min-width: 140px;
    backdrop-filter: blur(10px);
    opacity: 0; animation: fadeSlideUp 0.6s forwards;
  }
  .stat-card:nth-child(1) { animation-delay: 0.8s; }
  .stat-card:nth-child(2) { animation-delay: 1.0s; }
  .stat-card:nth-child(3) { animation-delay: 1.2s; }
  .stat-card:nth-child(4) { animation-delay: 1.4s; }
  .stat-card .stat-num {
    font-size: 2.4rem; font-weight: 900; color: var(--accent);
  }
  .stat-card .stat-label { font-size: 0.85rem; color: #94a3b8; margin-top: 4px; }

  /* ========== SCENE 3: WHAT WE DO ========== */
  .scene-3 {
    background: linear-gradient(180deg, #0f172a 0%, #1a1c2e 50%, #0f172a 100%);
  }
  .service-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 20px; padding: 40px; position: relative; z-index: 1; width: 100%;
  }
  .service-item {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px; padding: 24px 22px; display: flex; gap: 16px; align-items: flex-start;
  }
  .service-item .icon {
    width: 48px; height: 48px; border-radius: 12px;
    background: rgba(245,158,11,0.15);
    display: flex; align-items: center; justify-content: center; font-size: 1.5rem;
    flex-shrink: 0;
  }
  .service-item h3 { font-size: 1.1rem; color: #f1f5f9; margin-bottom: 4px; }
  .service-item p { font-size: 0.8rem; color: #94a3b8; line-height: 1.5; }
  .service-item:nth-child(1) { opacity: 0; animation: fadeSlideUp 0.5s 0.2s forwards; }
  .service-item:nth-child(2) { opacity: 0; animation: fadeSlideUp 0.5s 0.4s forwards; }
  .service-item:nth-child(3) { opacity: 0; animation: fadeSlideUp 0.5s 0.6s forwards; }
  .service-item:nth-child(4) { opacity: 0; animation: fadeSlideUp 0.5s 0.8s forwards; }

  .scene-title {
    text-align: center; font-size: 1.8rem; font-weight: 800; color: #f1f5f9;
    position: relative; z-index: 1; padding-top: 24px;
    opacity: 0; animation: fadeSlideUp 0.6s 0.1s forwards;
  }
  .scene-title span { color: var(--accent); }

  /* ========== SCENE 4: GLOBAL REACH ========== */
  .scene-4 {
    background: linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e293b 100%);
  }
  .map-bg {
    position: absolute; inset: 0; opacity: 0.06;
    background:
      radial-gradient(circle at 30% 40%, #f59e0b 1px, transparent 1px),
      radial-gradient(circle at 60% 60%, #3b82f6 1px, transparent 1px),
      radial-gradient(circle at 45% 30%, #10b981 1px, transparent 1px),
      radial-gradient(circle at 70% 45%, #f59e0b 1px, transparent 1px),
      radial-gradient(circle at 25% 55%, #3b82f6 1px, transparent 1px),
      radial-gradient(circle at 55% 70%, #10b981 1px, transparent 1px),
      radial-gradient(circle at 80% 35%, #f59e0b 1px, transparent 1px);
    background-size: 300px 300px;
    animation: mapMove 20s linear infinite;
  }
  @keyframes mapMove { 0% { background-position: 0 0; } 100% { background-position: 300px -150px; } }

  .scene-4 .dotted-line {
    position: absolute; top: 30%; left: 20%; width: 60%; height: 40%;
    border: 2px dashed rgba(245,158,11,0.25); border-radius: 50%;
    animation: rotate 30s linear infinite;
  }
  @keyframes rotate { to { transform: rotate(360deg); } }

  .destinations {
    position: relative; z-index: 1; display: flex; flex-wrap: wrap;
    gap: 14px; justify-content: center; padding: 30px;
  }
  .dest-chip {
    padding: 10px 20px; border-radius: 50px;
    background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2);
    font-size: 0.9rem; font-weight: 600;
  }
  .dest-chip:nth-child(odd) { color: var(--accent); }
  .dest-chip:nth-child(even) { color: #60a5fa; }

  /* ========== SCENE 5: PARTNER BRANDS ========== */
  .scene-5 {
    background: linear-gradient(180deg, #0f172a 0%, #1a1c2e 50%, #0f172a 100%);
  }
  .brand-scroll { position: relative; z-index: 1; width: 100%; }
  .brand-row {
    display: flex; gap: 24px; justify-content: center; flex-wrap: wrap;
    padding: 0 30px;
  }
  .brand-tag {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 12px 18px;
    font-size: 0.9rem; font-weight: 700; color: #cbd5e1;
    text-align: center; min-width: 80px;
    opacity: 0; animation: fadeSlideUp 0.4s forwards;
  }

  /* ========== SCENE 6: HU YANG'S ROLE ========== */
  .scene-6 {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #020617 100%);
  }
  .role-content { position: relative; z-index: 1; text-align: center; padding: 30px; }
  .role-photo-row {
    display: flex; align-items: center; justify-content: center; gap: 30px; flex-wrap: wrap; margin-bottom: 18px;
  }
  .role-photo-row .role-photo {
    width: 160px; height: 160px; border-radius: 50%;
    object-fit: cover; border: 3px solid rgba(245,158,11,0.35);
    box-shadow: 0 0 40px rgba(245,158,11,0.2);
    opacity: 0; animation: fadeSlideUp 0.8s 0.1s forwards;
  }
  @media (max-width: 768px) {
    .role-photo-row .role-photo { width: 120px; height: 120px; }
  }
  .role-quote {
    font-size: 1.6rem; font-style: italic; color: #f1f5f9; line-height: 1.7;
    max-width: 700px; margin: 0 auto 20px;
    opacity: 0; animation: fadeSlideUp 0.8s 0.2s forwards;
  }
  .role-quote::before { content: '"'; color: var(--accent); font-size: 3rem; }
  .role-quote::after { content: '"'; color: var(--accent); font-size: 3rem; }
  .role-cards {
    display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;
  }
  .role-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 18px 22px; max-width: 220px; text-align: left;
  }
  .role-card .emoji { font-size: 2rem; margin-bottom: 8px; }
  .role-card .rl-title { font-size: 0.95rem; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
  .role-card .rl-desc { font-size: 0.78rem; color: #94a3b8; line-height: 1.4; }

  /* ========== SCENE 7: CALL TO ACTION ========== */
  .scene-7 {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #1a1c2e 100%);
  }
  .cta-content { position: relative; z-index: 1; text-align: center; padding: 40px; }
  .cta-content .cta-badge {
    display: inline-block; padding: 6px 16px; border-radius: 50px;
    background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3);
    color: #10b981; font-size: 0.85rem; margin-bottom: 18px;
    opacity: 0; animation: fadeSlideUp 0.6s 0.2s forwards;
  }
  .cta-content .cta-heading {
    font-size: 2.2rem; font-weight: 900; color: #f1f5f9; margin-bottom: 10px;
    opacity: 0; animation: fadeSlideUp 0.6s 0.5s forwards;
  }
  .cta-content .cta-sub {
    font-size: 1.1rem; color: #94a3b8; margin-bottom: 24px;
    opacity: 0; animation: fadeSlideUp 0.6s 0.8s forwards;
  }
  .cta-contact-row {
    display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;
  }
  .cta-contact-item {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 16px 24px; font-size: 0.95rem;
    opacity: 0; animation: fadeSlideUp 0.5s forwards;
  }
  .cta-contact-item:nth-child(1) { animation-delay: 1.1s; }
  .cta-contact-item:nth-child(2) { animation-delay: 1.3s; }
  .cta-contact-item:nth-child(3) { animation-delay: 1.5s; }
  .cta-contact-item .label { color: #64748b; font-size: 0.75rem; }
  .cta-contact-item .value { color: #f1f5f9; font-weight: 700; margin-top: 2px; }

  #scene-8 {
    background: linear-gradient(135deg, #020617 0%, #0f172a 100%);
  }

  /* ========== EXPORT BUTTON ========== */
  .export-btn {
    display: block; margin: 12px auto; padding: 14px 40px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #0f172a; font-weight: 800; font-size: 1.05rem;
    border: none; border-radius: 50px; cursor: pointer;
    font-family: inherit; letter-spacing: 1px;
    transition: all 0.3s; box-shadow: 0 4px 25px rgba(245,158,11,0.3);
  }
  .export-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 35px rgba(245,158,11,0.45); }
  .export-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .export-status {
    text-align: center; padding: 8px; color: #94a3b8; font-size: 0.85rem; min-height: 24px;
  }

  /* ========== CONTROLS ========== */
  .controls {
    display: flex; gap: 12px; justify-content: center; align-items: center;
    padding: 20px; flex-wrap: wrap;
  }
  .controls button {
    padding: 10px 24px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.05); color: #e2e8f0; cursor: pointer;
    font-size: 0.9rem; transition: all 0.2s; font-family: inherit;
  }
  .controls button:hover { background: rgba(245,158,11,0.15); border-color: var(--accent); }
  .controls .auto-btn {
    background: var(--accent); border-color: var(--accent); color: #0f172a; font-weight: 700;
  }
  .controls .auto-btn:hover { background: var(--accent-hover); }
  .controls .scene-indicator {
    color: #64748b; font-size: 0.85rem; margin: 0 8px; min-width: 60px; text-align: center;
  }
  .controls .progress-dots { display: flex; gap: 6px; }
  .controls .dot {
    width: 8px; height: 8px; border-radius: 50%; background: #334155;
    border: none; cursor: pointer; padding: 0; transition: all 0.3s;
  }
  .controls .dot.active { background: var(--accent); width: 24px; border-radius: 4px; }
  .controls .speed-select {
    padding: 8px 14px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.05); color: #e2e8f0; font-size: 0.85rem;
    font-family: inherit; cursor: pointer;
  }
  .controls .speed-select option { background: #1e293b; color: #e2e8f0; }

  .export-note {
    text-align: center; padding: 8px; color: #475569; font-size: 0.78rem;
    max-width: 960px; margin: 0 auto;
  }

  @media (max-width: 768px) {
    .opening-content .main-name { font-size: 2.8rem; }
    .opening-content .sub-title { font-size: 1.2rem; }
    .company-content .logo-text { font-size: 2rem; }
    .company-content .stat-row { gap: 12px; }
    .stat-card { padding: 14px 18px; min-width: 100px; }
    .stat-card .stat-num { font-size: 1.6rem; }
    .service-grid { grid-template-columns: 1fr; }
    .scene-title { font-size: 1.3rem; }
    .cta-content .cta-heading { font-size: 1.5rem; }
    .role-quote { font-size: 1.2rem; }
    .dest-chip { font-size: 0.75rem; padding: 8px 14px; }
  }
</style>
</head>
<body>

<!-- ===== EXPORT BUTTON ===== -->
<button class="export-btn" id="exportBtn" onclick="startExport()" style="display:none;">
  🎬 Export Video (WebM)
</button>
<div class="export-status" id="exportStatus" style="display:none;"></div>

<div class="video-container" id="videoContainer">
  <!-- ===== SCENE 1: HU YANG OPENING ===== -->
  <div class="scene scene-1 active" data-scene="0" id="scene-1">
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="opening-content">
      <img src="${photoDataUri}" alt="Hu Yang" class="profile-photo" />
      <p class="pre-title">🌍 Made in China · Shipped to the World</p>
      <h1 class="main-name">胡杨</h1>
      <p class="sub-title">Automotive Export Specialist</p>
      <div class="rwanda-tag">
        <span class="rwanda-flag">🇷🇼</span>
        <span>Rwanda · East Africa · Global Markets</span>
      </div>
    </div>
  </div>

  <!-- ===== SCENE 2: COMPANY INTRO ===== -->
  <div class="scene scene-2" data-scene="1" id="scene-2">
    <div class="glow-orb"></div>
    <div class="company-content">
      <div class="logo-text">即刻加电</div>
      <div class="logo-sub">PowerNow Auto · Changzhou Houlang NEV Import & Export</div>
      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-num">50+</div>
          <div class="stat-label">Brands 品牌</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">381+</div>
          <div class="stat-label">Vehicle Models 车型</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">NEV &amp; Fuel</div>
          <div class="stat-label">新能源 &amp; 燃油</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">Global</div>
          <div class="stat-label">Worldwide Export 全球出口</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== SCENE 3: SERVICES ===== -->
  <div class="scene scene-3" data-scene="2" id="scene-3">
    <div class="scene-title" style="position:relative;z-index:1;padding-top:20px;">🚗 <span>One-Stop</span> Auto Export Solutions</div>
    <div class="service-grid">
      <div class="service-item">
        <div class="icon">🔍</div>
        <div>
          <h3>Vehicle Sourcing 车源采购</h3>
          <p>Direct access to 50+ Chinese brands, factory-direct pricing, authentic vehicles.</p>
        </div>
      </div>
      <div class="service-item">
        <div class="icon">📋</div>
        <div>
          <h3>Export Documentation 出口单证</h3>
          <p>Complete customs clearance, COC certificates, bilingual documentation.</p>
        </div>
      </div>
      <div class="service-item">
        <div class="icon">🚢</div>
        <div>
          <h3>Logistics &amp; Shipping 物流运输</h3>
          <p>Sea freight &amp; land transport to Africa, Middle East, Central Asia, Southeast Asia.</p>
        </div>
      </div>
      <div class="service-item">
        <div class="icon">🤝</div>
        <div>
          <h3>Aftersales Support 售后保障</h3>
          <p>Parts supply, technical guidance, warranty coordination for peace of mind.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== SCENE 4: GLOBAL REACH ===== -->
  <div class="scene scene-4" data-scene="3" id="scene-4">
    <div class="map-bg"></div>
    <div class="dotted-line"></div>
    <div style="position:relative;z-index:1;text-align:center;">
      <div class="scene-title">🌏 Our <span>Global</span> Reach</div>
      <div class="destinations">
        <span class="dest-chip">🇷🇼 Rwanda 卢旺达</span>
        <span class="dest-chip">🇰🇪 Kenya 肯尼亚</span>
        <span class="dest-chip">🇹🇿 Tanzania 坦桑尼亚</span>
        <span class="dest-chip">🇺🇬 Uganda 乌干达</span>
        <span class="dest-chip">🇦🇪 UAE 阿联酋</span>
        <span class="dest-chip">🇸🇦 Saudi Arabia 沙特</span>
        <span class="dest-chip">🇰🇿 Kazakhstan 哈萨克</span>
        <span class="dest-chip">🇺🇿 Uzbekistan 乌兹别克</span>
        <span class="dest-chip">🇹🇭 Thailand 泰国</span>
        <span class="dest-chip">🇵🇭 Philippines 菲律宾</span>
        <span class="dest-chip">🇧🇷 Brazil 巴西</span>
        <span class="dest-chip">🇳🇬 Nigeria 尼日利亚</span>
      </div>
    </div>
  </div>

  <!-- ===== SCENE 5: TOP BRANDS ===== -->
  <div class="scene scene-5" data-scene="4" id="scene-5">
    <div style="position:relative;z-index:1;text-align:center;width:100%;">
      <div class="scene-title">🏭 Partner <span>Brands</span> 合作伙伴</div>
      <div class="brand-scroll">
        <div class="brand-row" style="margin-bottom:16px;">
          <span class="brand-tag" style="animation-delay:0.1s;">BYD 比亚迪</span>
          <span class="brand-tag" style="animation-delay:0.15s;">Tesla 特斯拉</span>
          <span class="brand-tag" style="animation-delay:0.2s;">Li Auto 理想</span>
          <span class="brand-tag" style="animation-delay:0.25s;">NIO 蔚来</span>
          <span class="brand-tag" style="animation-delay:0.3s;">XPeng 小鹏</span>
          <span class="brand-tag" style="animation-delay:0.35s;">Zeekr 极氪</span>
          <span class="brand-tag" style="animation-delay:0.4s;">Geely 吉利</span>
          <span class="brand-tag" style="animation-delay:0.45s;">Great Wall 长城</span>
        </div>
        <div class="brand-row">
          <span class="brand-tag" style="animation-delay:0.5s;">Changan 长安</span>
          <span class="brand-tag" style="animation-delay:0.55s;">Chery 奇瑞</span>
          <span class="brand-tag" style="animation-delay:0.6s;">GAC 广汽</span>
          <span class="brand-tag" style="animation-delay:0.65s;">SAIC 上汽</span>
          <span class="brand-tag" style="animation-delay:0.7s;">Hongqi 红旗</span>
          <span class="brand-tag" style="animation-delay:0.75s;">Voyah 岚图</span>
          <span class="brand-tag" style="animation-delay:0.8s;">Denza 腾势</span>
          <span class="brand-tag" style="animation-delay:0.85s;">Toyota 丰田</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== SCENE 6: HU YANG'S VALUE ===== -->
  <div class="scene scene-6" data-scene="5" id="scene-6">
    <div class="role-content">
      <div class="role-photo-row">
        <img src="${photoDataUri}" alt="Hu Yang" class="role-photo" />
      </div>
      <div class="role-quote" style="position:relative;z-index:1;">
        Bridging Chinese auto excellence with global buyers — transparency, trust, and quality. Your reliable partner in China.
      </div>
      <div class="role-cards" style="position:relative;z-index:1;">
        <div class="role-card" style="animation: fadeSlideUp 0.5s 0.6s both;">
          <div class="emoji">🗣️</div>
          <div class="rl-title">Bilingual Communication</div>
          <div class="rl-desc">Fluent in Chinese, English, and Kinyarwanda — seamless cross-border negotiation.</div>
        </div>
        <div class="role-card" style="animation: fadeSlideUp 0.5s 0.8s both;">
          <div class="emoji">🏭</div>
          <div class="rl-title">Factory Direct Access</div>
          <div class="rl-desc">Based in Changzhou, China — visiting factories, inspecting vehicles in person.</div>
        </div>
        <div class="role-card" style="animation: fadeSlideUp 0.5s 1.0s both;">
          <div class="emoji">🌍</div>
          <div class="rl-title">Africa Market Expertise</div>
          <div class="rl-desc">Deep understanding of African import regulations, market demand, and logistics.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== SCENE 7: CTA ===== -->
  <div class="scene scene-7" data-scene="6" id="scene-7">
    <div style="position:absolute;top:20px;right:30px;width:200px;height:200px;background:radial-gradient(circle,rgba(245,158,11,0.12) 0%,transparent 70%);border-radius:50%;"></div>
    <div style="position:absolute;bottom:10px;left:20px;width:150px;height:150px;background:radial-gradient(circle,rgba(59,130,246,0.1) 0%,transparent 70%);border-radius:50%;"></div>
    <div class="cta-content">
      <div class="cta-badge">🟢 Available for Business</div>
      <div class="cta-heading">Let's Work <span style="color:var(--accent);">Together</span></div>
      <div class="cta-sub">Contact Hu Yang for your auto export needs</div>
      <div class="cta-contact-row">
        <div class="cta-contact-item">
          <div class="label">📧 Email</div>
          <div class="value">info@houlang-auto.com</div>
        </div>
        <div class="cta-contact-item">
          <div class="label">🌐 Website</div>
          <div class="value">www.powernowauto.cn</div>
        </div>
        <div class="cta-contact-item">
          <div class="label">📍 Location</div>
          <div class="value">Changzhou, Jiangsu, China 中国常州</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== SCENE 8: END CARD ===== -->
  <div class="scene" data-scene="7" id="scene-8" style="background:linear-gradient(135deg, #020617 0%, #0f172a 100%);">
    <div style="text-align:center;position:relative;z-index:1;">
      <div style="font-size:3rem;font-weight:900;margin-bottom:8px;background:linear-gradient(135deg,#f59e0b,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent;opacity:0;animation:fadeSlideUp 0.8s 0.3s forwards;">即刻加电</div>
      <div style="font-size:2.2rem;font-weight:800;color:#f1f5f9;opacity:0;animation:fadeSlideUp 0.8s 0.6s forwards;">POWER NOW</div>
      <div style="color:#94a3b8;margin-top:10px;font-size:1rem;opacity:0;animation:fadeSlideUp 0.8s 0.9s forwards;">Changzhou Houlang New Energy Vehicle Import &amp; Export Co., Ltd.</div>
      <div style="color:var(--accent);margin-top:20px;font-size:1rem;opacity:0;animation:fadeSlideUp 0.8s 1.2s forwards;">
        🇨🇳 中国制造 · 全球信赖 &nbsp;|&nbsp; China Auto, Global Trust
      </div>
    </div>
  </div>
</div>

<!-- ========== PLAYER CONTROLS ========== -->
<div class="controls">
  <button onclick="prevScene()" id="prevBtn">◀ Prev</button>
  <button class="auto-btn" onclick="toggleAutoPlay()" id="autoBtn">▶ Auto Play</button>
  <button onclick="nextScene()" id="nextBtn">Next ▶</button>
  <span class="scene-indicator" id="sceneIndicator">1 / 8</span>
  <div class="progress-dots" id="progressDots"></div>
  <select class="speed-select" id="speedSelect" onchange="updateSpeed()">
    <option value="5000">5s per scene</option>
    <option value="4000">4s per scene</option>
    <option value="3000">3s per scene</option>
  </select>
</div>

<p class="export-note">
  💡 <strong>To export as video:</strong> Click "Export Video (WebM)" button above, or fullscreen (F11) + OBS screen record. | 📁 Self-contained HTML — photo embedded, no external files needed.
</p>

<script>
  const totalScenes = 8;
  let currentScene = 0;
  let autoPlaying = false;
  let autoTimer = null;
  let SCENE_DURATION = 5000; // 5 seconds per scene

  // Build progress dots
  const dotsContainer = document.getElementById('progressDots');
  for (let i = 0; i < totalScenes; i++) {
    const dot = document.createElement('button');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.onclick = () => goToScene(i);
    dot.setAttribute('aria-label', \`Scene \${i + 1}\`);
    dotsContainer.appendChild(dot);
  }

  function updateDots() {
    document.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === currentScene);
    });
    document.getElementById('sceneIndicator').textContent = \`\${currentScene + 1} / \${totalScenes}\`;
  }

  function updateSpeed() {
    SCENE_DURATION = parseInt(document.getElementById('speedSelect').value);
    if (autoPlaying) {
      clearTimeout(autoTimer);
      autoAdvance();
    }
  }

  function goToScene(index, direction) {
    if (index === currentScene || index < 0 || index >= totalScenes) return;

    const oldEl = document.querySelector(\`[data-scene="\${currentScene}"]\`);
    const newEl = document.querySelector(\`[data-scene="\${index}"]\`);

    if (!oldEl || !newEl) return;

    const dir = direction || (index > currentScene ? 'next' : 'prev');

    oldEl.className = oldEl.className.replace(/\\s*(exit-left|exit-right|enter-from-right|enter-from-left)/g, '');
    newEl.className = newEl.className.replace(/\\s*(exit-left|exit-right|enter-from-right|enter-from-left)/g, '');

    if (dir === 'next') {
      oldEl.classList.add('exit-left');
      newEl.classList.add('enter-from-right');
    } else {
      oldEl.classList.add('exit-right');
      newEl.classList.add('enter-from-left');
    }

    newEl.classList.add('active');

    setTimeout(() => {
      oldEl.classList.remove('active', 'exit-left', 'exit-right', 'enter-from-right', 'enter-from-left');
      newEl.classList.remove('enter-from-right', 'enter-from-left');
    }, 650);

    currentScene = index;
    updateDots();
  }

  function nextScene() {
    if (currentScene < totalScenes - 1) {
      goToScene(currentScene + 1, 'next');
    } else {
      // Loop back
      goToScene(0, 'next');
    }
  }

  function prevScene() {
    if (currentScene > 0) {
      goToScene(currentScene - 1, 'prev');
    } else {
      goToScene(totalScenes - 1, 'prev');
    }
  }

  function toggleAutoPlay() {
    autoPlaying = !autoPlaying;
    const btn = document.getElementById('autoBtn');
    if (autoPlaying) {
      btn.textContent = '⏸ Pause';
      btn.style.background = '#ef4444';
      btn.style.borderColor = '#ef4444';
      btn.style.color = '#fff';
      autoAdvance();
    } else {
      btn.textContent = '▶ Auto Play';
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
      clearTimeout(autoTimer);
    }
  }

  function autoAdvance() {
    if (!autoPlaying) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      nextScene();
      autoAdvance();
    }, SCENE_DURATION);
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextScene(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevScene(); }
    if (e.key === 'Enter') { e.preventDefault(); toggleAutoPlay(); }
  });

  updateDots();

  // ==================== VIDEO EXPORT (Canvas + MediaRecorder) ====================

  let mediaRecorder = null;
  let recordedChunks = [];
  let exportRunning = false;

  function startExport() {
    if (exportRunning) {
      stopExport();
      return;
    }

    const container = document.getElementById('videoContainer');
    const exportBtn = document.getElementById('exportBtn');
    const statusEl = document.getElementById('exportStatus');

    // Use html2canvas-style approach: create an offscreen canvas and capture frames
    // Actually, we use the simpler approach: capture the container via canvas

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const W = container.offsetWidth;
    const H = container.offsetHeight;
    // Even dimensions for encoding
    canvas.width = W % 2 === 0 ? W : W + 1;
    canvas.height = H % 2 === 0 ? H : H + 1;

    // Create a stream from canvas
    const stream = canvas.captureStream(30); // 30 FPS
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 5000000 // 5 Mbps
    });

    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'HuYang-PowerNow-Auto-Export.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      statusEl.textContent = \`✅ Export complete! File downloaded (WebM, \${(blob.size / 1024 / 1024).toFixed(1)} MB)\`;
      exportBtn.textContent = '🎬 Export Video (WebM)';
      exportBtn.style.background = '';
      exportRunning = false;
    };

    exportRunning = true;
    mediaRecorder.start(100); // 100ms chunks

    exportBtn.textContent = '⏹ Stop Export';
    exportBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    statusEl.textContent = '🔴 Recording... scenes auto-advancing...';
    statusEl.style.color = '#ef4444';

    // Auto-advance scenes while recording
    if (!autoPlaying) {
      toggleAutoPlay();
    }

    // Helper: render current DOM to canvas using SVG foreignObject technique
    async function renderFrame() {
      if (!exportRunning) return;

      try {
        // Serialize the container HTML + computed styles
        const clone = container.cloneNode(true);
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');

        let cssText = '';
        styles.forEach(s => {
          if (s.tagName === 'STYLE') {
            cssText += s.textContent;
          }
        });

        // Get inline computed styles for animations
        const data = \`
          <svg xmlns="http://www.w3.org/2000/svg" width="\${canvas.width}" height="\${canvas.height}">
            <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width:\${W}px;height:\${H}px;">
                <style>\${cssText}</style>
                \${container.innerHTML}
              </div>
            </foreignObject>
          </svg>
        \`;

        const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        await new Promise((resolve, reject) => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
          };
          img.src = url;
        });
      } catch (e) {
        // Fallback: try direct DOM screenshot
        console.warn('SVG render failed:', e);
      }

      if (exportRunning) {
        requestAnimationFrame(renderFrame);
      }
    }

    renderFrame();

    // Auto-stop after going through all scenes once
    const totalDuration = totalScenes * SCENE_DURATION + (totalScenes - 1) * 600; // scenes + transitions
    setTimeout(async () => {
      if (exportRunning) {
        // Wait for current scene to finish
        await new Promise(r => setTimeout(r, SCENE_DURATION));
        stopExport();
      }
    }, totalDuration);
  }

  function stopExport() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.requestData();
      setTimeout(() => {
        mediaRecorder.stop();
        if (autoPlaying) toggleAutoPlay();
        const statusEl = document.getElementById('exportStatus');
        statusEl.style.color = '#10b981';
      }, 200);
    }
    exportRunning = false;
  }
</script>

</body>
</html>`;

// Write the output file
const outPath = path.join(ROOT, 'hu-yang-video.html');
fs.writeFileSync(outPath, html, 'utf8');
const stats = fs.statSync(outPath);
console.log(`✅ Written: ${outPath}`);
console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
console.log(`   Photo embedded as base64 data URI`);
console.log(`   Open in browser: file:///${outPath.replace(/\\/g, '/')}`);
