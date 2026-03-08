// ============================================================
//  utils.js — Funções utilitárias globais
// ============================================================

export function toast(msg, tipo = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toast-out .2s ease forwards';
    setTimeout(() => t.remove(), 200);
  }, 2800);
}