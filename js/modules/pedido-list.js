// ============================================================
//  pedido-list.js — Sidebar da lista de pedidos do dia
// ============================================================
import { getPedidos, atualizarStatusPedido, cancelarPedido, formatarMoeda, formatarHora, hoje } from '../db.js';
import { imprimirPedido } from './impressao.js';

let _onSelect = null;
let _selectedId = null;
let _filtroStatus = 'todos';

export function initSidebar(onSelectCallback) {
  _onSelect = onSelectCallback;
  renderSidebar();
}

export function refreshSidebar() {
  renderSidebar();
}

function renderSidebar() {
  const container = document.getElementById('sidebar-pedidos');
  if (!container) return;

  const pedidos = getPedidos(hoje()).reverse();
  const filtrados = _filtroStatus === 'todos' ? pedidos : pedidos.filter(p => p.status === _filtroStatus);

  // Totais no header
  const ativos = pedidos.filter(p => p.status !== 'cancelado');
  const total  = ativos.reduce((s, p) => s + (p.total || 0), 0);
  const novos  = pedidos.filter(p => p.status === 'novo' || p.status === 'preparo').length;

  container.innerHTML = `
    <div class="orders-sidebar-header">
      <div>
        <div class="orders-sidebar-title">
          Pedidos hoje
          ${novos > 0 ? `<span class="badge badge-hot ml-1">${novos} ativos</span>` : ''}
        </div>
        <div style="font-size:.78rem;color:var(--text2);font-family:'JetBrains Mono',monospace;margin-top:2px">
          ${ativos.length} pedidos · ${formatarMoeda(total)}
        </div>
      </div>
      <button class="btn-icon" id="btn-refresh-lista" title="Atualizar">↻</button>
    </div>

    <!-- Filtro por status -->
    <div style="padding:8px 10px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--border)">
      ${['todos','novo','preparo','pronto','entregue','cancelado'].map(s => `
        <button class="btn btn-sm ${_filtroStatus === s ? 'btn-primary' : 'btn-ghost'}" data-filtro="${s}">
          ${statusLabel(s)}
        </button>
      `).join('')}
    </div>

    <div class="orders-list">
      ${filtrados.length === 0 ? `
        <div class="empty-state">
          <div class="ico">🍱</div>
          <p>Nenhum pedido ainda</p>
        </div>
      ` : filtrados.map(p => renderOrderCard(p)).join('')}
    </div>
  `;

  // Eventos
  container.querySelector('#btn-refresh-lista')?.addEventListener('click', refreshSidebar);
  container.querySelectorAll('[data-filtro]').forEach(btn => {
    btn.addEventListener('click', () => { _filtroStatus = btn.dataset.filtro; renderSidebar(); });
  });
  container.querySelectorAll('.order-card').forEach(card => {
    card.addEventListener('click', () => {
      _selectedId = card.dataset.id;
      renderSidebar();
      const pedido = pedidos.find(p => p.id === card.dataset.id);
      if (pedido && _onSelect) _onSelect(pedido);
    });
  });
}

function renderOrderCard(p) {
  const tipoIcon = p.tipoEntrega === 'entrega' ? '🛵' : '🏪';
  return `
    <div class="order-card ${p.id === _selectedId ? 'selected' : ''}" data-id="${p.id}">
      <div class="flex items-center gap-2 mb-1">
        <span class="order-num">#${p.numero}</span>
        <span class="badge badge ${statusClass(p.status)}">${statusLabel(p.status)}</span>
        <span style="margin-left:auto;font-size:.8rem">${tipoIcon} ${formatarHora(p.hora)}</span>
      </div>
      <div class="order-cliente">${p.cliente?.nome || 'Balcão'}</div>
      <div class="order-meta">
        <span>${(p.itens || []).length} iten${(p.itens||[]).length !== 1 ? 's' : ''}</span>
        ${p.tipoEntrega === 'entrega' && p.bairro ? `<span>· ${p.bairro}</span>` : ''}
        <span style="margin-left:auto" class="order-total">${formatarMoeda(p.total || 0)}</span>
      </div>
      <div class="flex gap-1 mt-2">
        ${acoesPedido(p)}
      </div>
    </div>
  `;
}

function acoesPedido(p) {
  const btns = [];
  if (p.status === 'novo') btns.push(`<button class="btn btn-sm btn-ghost" data-action="preparo" data-id="${p.id}">🔥 Preparo</button>`);
  if (p.status === 'preparo') btns.push(`<button class="btn btn-sm btn-success" data-action="pronto" data-id="${p.id}">✓ Pronto</button>`);
  if (p.status === 'pronto') btns.push(`<button class="btn btn-sm btn-success" data-action="entregue" data-id="${p.id}">✓ Entregue</button>`);
  btns.push(`<button class="btn btn-sm btn-ghost" data-action="imprimir" data-id="${p.id}" title="Imprimir">🖨️</button>`);
  if (p.status !== 'cancelado' && p.status !== 'entregue') {
    btns.push(`<button class="btn btn-sm btn-danger" data-action="cancelar" data-id="${p.id}" title="Cancelar">✕</button>`);
  }
  setTimeout(() => wireActions(), 0);
  return btns.join('');
}

function wireActions() {
  const container = document.getElementById('sidebar-pedidos');
  if (!container) return;
  container.querySelectorAll('[data-action]').forEach(btn => {
    if (btn._wired) return;
    btn._wired = true;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const pedidos = getPedidos(hoje());
      const pedido  = pedidos.find(p => p.id === id);
      if (!pedido) return;

      if (action === 'imprimir') { imprimirPedido(pedido); return; }
      if (action === 'cancelar') {
        if (confirm(`Cancelar pedido #${pedido.numero}?`)) {
          cancelarPedido(id); renderSidebar();
        }
        return;
      }
      atualizarStatusPedido(id, action);
      renderSidebar();
    });
  });
}

function statusLabel(s) {
  return { todos:'Todos', novo:'Novo', preparo:'Preparo', pronto:'Pronto', entregue:'Entregue', cancelado:'Cancelado' }[s] || s;
}
function statusClass(s) {
  return `status-${s}`;
}
