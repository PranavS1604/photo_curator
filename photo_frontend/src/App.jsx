import { useState, useEffect } from 'react';
import axios from 'axios';
import { GoogleOAuthProvider, GoogleLogin, useGoogleLogin } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_BASE = import.meta.env.VITE_API_BASE_URL;

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Poppins:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-dark: #0f0f12; --bg-panel: #16161a; --bg-card: #1c1c22;
    --gold-primary: #d4af37; --gold-hover: #f1c40f; --gold-dim: rgba(212, 175, 55, 0.1); --gold-border: rgba(212, 175, 55, 0.3);
    --purple-royal: #9d4edd; --purple-light: #c77dff; --purple-dim: rgba(157, 78, 221, 0.1);
    --text-main: #f5f5f7; --text-muted: #a0a0a8;
    --color-vip: #c084fc; --bg-vip: rgba(192, 132, 252, 0.1);
    --color-kept: #34d399; --bg-kept: rgba(52, 211, 153, 0.1);
    --color-bad: #f87171; --bg-bad: rgba(248, 113, 113, 0.1);
    --drive-blue: #4285F4; --drive-dim: rgba(66, 133, 244, 0.1);
  }

  body { background: var(--bg-dark); color: var(--text-main); font-family: 'Inter', sans-serif; min-height: 100vh; overflow-x: hidden; }

  .animated-bg { position: fixed; inset: 0; overflow: hidden; z-index: 0; }
  .animated-bg::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 20% 50%, rgba(212, 175, 55, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(157, 78, 221, 0.1) 0%, transparent 50%); animation: gradientShift 15s ease-in-out infinite; }
  .animated-bg::after { content: ''; position: absolute; inset: 0; background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="20" cy="20" r="2" fill="rgba(212,175,55,0.3)"/><circle cx="80" cy="80" r="1.5" fill="rgba(157,78,221,0.2)"/><circle cx="50" cy="90" r="1" fill="rgba(212,175,55,0.2)"/></svg>'); animation: float 20s linear infinite; opacity: 0.4; }
  @keyframes gradientShift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-20px, -20px); } }
  @keyframes float { 0% { transform: translateX(0) translateY(0); } 100% { transform: translateX(100px) translateY(-100px); } }

  .login-container { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; width: 100vw; background: linear-gradient(135deg, rgba(15, 15, 18, 0.95), rgba(22, 22, 26, 0.95)), radial-gradient(circle at center, rgba(212, 175, 55, 0.08) 0%, var(--bg-dark) 60%); z-index: 1; overflow: hidden; }
  .login-card { position: relative; background: linear-gradient(135deg, var(--bg-card) 0%, #242433 100%); padding: 3.5rem 4rem; border-radius: 20px; border: 1px solid var(--gold-border); box-shadow: 0 20px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(212, 175, 55, 0.2); text-align: center; max-width: 480px; width: 90%; animation: slideUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); backdrop-filter: blur(10px); }
  .login-title { font-family: 'Cinzel', serif; font-size: 2.8rem; margin-bottom: 0.8rem; font-weight: 700; letter-spacing: 0.02em; background: linear-gradient(135deg, var(--text-main) 0%, var(--gold-primary) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .login-title span { color: var(--gold-primary); }
  .login-subtitle { color: var(--text-muted); margin-bottom: 2.5rem; font-size: 1rem; font-weight: 300; letter-spacing: 0.01em; line-height: 1.6; }
  .login-oauth-wrapper { display: flex; justify-content: center; width: 100%; }

  .dashboard { display: flex; width: 100vw; min-height: 100vh; position: relative; z-index: 2; }
  .sidebar { width: 280px; background: linear-gradient(180deg, var(--bg-panel) 0%, #1a1a20 100%); border-right: 1px solid var(--gold-border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; box-shadow: 2px 0 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px); }
  .brand { padding: 2.2rem 1.5rem; border-bottom: 1px solid rgba(212, 175, 55, 0.15); background: linear-gradient(180deg, rgba(212, 175, 55, 0.05) 0%, transparent 100%); }
  .brand-title { font-family: 'Cinzel', serif; font-size: 1.6rem; font-weight: 700; color: var(--text-main); letter-spacing: 0.05em; background: linear-gradient(135deg, var(--gold-primary) 0%, var(--purple-light) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .brand-title span { color: var(--gold-primary); }

  .user-profile { padding: 1.5rem; display: flex; align-items: center; gap: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(212, 175, 55, 0.03); transition: 0.3s; }
  .user-profile:hover { background: rgba(212, 175, 55, 0.06); }
  .user-avatar { width: 45px; height: 45px; border-radius: 50%; border: 2px solid var(--gold-primary); object-fit: cover; box-shadow: 0 0 15px rgba(212, 175, 55, 0.3); }
  .user-info { display: flex; flex-direction: column; }
  .user-name { font-size: 0.9rem; font-weight: 600; letter-spacing: 0.01em; }
  .btn-logout { font-size: 0.75rem; color: var(--color-bad); background: transparent; border: none; text-align: left; cursor: pointer; margin-top: 0.2rem; transition: 0.2s; font-weight: 500; }
  .btn-logout:hover { color: var(--color-bad); text-decoration: underline; opacity: 0.8; }

  .sidebar-content { padding: 1.8rem 1.2rem; flex: 1; overflow-y: auto; }
  .btn-new-album { width: 100%; padding: 1rem; background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(157, 78, 221, 0.15)); border: 2px solid var(--gold-primary); color: var(--gold-primary); border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.3s; margin-bottom: 2.5rem; font-family: 'Poppins', sans-serif; letter-spacing: 0.01em; }
  .btn-new-album:hover { background: linear-gradient(135deg, rgba(212, 175, 55, 0.3), rgba(157, 78, 221, 0.25)); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(212, 175, 55, 0.25); }
  .section-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.2em; color: var(--text-muted); margin-bottom: 1.2rem; font-weight: 700; }
  .album-list { display: flex; flex-direction: column; gap: 0.7rem; }
  .album-item { text-align: left; padding: 1.1rem 1rem; background: rgba(212, 175, 55, 0.03); border: 1px solid transparent; border-radius: 10px; cursor: pointer; transition: 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); font-weight: 500; }
  .album-item:hover { border-color: var(--gold-border); background: rgba(212, 175, 55, 0.08); transform: translateX(4px); }
  .album-item.active { border-color: var(--gold-primary); background: rgba(212, 175, 55, 0.15); box-shadow: inset 0 0 10px rgba(212, 175, 55, 0.1); }
  .album-title { display: block; font-weight: 600; font-size: 0.95rem; margin-bottom: 0.4rem; color: var(--text-main); }
  .album-status { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .album-status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .album-status.completed { color: var(--color-kept); } .album-status.processing { color: var(--gold-primary); animation: pulse 1.5s infinite; }

  .main-canvas { margin-left: 280px; width: calc(100vw - 280px); padding: 3.5rem 4.5rem; background: linear-gradient(180deg, rgba(212, 175, 55, 0.04) 0%, transparent 40%); min-height: 100vh; position: relative; overflow-y: auto; overflow-x: hidden; }

  .upload-container { max-width: 820px; margin: 0 auto; animation: fadeIn 0.6s ease; }
  .view-title { font-family: 'Cinzel', serif; font-size: 2.8rem; margin-bottom: 0.5rem; font-weight: 700; background: linear-gradient(135deg, var(--text-main), var(--gold-primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.01em; }
  .view-subtitle { color: var(--text-muted); font-size: 1.05rem; font-weight: 300; margin-bottom: 3rem; letter-spacing: 0.01em; }
  .upload-card { background: linear-gradient(135deg, var(--bg-card) 0%, #242433 100%); border: 1px solid var(--gold-border); border-radius: 18px; padding: 3rem; box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212, 175, 55, 0.15); backdrop-filter: blur(5px); }
  .field { margin-bottom: 2.2rem; }
  .label { display: block; font-size: 0.9rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.8rem; letter-spacing: 0.01em; }
  .input { width: 100%; padding: 1.1rem 1.4rem; background: rgba(0,0,0,0.3); border: 1.5px solid rgba(212, 175, 55, 0.2); border-radius: 12px; color: #fff; font-size: 1rem; outline: none; transition: 0.3s; font-family: 'Poppins', sans-serif; }
  .input:focus { border-color: var(--gold-primary); box-shadow: 0 0 20px rgba(212, 175, 55, 0.2); background: rgba(0,0,0,0.5); }
  .drop-zone { border: 2px dashed rgba(212, 175, 55, 0.3); border-radius: 16px; padding: 2.5rem; text-align: center; background: rgba(0,0,0,0.2); position: relative; transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); cursor: pointer; }
  .drop-zone:hover, .drop-zone.active { border-color: var(--gold-primary); background: rgba(212, 175, 55, 0.12); transform: scale(1.01); }
  .drop-zone input[type="file"] { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 10; }
  .drop-content { position: relative; z-index: 1; pointer-events: none; }
  .drop-label { color: var(--text-muted); font-size: 1rem; margin: 0.5rem 0; }
  .drop-icon { font-size: 2.5rem; display: block; margin-bottom: 0.8rem; animation: float 3s ease-in-out infinite; }
  .drop-zone.small { padding: 1.8rem; }
  .btn-submit { width: 100%; padding: 1.3rem; background: linear-gradient(135deg, var(--gold-primary), var(--purple-light)); color: var(--bg-dark); border: none; border-radius: 12px; font-size: 1.05rem; font-weight: 700; cursor: pointer; transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); margin-top: 1rem; font-family: 'Poppins', sans-serif; letter-spacing: 0.01em; }
  .btn-submit:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(212, 175, 55, 0.4); }
  .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .target-item { display: flex; gap: 1rem; align-items: center; margin-top: 1rem; background: rgba(0,0,0,0.3); padding: 0.8rem; border-radius: 10px; border: 1px solid rgba(212, 175, 55, 0.15); animation: fadeIn 0.3s ease; }
  .target-item img { width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gold-primary); }
  .target-item input { flex: 1; padding: 0.6rem 1rem; background: rgba(0,0,0,0.5); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 8px; color: #fff; outline: none; transition: 0.3s; font-family: 'Poppins', sans-serif; }
  .target-item input:focus { border-color: var(--gold-primary); }
  .target-item button { background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3); color: var(--color-bad); border-radius: 8px; width: 36px; height: 36px; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; }

  .aperture-container { padding: 2.5rem; background: linear-gradient(135deg, rgba(157, 78, 221, 0.05), rgba(0,0,0,0.6)); border: 1px solid var(--purple-royal); border-radius: 16px; margin-bottom: 2.5rem; box-shadow: 0 10px 40px rgba(157, 78, 221, 0.15); }
  .aperture-title { color: var(--purple-light); margin-bottom: 1.5rem; font-family: 'Cinzel', serif; font-size: 1.6rem; display: flex; align-items: center; gap: 0.8rem; }
  .aperture-line { opacity: 0; animation: fadeInLine 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; line-height: 1.7; color: var(--text-main); margin-bottom: 1rem; font-size: 1.05rem; }

  @keyframes fadeInLine { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

  .gallery-container { width: 100%; animation: fadeIn 0.6s ease; }
  .gallery-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(212, 175, 55, 0.2); padding-bottom: 2rem; margin-bottom: 2.5rem; flex-wrap: wrap; gap: 1.5rem; }

  .header-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
  .btn-action-head { background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(157, 78, 221, 0.08)); border: 1.5px solid rgba(212, 175, 55, 0.3); color: var(--text-main); padding: 0.8rem 1.4rem; border-radius: 10px; cursor: pointer; transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); font-family: 'Poppins', sans-serif; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.6rem; }
  .btn-action-head:hover:not(:disabled) { border-color: var(--gold-primary); background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(157, 78, 221, 0.15)); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(212, 175, 55, 0.25); }
  .btn-drive { color: var(--drive-blue); border-color: rgba(66, 133, 244, 0.4); }
  .btn-delete { color: var(--color-bad); border-color: rgba(248, 113, 113, 0.4); }

  .progress-container { margin-bottom: 3.5rem; background: linear-gradient(135deg, var(--bg-card) 0%, #242433 100%); border: 1px solid var(--gold-border); border-radius: 16px; padding: 2.5rem; box-shadow: 0 15px 40px rgba(0,0,0,0.5); animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .progress-header { display: flex; justify-content: space-between; font-size: 1rem; color: var(--text-main); margin-bottom: 1.5rem; font-weight: 600; letter-spacing: 0.01em; }
  .progress-track { width: 100%; height: 14px; background: rgba(0,0,0,0.4); border-radius: 100px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.8); border: 1px solid rgba(212, 175, 55, 0.2); }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #b5952f, var(--gold-hover)); transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); border-radius: 100px; box-shadow: 0 0 20px var(--gold-primary); }

  .album-stat-row { display: flex; gap: 3.5rem; margin-bottom: 2.5rem; flex-wrap: wrap; }
  .stat-box { display: flex; flex-direction: column; gap: 0.4rem; animation: slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .stat-num { font-family: 'Cinzel', serif; font-size: 3rem; color: var(--text-main); line-height: 1; font-weight: 700; }
  .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; }

  .tabs-container { display: flex; gap: 1.2rem; margin-bottom: 2.5rem; border-bottom: 2px solid rgba(212, 175, 55, 0.15); padding-bottom: 1.2rem; overflow-x: auto; width: 100%; }
  .tab-btn { background: transparent; border: none; color: var(--text-muted); font-size: 0.95rem; font-weight: 600; font-family: 'Poppins', sans-serif; padding: 0.6rem 1.6rem; cursor: pointer; border-radius: 10px; transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; gap: 0.7rem; white-space: nowrap; letter-spacing: 0.01em; }
  .tab-btn:hover { color: var(--text-main); background: rgba(212, 175, 55, 0.08); }
  .tab-btn.active { color: var(--gold-primary); background: rgba(212, 175, 55, 0.15); }
  .tab-count { background: rgba(212, 175, 55, 0.2); padding: 0.25rem 0.7rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700; }
  .tab-btn.active .tab-count { background: var(--gold-primary); color: var(--bg-dark); }

  .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2.5rem; width: 100%; }
  .photo-card { background: linear-gradient(135deg, var(--bg-card) 0%, #242433 100%); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 14px; overflow: hidden; transition: 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); cursor: pointer; position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
  .photo-card:hover { transform: translateY(-8px); box-shadow: 0 20px 45px rgba(212, 175, 55, 0.3); border-color: var(--gold-primary); }
  .photo-card img.main-img { width: 100%; height: 260px; object-fit: cover; display: block; transition: 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); background: #000; }
  .photo-card:hover img.main-img { transform: scale(1.08); }
  .photo-card.dimmed img.main-img { filter: grayscale(50%) brightness(0.6); }
  .card-info { padding: 1.4rem; display: flex; flex-direction: column; gap: 0.9rem; background: linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.4)); position: relative; z-index: 2; }
  .photo-filename { font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .badge { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 700; letter-spacing: 0.08em; width: fit-content; text-transform: uppercase; border: 1.5px solid; }
  .badge.vip { background: rgba(192, 132, 252, 0.15); color: var(--color-vip); border-color: rgba(192, 132, 252, 0.4); }
  .badge.kept { background: rgba(52, 211, 153, 0.15); color: var(--color-kept); border-color: rgba(52, 211, 153, 0.4); }
  .badge.dup { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border-color: rgba(251, 191, 36, 0.4); }
  .badge.blur { background: rgba(96, 165, 250, 0.15); color: #60a5fa; border-color: rgba(96, 165, 250, 0.4); }
  .badge.bad { background: rgba(248, 113, 113, 0.15); color: var(--color-bad); border-color: rgba(248, 113, 113, 0.4); }
  .avatar { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--color-vip); }

  /* == ADVANCED LIGHTBOX UI (Sliding Photo & Side Panel) == */
  .lightbox-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.97); z-index: 100; display: flex; flex-direction: column; animation: fadeIn 0.3s ease; backdrop-filter: blur(5px); overflow: hidden; }
  .lightbox-header { flex-shrink: 0; padding: 1.5rem 2.5rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.5); z-index: 10; border-bottom: 1px solid rgba(212, 175, 55, 0.2); }
  .lightbox-controls { display: flex; gap: 1.2rem; align-items: center; }
  .btn-icon { background: rgba(212, 175, 55, 0.15); border: 1.5px solid rgba(212, 175, 55, 0.4); color: white; width: 44px; height: 44px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); display: flex; align-items: center; justify-content: center; font-weight: 600; }
  .btn-icon:hover { background: rgba(212, 175, 55, 0.3); border-color: var(--gold-primary); transform: scale(1.1); }

  .btn-action { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.4rem; border-radius: 10px; font-family: 'Poppins', sans-serif; font-weight: 700; cursor: pointer; border: 1.5px solid; transition: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); font-size: 0.9rem; letter-spacing: 0.01em; }
  .btn-action.caption-btn { background: rgba(157, 78, 221, 0.15); color: var(--purple-light); border-color: rgba(157, 78, 221, 0.5); }
  .btn-action.caption-btn:hover:not(:disabled) { background: var(--purple-royal); color: #fff; border-color: var(--purple-light); transform: translateY(-2px); }
  .btn-action:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-keep { background: rgba(52, 211, 153, 0.15); color: var(--color-kept); border-color: rgba(52, 211, 153, 0.5); }
  .btn-keep:hover { background: var(--color-kept); color: #000; transform: translateY(-2px); }
  .btn-trash { background: rgba(248, 113, 113, 0.15); color: var(--color-bad); border-color: rgba(248, 113, 113, 0.5); }
  .btn-trash:hover { background: var(--color-bad); color: #000; transform: translateY(-2px); }

  /* Layout for sliding image */
  .lightbox-body-wrapper { flex: 1; display: flex; position: relative; width: 100%; overflow: hidden; }

  .lightbox-img-area { flex: 1; display: flex; align-items: center; justify-content: center; transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); position: relative; padding: 2rem; width: 100%; }
  .lightbox-img-area.shifted { padding-right: 420px; } /* Shrinks the image space to make room for sidebar */

  .lightbox-img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 12px; box-shadow: 0 0 60px rgba(212, 175, 55, 0.4); user-select: none; transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }

  .nav-area { position: absolute; top: 0; bottom: 0; width: 12%; display: flex; align-items: center; cursor: pointer; padding: 0 1.5rem; opacity: 0; transition: 0.3s; z-index: 10; }
  .nav-area:hover { opacity: 1; }
  .nav-left { left: 0; background: linear-gradient(to right, rgba(0,0,0,0.5), transparent); justify-content: flex-start; }
  .nav-right { right: 0; background: linear-gradient(to left, rgba(0,0,0,0.5), transparent); justify-content: flex-end; }

  /* CAPTION SIDEBAR (Sliding in from Right) */
  .caption-sidebar { position: absolute; right: 0; top: 0; bottom: 0; width: 400px; background: rgba(22, 22, 26, 0.95); border-left: 1px solid var(--purple-royal); padding: 2.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem; transform: translateX(100%); transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); z-index: 20; backdrop-filter: blur(15px); box-shadow: -10px 0 40px rgba(0,0,0,0.6); overflow-y: auto; }
  .caption-sidebar.open { transform: translateX(0); }

  .caption-sidebar-header { font-family: 'Cinzel', serif; color: var(--purple-light); font-size: 1.4rem; font-weight: 700; border-bottom: 1px solid rgba(157, 78, 221, 0.3); padding-bottom: 1rem; display: flex; align-items: center; gap: 0.8rem; }

  .caption-card { background: rgba(157, 78, 221, 0.08); border: 1px solid rgba(157, 78, 221, 0.25); border-radius: 12px; padding: 1.5rem; position: relative; animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; opacity: 0; transition: 0.3s; color: var(--text-main); font-size: 0.95rem; line-height: 1.6; padding-right: 3rem; }
  .caption-card:hover { background: rgba(157, 78, 221, 0.15); border-color: var(--purple-light); transform: translateY(-3px); box-shadow: 0 8px 25px rgba(157, 78, 221, 0.2); }

  .copy-btn { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(157, 78, 221, 0.4); border-radius: 6px; color: var(--text-muted); cursor: pointer; padding: 0.4rem; font-size: 0.9rem; transition: 0.3s; display: flex; align-items: center; justify-content: center; }
  .copy-btn:hover { background: var(--purple-royal); color: #fff; border-color: var(--purple-light); }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .spinner-small { width: 16px; height: 16px; border: 2.5px solid rgba(212, 175, 55, 0.3); border-top-color: var(--gold-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.3); border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(212, 175, 55, 0.5); }
`;

function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('upload');
  const [title, setTitle] = useState('');

  const [targetFaces, setTargetFaces] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const [albumId, setAlbumId] = useState(null);
  const [albumData, setAlbumData] = useState(null);
  const [pastAlbums, setPastAlbums] = useState([]);

  const [activeTab, setActiveTab] = useState('vips');
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Agent Chat State (Replacing old Search Bar)
  const [chatQuery, setChatQuery] = useState('');
  const [agentMessage, setAgentMessage] = useState(null);
  const [agentPhotos, setAgentPhotos] = useState([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  // Caption State
  const [lightboxCaptionsArray, setLightboxCaptionsArray] = useState([]);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [showCaptionSidebar, setShowCaptionSidebar] = useState(false);

  const [targetDropActive, setTargetDropActive] = useState(false);
  const [photoDropActive, setPhotoDropActive] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportingDrive, setIsExportingDrive] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user_data');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      fetchHistory();
    }
  }, []);

  axios.interceptors.response.use(
    response => response,
    error => {
      if (error.response && error.response.status === 401) {
        handleLogout();
      }
      return Promise.reject(error);
    }
  );

  const handleLoginSuccess = async (credentialResponse) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/google`, {
        token: credentialResponse.credential
      });
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('user_data', JSON.stringify(res.data.user));
      setUser(res.data.user);
      fetchHistory();
    } catch (e) {
      console.error("Login Failed", e);
      alert("Authentication failed.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_data');
    setUser(null);
    setPastAlbums([]);
    setAlbumData(null);
  };

  useEffect(() => {
    let interval;
    if (user && albumId && albumData?.processing_status !== 'completed') {
      interval = setInterval(() => { loadOldAlbum(albumId, true); }, 2000);
    }
    return () => clearInterval(interval);
  }, [albumId, albumData?.processing_status, user]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/albums/`);
      setPastAlbums(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
  };

  const loadOldAlbum = async (id, isSilentPoll = false) => {
    if (!isSilentPoll) {
      setAlbumId(id);
      setCurrentView('gallery');
      setActiveTab('vips');
      setAgentMessage(null);
      setAgentPhotos([]);
      setChatQuery('');
    }
    try {
      const res = await axios.get(`${API_BASE}/albums/${id}`);
      setAlbumData(res.data || null);

      if (!isSilentPoll && res.data?.results) {
        const vips = res.data.results.filter(p => p.has_target_face);
        if (vips.length === 0) setActiveTab('kept');
      }

      if (res.data?.processing_status === 'completed' && isSilentPoll) {
        fetchHistory();
      }
    } catch (e) { console.error(e); }
  };

  const handleAskAperture = async () => {
    if(!chatQuery.trim()) return;
    setIsAgentThinking(true);
    setAgentMessage(null);
    setAgentPhotos([]);
    try {
      const url = `${API_BASE}/albums/${albumId}/curator-chat`;
      const res = await axios.post(url, { message: chatQuery });
      setAgentMessage(res.data.agent_reply);
      setAgentPhotos(res.data.photos);
      setActiveTab('agent'); // Auto-switch to agent results!
    } catch (e) {
      console.error("Aperture AI Error:", e);
      alert("Aperture AI failed to respond.");
    } finally {
      setIsAgentThinking(false);
    }
  };

  const generateCaptionForLightbox = async (photoId) => {
    setIsGeneratingCaption(true);
    setShowCaptionSidebar(true);
    setLightboxCaptionsArray([]);
    try {
      const url = `${API_BASE}/photos/${photoId}/generate-caption`;
      const response = await axios.post(url);

      // Parse the clean 1., 2., 3. list from our strict prompt
      const rawText = response.data.captions;
      const splitArray = rawText.split(/\d+\.\s*/).filter(c => c.trim().length > 0);
      setLightboxCaptionsArray(splitArray.length > 0 ? splitArray : [rawText]);

    } catch (error) {
      console.error("Failed to generate captions", error);
      setLightboxCaptionsArray(["Failed to generate captions. Please try again."]);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const processTargetFiles = (files) => {
    const newFaces = Array.from(files).map((f, i) => ({
      id: Date.now() + i,
      file: f,
      customName: f.name.split('.')[0]
    }));
    setTargetFaces(prev => [...prev, ...newFaces]);
  };

  const handleTargetNameChange = (id, newName) => {
    setTargetFaces(prev => prev.map(face => face.id === id ? { ...face, customName: newName } : face));
  };

  const removeTargetFace = (id) => {
    setTargetFaces(prev => prev.filter(face => face.id !== id));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title || !photos || photos.length === 0) return;
    setIsUploading(true);

    try {
      const albumForm = new FormData();
      albumForm.append('title', title);

      if (targetFaces && targetFaces.length > 0) {
        for (let i = 0; i < targetFaces.length; i++) {
          const faceObj = targetFaces[i];
          const ext = faceObj.file.name.split('.').pop() || 'jpg';
          const safeName = faceObj.customName.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/ /g, '_') || 'VIP';
          const renamedFile = new File([faceObj.file], `${safeName}.${ext}`, { type: faceObj.file.type });
          albumForm.append('target_faces', renamedFile);
        }
      }

      const albumRes = await axios.post(`${API_BASE}/albums/`, albumForm);
      const newId = albumRes.data.album_id;
      setAlbumId(newId);

      const photoForm = new FormData();
      for (let i = 0; i < photos.length; i++) {
        if(photos[i]?.name) photoForm.append('files', photos[i]);
      }
      await axios.post(`${API_BASE}/albums/${newId}/upload-photos/`, photoForm);

      fetchHistory();
      loadOldAlbum(newId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
      setTitle(''); setPhotos([]); setTargetFaces([]); setFormKey(prev => prev + 1);
    }
  };

  const handleOverride = async (photoId, newDecision, isBlurry = false, isDuplicate = false) => {
    try {
      await axios.patch(`${API_BASE}/photos/${photoId}/status`, {
        decision: newDecision,
        is_blurry: isBlurry,
        is_duplicate: isDuplicate
      });
      loadOldAlbum(albumId, true);
      handleNextPhoto();
    } catch (e) { console.error("Failed to update status", e); }
  };

  const handleDeleteAlbum = async () => {
    const isConfirmed = window.confirm("Are you sure you want to delete this album? All photos will be permanently removed.");
    if (!isConfirmed) return;
    try {
      await axios.delete(`${API_BASE}/albums/${albumId}`);
      setAlbumId(null);
      setAlbumData(null);
      setCurrentView('upload');
      fetchHistory();
    } catch (e) { console.error(e); }
  };

  const handleLocalDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await axios.get(`${API_BASE}/albums/${albumId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Curated_${albumData.title.replace(' ', '_')}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download ZIP.");
    } finally {
      setIsDownloading(false);
    }
  };

  const triggerGoogleDriveAuth = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.file',
    onSuccess: async (tokenResponse) => {
      setIsExportingDrive(true);
      try {
        await axios.post(`${API_BASE}/albums/${albumId}/export-drive`, {
          access_token: tokenResponse.access_token
        });
        alert("Success! Your curated photos have been saved to your Google Drive.");
      } catch (error) {
        console.error("Drive Export Failed:", error);
        alert("Failed to export to Google Drive.");
      } finally {
        setIsExportingDrive(false);
      }
    },
    onError: () => alert('Google Drive authentication failed.'),
  });

  const handleDragOver = (e, setter) => { e.preventDefault(); setter(true); };
  const handleDragLeave = (e, setter) => { e.preventDefault(); setter(false); };
  const handleDropPhotos = (e) => {
    e.preventDefault(); setPhotoDropActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { setPhotos(e.dataTransfer.files); }
  };
  const handleDropTargets = (e) => {
    e.preventDefault(); setTargetDropActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { processTargetFiles(e.dataTransfer.files); }
  };

  const allPhotos = Array.isArray(albumData?.results) ? albumData.results : [];
  const safePastAlbums = Array.isArray(pastAlbums) ? pastAlbums : [];
  const totalPhotos = albumData?.total_photos || 0;

  const processedCount = allPhotos.filter(p => p?.decision === 'kept' || p?.decision === 'trash').length;
  const progressPercent = totalPhotos > 0 ? Math.round((processedCount / totalPhotos) * 100) : 0;

  const targetMatches = allPhotos.filter(p => p?.has_target_face === true);
  const generalKeepers = allPhotos.filter(p => p?.decision === 'kept' && !p?.has_target_face);
  const duplicates = allPhotos.filter(p => p?.is_duplicate === true);
  const blurryPhotos = allPhotos.filter(p => p?.is_blurry === true && !p?.is_duplicate);
  const blinkPhotos = allPhotos.filter(p => p?.decision === 'trash' && !p?.is_blurry && !p?.is_duplicate);

  const getActivePhotos = () => {
    switch(activeTab) {
      case 'vips': return targetMatches;
      case 'kept': return generalKeepers;
      case 'duplicates': return duplicates;
      case 'blurry': return blurryPhotos;
      case 'bad': return blinkPhotos;
      case 'agent': return agentPhotos || [];
      default: return [];
    }
  };
  const activePhotos = getActivePhotos();

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxCaptionsArray([]);
    setShowCaptionSidebar(false);
  };
  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxCaptionsArray([]);
    setShowCaptionSidebar(false);
  };

  const handleNextPhoto = () => {
    if (activePhotos.length <= 1) return closeLightbox();
    setLightboxIndex((prev) => (prev + 1) % activePhotos.length);
    setLightboxCaptionsArray([]);
    setShowCaptionSidebar(false);
  };
  const handlePrevPhoto = () => {
    if (activePhotos.length <= 1) return closeLightbox();
    setLightboxIndex((prev) => (prev - 1 + activePhotos.length) % activePhotos.length);
    setLightboxCaptionsArray([]);
    setShowCaptionSidebar(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') handleNextPhoto();
      if (e.key === 'ArrowLeft') handlePrevPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, activePhotos]);

  if (!user) {
    return (
      <>
        <style>{styles}</style>
        <div className="animated-bg" />
        <div className="login-container">
          <div className="login-card">
            <h1 className="login-title">Smart Photo <span>Curator</span></h1>
            <p className="login-subtitle">Sign in to securely access your personal AI curation dashboard.</p>
            <div className="login-oauth-wrapper">
              <GoogleLogin onSuccess={handleLoginSuccess} onError={() => console.log('Login Failed')} theme="filled_black" shape="rectangular" size="large" />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="animated-bg" />
      <div className="dashboard">
        <aside className="sidebar">
          <div className="brand">
            <h1 className="brand-title">Smart Photo <span>Curator</span></h1>
          </div>
          <div className="user-profile">
            <img src={user.picture || 'https://via.placeholder.com/40'} alt="Profile" className="user-avatar" />
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <button className="btn-logout" onClick={handleLogout}>Logout</button>
            </div>
          </div>
          <div className="sidebar-content">
            <button className="btn-new-album" onClick={() => { setCurrentView('upload'); setAlbumId(null); }}>
              + Start New Curation
            </button>
            {safePastAlbums.length > 0 && (
              <>
                <div className="section-label">Your Library</div>
                <div className="album-list">
                  {safePastAlbums.map(album => (
                    <button key={album?.id} className={`album-item ${albumId === album?.id ? ' active' : ''}`} onClick={() => loadOldAlbum(album.id)}>
                      <span className="album-title">{album?.title || 'Untitled'}</span>
                      <span className={`album-status ${album?.status || 'pending'}`}>{album?.status || 'pending'}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>

        <main className="main-canvas">
          {currentView === 'upload' && (
            <div className="upload-container">
              <div className="view-title">New Curation Job</div>
              <p className="view-subtitle">Upload your raw event dump and let the AI find the masterpieces.</p>
              <div className="upload-card">
                <form key={formKey} onSubmit={handleUpload}>
                  <div className="field">
                    <label className="label">Album/Event Title</label>
                    <input className="input" type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Ski Trip in the Alps 2026" />
                  </div>

                  <div className="field">
                    <label className="label">VIP Targets (Optional)</label>
                    <div className={`drop-zone small ${targetDropActive ? ' active' : ''}`} onDragOver={(e) => handleDragOver(e, setTargetDropActive)} onDragLeave={(e) => handleDragLeave(e, setTargetDropActive)} onDrop={handleDropTargets}>
                      <input type="file" multiple accept="image/*" onChange={e => processTargetFiles(e.target.files)} />
                      <div className="drop-content">
                        <div className="drop-label">Drop reference selfies here, then type their names below!</div>
                      </div>
                    </div>
                    {targetFaces.length > 0 && (
                      <div style={{ marginTop: '1.5rem' }}>
                        <div className="label" style={{ fontSize: '0.8rem', color: 'var(--purple-light)' }}>Name your targets so the AI recognizes them:</div>
                        {targetFaces.map((face) => (
                          <div key={face.id} className="target-item">
                            <img src={URL.createObjectURL(face.file)} alt="Preview" />
                            <input type="text" value={face.customName} onChange={(e) => handleTargetNameChange(face.id, e.target.value)} placeholder="Enter person's name..." required />
                            <button type="button" onClick={() => removeTargetFace(face.id)}>✖</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="field" style={{marginTop: '2.5rem'}}>
                    <label className="label">Raw Event Photos</label>
                    <div className={`drop-zone ${photoDropActive ? ' active' : ''}`} onDragOver={(e) => handleDragOver(e, setPhotoDropActive)} onDragLeave={(e) => handleDragLeave(e, setPhotoDropActive)} onDrop={handleDropPhotos}>
                      <input type="file" multiple accept="image/*" onChange={e => setPhotos(e.target.files)} required />
                      <div className="drop-content">
                        <span className="drop-icon">📂</span>
                        <div className="drop-label">Click to browse or drag massive folders here</div>
                        {photos?.length > 0 && <span style={{color:'var(--color-kept)', fontSize:'1.2rem', display:'block', marginTop:'1rem', fontWeight:'600'}}>✓ {photos.length} photos ready</span>}
                      </div>
                    </div>
                  </div>
                  <button className="btn-submit" type="submit" disabled={isUploading || !photos?.length || !title}>
                    {isUploading ? 'Processing...' : '✨ Start AI Curation Pipeline'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {currentView === 'gallery' && albumData && (
            <div className="gallery-container">
              {/* <div className="gallery-header">
                <h2 className="view-title" style={{margin: 0}}>{albumData?.title || 'Album'}</h2>

                {albumData?.processing_status === 'completed' && (
                  <div className="header-actions">
                    <button className="btn-action-head" onClick={handleLocalDownload} disabled={isDownloading}>
                      {isDownloading ? <span className="spinner-small" /> : '⬇️'} {isDownloading ? 'Zipping...' : 'Download Zip'}
                    </button>
                    <button className="btn-action-head btn-drive" onClick={() => triggerGoogleDriveAuth()} disabled={isExportingDrive}>
                      {isExportingDrive ? <span className="spinner-small" /> : '☁️'} {isExportingDrive ? 'Uploading...' : 'Save to Drive'}
                    </button>
                    <button className="btn-action-head btn-delete" onClick={handleDeleteAlbum}>
                      🗑️ Delete
                    </button>
                  </div>
                )}
              </div> */}
              <div className="gallery-header">
                <h2 className="view-title" style={{margin: 0}}>{albumData?.title || 'Album'}</h2>

                <div className="header-actions">
                  {/* Only show Download & Drive buttons IF completed */}
                  {albumData?.processing_status === 'completed' && (
                    <>
                      <button className="btn-action-head" onClick={handleLocalDownload} disabled={isDownloading}>
                        {isDownloading ? <span className="spinner-small" /> : '⬇️'} {isDownloading ? 'Zipping...' : 'Download Zip'}
                      </button>
                      <button className="btn-action-head btn-drive" onClick={() => triggerGoogleDriveAuth()} disabled={isExportingDrive}>
                        {isExportingDrive ? <span className="spinner-small" /> : '☁️'} {isExportingDrive ? 'Uploading...' : 'Save to Drive'}
                      </button>
                    </>
                  )}
                  
                  {/* ALWAYS show the Delete button so we can kill stuck albums */}
                  <button className="btn-action-head btn-delete" onClick={handleDeleteAlbum}>
                    🗑️ Delete
                  </button>
                </div>
              </div>

              {/* APERTURE AI CHAT BLOCK */}
              {albumData?.processing_status === 'completed' && (
                <div style={{marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--purple-royal)', boxShadow: '0 4px 15px rgba(157, 78, 221, 0.1)'}}>
                  <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
                    <input
                      type="text"
                      value={chatQuery}
                      onChange={(e) => setChatQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskAperture()}
                      placeholder="Ask Aperture AI (e.g., 'Find photos of us laughing at sunset')"
                      style={{flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid var(--purple-dim)', backgroundColor: 'var(--bg-dark)', color: 'white'}}
                    />
                    <button
                      onClick={handleAskAperture}
                      disabled={isAgentThinking || !chatQuery.trim()}
                      style={{padding: '0 2rem', backgroundColor: isAgentThinking ? 'var(--text-muted)' : 'var(--purple-royal)', color: 'white', border: 'none', borderRadius: '8px', cursor: isAgentThinking ? 'not-allowed' : 'pointer', fontWeight: 'bold'}}
                    >
                      {isAgentThinking ? 'Thinking...' : '✨ Ask'}
                    </button>
                  </div>

                  {agentMessage && (
                    <div className="aperture-container" style={{marginBottom: 0}}>
                      <h3 className="aperture-title">✨ Aperture AI</h3>
                      <div className="aperture-line">{agentMessage}</div>
                    </div>
                  )}
                </div>
              )}

              {albumData?.processing_status !== 'completed' ? (
                <div className="progress-container">
                  <div className="progress-header">
                    <span>⚙️ AI Neural Networks Processing...</span>
                    <span style={{color: 'var(--gold-primary)', fontWeight: 'bold'}}>{progressPercent}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.8rem', textAlign: 'right' }}>
                    Evaluated {processedCount} of {totalPhotos} images
                  </div>
                </div>
              ) : (
                <>
                  <div className="album-stat-row">
                    <div className="stat-box">
                      <span className="stat-num">{totalPhotos}</span>
                      <span className="stat-label">Total Evaluated</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-num" style={{color: 'var(--color-kept)'}}>{targetMatches.length + generalKeepers.length}</span>
                      <span className="stat-label">Total Keepers</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-num" style={{color: 'var(--color-bad)'}}>{duplicates.length + blurryPhotos.length + blinkPhotos.length}</span>
                      <span className="stat-label">Trashed by AI</span>
                    </div>
                  </div>

                  <div className="tabs-container">
                    {agentPhotos.length > 0 && (
                      <button className={`tab-btn ${activeTab === 'agent' ? 'active' : ''}`} onClick={() => setActiveTab('agent')} style={{color: 'var(--purple-light)'}}>✨ AI Results</button>
                    )}
                    <button className={`tab-btn ${activeTab === 'vips' ? 'active' : ''}`} onClick={() => setActiveTab('vips')}>VIPs <span className="tab-count">{targetMatches.length}</span></button>
                    <button className={`tab-btn ${activeTab === 'kept' ? 'active' : ''}`} onClick={() => setActiveTab('kept')}>Keepers <span className="tab-count">{generalKeepers.length}</span></button>
                    <button className={`tab-btn ${activeTab === 'duplicates' ? 'active' : ''}`} onClick={() => setActiveTab('duplicates')}>Duplicates <span className="tab-count">{duplicates.length}</span></button>
                    <button className={`tab-btn ${activeTab === 'blurry' ? 'active' : ''}`} onClick={() => setActiveTab('blurry')}>Blurry <span className="tab-count">{blurryPhotos.length}</span></button>
                    <button className={`tab-btn ${activeTab === 'bad' ? 'active' : ''}`} onClick={() => setActiveTab('bad')}>Blinks & Bad <span className="tab-count">{blinkPhotos.length}</span></button>
                  </div>

                  {activePhotos.length === 0 ? (
                    <div style={{padding: '3rem', textAlign: 'center', color: 'var(--text-muted)'}}>
                      No photos in this category.
                    </div>
                  ) : (
                    <div className="photo-grid">
                      {activePhotos.map((photo, idx) => {
                        if(!photo) return null;
                        const isSearchResult = photo.file_path && !photo.decision;
                        const cleanName = photo.matched_target_path ? photo.matched_target_path.replace(/^target_\d+_/, '').split('.')[0] : 'MATCH';
                        const imgSrc = isSearchResult
                          ? photo.file_path.startsWith('http') ? photo.file_path : `${API_BASE}/${photo.file_path}`
                          : `${API_BASE}/uploads/${albumId}/${photo.filename}`;
                        const title = photo.filename;

                        return (
                          <div className={`photo-card ${photo.decision === 'trash' ? 'dimmed' : ''}`} key={photo.id || photo.photo_id} onClick={() => openLightbox(idx)}>
                            <img className="main-img" src={imgSrc} alt={title} loading="lazy" />
                            <div className="card-info">
                              <span className="photo-filename">{title}</span>
                              {isSearchResult && photo.ai_description && (
                                <span className="badge kept" style={{fontSize: '0.8rem'}}>{photo.ai_description.substring(0, 50)}...</span>
                              )}
                              {!isSearchResult && activeTab === 'vips' && (
                                <span className="badge vip">
                                  {photo.matched_target_path && <img className="avatar" src={`${API_BASE}/uploads/${albumId}/${photo.matched_target_path}`} alt="VIP" onError={(e) => { e.target.style.display = 'none'; }}/>}
                                  🎯 {cleanName.replace(/_/g, ' ')}
                                </span>
                              )}
                              {!isSearchResult && activeTab === 'kept' && <span className="badge kept">✨ QUALITY SHOT</span>}
                              {!isSearchResult && activeTab === 'duplicates' && <span className="badge dup">👯 DUPLICATE</span>}
                              {!isSearchResult && activeTab === 'blurry' && <span className="badge blur">💧 BLURRY ({Math.round(photo.sharpness_score || 0)})</span>}
                              {!isSearchResult && activeTab === 'bad' && <span className="badge bad">👁️ BAD ANGLE/BLINK</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {lightboxIndex !== null && activePhotos[lightboxIndex] && (
        <div className="lightbox-overlay">
          <div className="lightbox-header">
            <div className="photo-filename" style={{fontSize: '1.1rem', color: 'white'}}>
              {activePhotos[lightboxIndex].filename}
              <span style={{marginLeft:'1rem', color:'var(--text-muted)'}}>({lightboxIndex + 1} / {activePhotos.length})</span>
            </div>
            <div className="lightbox-controls">

              <button
                className="btn-action caption-btn"
                onClick={() => generateCaptionForLightbox(activePhotos[lightboxIndex].id || activePhotos[lightboxIndex].photo_id)}
                disabled={isGeneratingCaption || showCaptionSidebar}
              >
                {isGeneratingCaption ? <span className="spinner-small" /> : '✨'} {isGeneratingCaption ? 'Writing...' : 'Generate Caption'}
              </button>

              {activePhotos[lightboxIndex].decision === 'trash' ? (
                <button className="btn-action btn-keep" onClick={() => handleOverride(activePhotos[lightboxIndex].photo_id, 'kept', false, false)}>✨ Restore</button>
              ) : (
                <button className="btn-action btn-trash" onClick={() => handleOverride(activePhotos[lightboxIndex].photo_id, 'trash', false, false)}>🗑️ Trash</button>
              )}
              <button className="btn-icon" onClick={closeLightbox}>✕</button>
            </div>
          </div>

          <div className="lightbox-body-wrapper">
            <div className="nav-area nav-left" onClick={(e) => { e.stopPropagation(); handlePrevPhoto(); }}><button className="btn-icon">⬅</button></div>

            <div className={`lightbox-img-area ${showCaptionSidebar ? 'shifted' : ''}`} onClick={closeLightbox}>
              <img src={activePhotos[lightboxIndex].file_path && activePhotos[lightboxIndex].file_path.startsWith('http') ? activePhotos[lightboxIndex].file_path : `${API_BASE}/uploads/${albumId}/${activePhotos[lightboxIndex].filename}`} alt="Fullscreen" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
            </div>

            <div className="nav-area nav-right" onClick={(e) => { e.stopPropagation(); handleNextPhoto(); }}><button className="btn-icon">➡</button></div>

            {/* NEW SLIDING SIDEBAR FOR CAPTIONS */}
            <div className={`caption-sidebar ${showCaptionSidebar ? 'open' : ''}`}>
              <div className="caption-sidebar-header">
                ✨ Aperture AI Captions
              </div>

              {isGeneratingCaption ? (
                <div style={{color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem'}}>
                  <div className="spinner-small" style={{margin: '0 auto 1rem auto', width: '30px', height: '30px', borderWidth: '3px'}}></div>
                  <p>Analyzing image context...</p>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {lightboxCaptionsArray.map((caption, idx) => (
                    <div key={idx} className="caption-card" style={{ animationDelay: `${idx * 0.1}s` }}>
                      <button className="copy-btn" onClick={() => copyToClipboard(caption)} title="Copy to clipboard">
                        📋
                      </button>
                      {caption}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function WrappedApp() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}