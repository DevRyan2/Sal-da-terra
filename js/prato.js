// ============================================================
//  prato.js — Aba Prato Feito
// ============================================================
import { getCardapio, saveCardapio, novoPedido, formatarMoeda, registrarPedidoNoCliente, hoje } from '../db.js';
import { abrirModalCliente } from './cliente.js';
import { refreshSidebar } from '../modules/pedido-list.js';
import { imprimirPedido } from '../modules/impressao.js';
import { toast } from '../utils.js';

const OBS_RAPIDAS = ['Sem cebola','Sem alho','Sem pimenta','Pouco sal','Bem passado','Mal passado','Capricha','Porção extra'];

let _cart    = [];
let _cliente = null;
let _entrega = null;

export function renderPrato() {
  const el = document.getElementById('tab-prato');
  if (!el) return;
  const cardapio = getCardapio(hoje());
  const pratos   = cardapio.pratos || [];

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="dot"></span>Pratos do Dia</div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" id="btn-add-prato">+ Adicionar prato</button>
        </div>
      </div>

      ${pratos.length === 0 ? `
        <div class="empty-state">
          <div class="ico">🍽️</div>
          <p>Nenhum prato cadastrado hoje.<br>Clique em "+ Adicionar prato" para começar.</p>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:10px" id="lista-pratos">
          ${pratos.map(p => renderPratoCard(p)).join('')}
        </div>
      `}
    </div>

    <!-- Observações -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="dot"></span>Observações</div>
      </div>
      <div class="obs-chips mb-2" id="obs-chips-prato">
        ${OBS_RAPIDAS.map(o => `<span class="obs-chip" data-obs="${o}">${o}</span>`).join('')}
      </div>
      <textarea class="input textarea" id="obs-livre-prato" rows="2" placeholder="Observação livre..."></textarea>
    </div>

    <!-- Cliente -->
    <div class="card">
      <div class="card-header"><div class="card-title"><span class="dot"></span>Cliente & Entrega</div></div>
      <div id="cliente-resumo-prato">
        <button class="btn btn-ghost btn-full" id="btn-cliente-prato">👤 Selecionar / Cadastrar cliente</button>
      </div>
    </div>

    <!-- Pagamento -->
    <div class="card">
      <div class="card-header"><div class="card-title"><span class="dot"></span>Pagamento</div></div>
      <div class="payment-opts" id="payment-opts-prato">
        ${['Pix','Dinheiro','Cartão Débito','Cartão Crédito'].map(f => `
          <div class="payment-opt" data-forma="${f}">
            <div class="ico">${payIcon(f)}</div>
            <div class="lab">${f}</div>
          </div>
        `).join('')}
      </div>
      <div id="troco-block-prato" class="hidden mt-2">
        <div class="field"><label>Pagou com quanto?</label>
        <input class="input" id="input-pago-prato" type="number" placeholder="50.00"></div>
      </div>
    </div>
  `;

  renderCartPrato();

  // Eventos
  el.querySelector('#btn-add-prato')?.addEventListener('click', () => abrirFormNovoPrato());
  el.querySelectorAll('.obs-chip').forEach(c => c.addEventListener('click', () => c.classList.toggle('selected')));
  el.querySelector('#btn-cliente-prato')?.addEventListener('click', selecionarCliente);
  el.querySelectorAll('.payment-opt').forEach(o => {
    o.addEventListener('click', () => {
      el.querySelectorAll('.payment-opt').forEach(x => x.classList.remove('selected'));
      o.classList.add('selected');
      const tb = el.querySelector('#troco-block-prato');
      if (o.dataset.forma === 'Dinheiro') tb.classList.remove('hidden');
      else tb.classList.add('hidden');
    });
  });
}

function renderPratoCard(prato) {
  return `
    <div class="card" style="padding:12px">
      <div class="flex items-center gap-2">
        <div style="flex:1">
          <div style="font-weight:700">${prato.nome}</div>
          ${prato.descricao ? `<div style="font-size:.82rem;color:var(--text2)">${prato.descricao}</div>` : ''}
          <div style="font-family:'JetBrains Mono',monospace;color:var(--accent);font-weight:600;margin-top:2px">${formatarMoeda(prato.preco)}</div>
        </div>
        <div class="flex gap-2 items-center">
          ${!prato.disponivel ? '<span class="badge badge-hot">Esgotado</span>' : ''}
          <div class="qty-stepper">
            <button class="qty-btn btn-prato-minus" data-id="${prato.id}">−</button>
            <div class="qty-num" id="qty-prato-${prato.id}">1</div>
            <button class="qty-btn btn-prato-plus" data-id="${prato.id}">+</button>
          </div>
          <button class="btn btn-primary btn-sm btn-add-prato-item" data-id="${prato.id}" ${!prato.disponivel ? 'disabled style="opacity:.4"' : ''}>
            + Add
          </button>
          <button class="btn-icon btn-toggle-prato" data-id="${prato.id}" title="${prato.disponivel ? 'Marcar como esgotado' : 'Disponibilizar'}">
            ${prato.disponivel ? '✓' : '✕'}
          </button>
        </div>
      </div>
    </div>
  `;
}

// Qtds por prato
const _qtds = {};

function getQtdEl(id) { return document.getElementById(`qty-prato-${id}`); }
function getQtd(id) { return _qtds[id] || 1; }
function setQtd(id, v) { _qtds[id] = Math.max(1, v); const el = getQtdEl(id); if (el) el.textContent = _qtds[id]; }

export function wirePratoEvents() {
  const el = document.getElementById('tab-prato');
  if (!el) return;
  el.querySelectorAll('.btn-prato-minus').forEach(b => b.addEventListener('click', () => setQtd(b.dataset.id, getQtd(b.dataset.id) - 1)));
  el.querySelectorAll('.btn-prato-plus').forEach(b  => b.addEventListener('click', () => setQtd(b.dataset.id, getQtd(b.dataset.id) + 1)));
  el.querySelectorAll('.btn-add-prato-item').forEach(b => b.addEventListener('click', () => {
    const cardapio = getCardapio(hoje());
    const prato = cardapio.pratos.find(p => p.id === b.dataset.id);
    if (!prato) return;
    const qty = getQtd(b.dataset.id);
    const obsChips = [...el.querySelectorAll('.obs-chip.selected')].map(c => c.dataset.obs);
    const obsLivre = el.querySelector('#obs-livre-prato')?.value.trim() || '';
    const obs = [...obsChips, ...(obsLivre ? [obsLivre] : [])].join(', ');
    _cart.push({ id: Date.now().toString(36), tipo: 'prato', nome: prato.nome, preco: prato.preco, qty, obs });
    setQtd(b.dataset.id, 1);
    renderCartPrato();
    toast(`${prato.nome} adicionado!`);
  }));
  el.querySelectorAll('.btn-toggle-prato').forEach(b => b.addEventListener('click', () => {
    const cardapio = getCardapio(hoje());
    const p = cardapio.pratos.find(x => x.id === b.dataset.id);
    if (p) { p.disponivel = !p.disponivel; saveCardapio(hoje(), cardapio); renderPrato(); wirePratoEvents(); }
  }));
}

function abrirFormNovoPrato() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">+ Novo Prato</div>
        <button class="modal-close" id="close-np">✕</button>
      </div>
      <div class="field-row field-row-2 mb-3">
        <div class="field"><label>Nome *</label><input class="input" id="np-nome" placeholder="Ex: Frango à Milanesa"></div>
        <div class="field"><label>Preço *</label><input class="input" id="np-preco" type="number" placeholder="25.00"></div>
      </div>
      <div class="field mb-3"><label>Descrição</label><input class="input" id="np-desc" placeholder="Acompanha arroz e feijão"></div>
      <div class="field-row field-row-2 mb-3">
        <div class="field"><label>Qtd máxima (0 = ilimitado)</label><input class="input" id="np-max" type="number" placeholder="0" value="0"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="cancel-np">Cancelar</button>
        <button class="btn btn-primary" id="save-np">Salvar prato</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#close-np').onclick = overlay.querySelector('#cancel-np').onclick = () => overlay.remove();
  overlay.querySelector('#save-np').onclick = () => {
    const nome  = overlay.querySelector('#np-nome').value.trim();
    const preco = parseFloat(overlay.querySelector('#np-preco').value || 0);
    const desc  = overlay.querySelector('#np-desc').value.trim();
    const max   = parseInt(overlay.querySelector('#np-max').value || 0);
    if (!nome || !preco) { toast('Preencha nome e preço', 'warn'); return; }
    const cardapio = getCardapio(hoje());
    cardapio.pratos.push({ id: Date.now().toString(36), nome, preco, descricao: desc, max, vendidos: 0, disponivel: true });
    saveCardapio(hoje(), cardapio);
    overlay.remove();
    renderPrato(); wirePratoEvents();
    toast(`Prato "${nome}" adicionado!`);
  };
}

async function selecionarCliente() {
  const r = await abrirModalCliente(_cliente);
  if (r) { _cliente = r.cliente; _entrega = r; renderClientePrato(); renderCartPrato(); }
}

function renderClientePrato() {
  const el = document.getElementById('cliente-resumo-prato');
  if (!el || !_cliente) return;
  const { cliente, tipoEntrega, bairro, taxaEntrega } = _entrega || {};
  el.innerHTML = `
    <div class="cliente-card">
      <div class="cliente-avatar">${(cliente.nome || 'B').charAt(0).toUpperCase()}</div>
      <div class="cliente-info">
        <div class="cliente-nome">${cliente.nome || 'Balcão'}</div>
        <div style="font-size:.8rem;margin-top:2px">${tipoEntrega === 'entrega' ? `🛵 ${bairro} (+${formatarMoeda(taxaEntrega)})` : '🏪 Retirada'}</div>
      </div>
      <button class="btn-icon" id="btn-trocar-prato">✏️</button>
    </div>
  `;
  el.querySelector('#btn-trocar-prato')?.addEventListener('click', selecionarCliente);
}

function renderCartPrato() {
  const sidebar = document.getElementById('cart-sidebar');
  if (!sidebar) return;

  const subtotal    = _cart.reduce((s, it) => s + it.preco * (it.qty || 1), 0);
  const taxaEntrega = _entrega?.taxaEntrega || 0;
  const total       = subtotal + taxaEntrega;

  sidebar.innerHTML = `
    <div class="orders-sidebar-header">
      <div class="orders-sidebar-title">🛒 Carrinho <span class="badge badge-accent">${_cart.length}</span></div>
      ${_cart.length ? `<button class="btn-icon" id="btn-limpar-prato">🗑</button>` : ''}
    </div>
    <div class="cart">
      ${_cart.length === 0 ? `<div class="empty-state"><div class="ico">🛒</div><p>Selecione um prato</p></div>` :
        _cart.map((it, i) => `
          <div class="cart-item">
            <div class="cart-item-qty">${it.qty}×</div>
            <div class="cart-item-info">
              <div class="cart-item-nome">${it.nome}</div>
              ${it.obs ? `<div style="font-size:.75rem;color:var(--accent);font-style:italic">${it.obs}</div>` : ''}
            </div>
            <div class="cart-item-preco">${formatarMoeda(it.preco * it.qty)}</div>
            <span class="cart-item-remove" data-idx="${i}">✕</span>
          </div>
        `).join('')
      }
    </div>
    <div class="cart-footer">
      <div class="total-line"><span>Subtotal</span><span>${formatarMoeda(subtotal)}</span></div>
      ${taxaEntrega > 0 ? `<div class="total-line"><span>Taxa entrega</span><span>${formatarMoeda(taxaEntrega)}</span></div>` : ''}
      <div class="total-line big"><span>Total</span><span class="val">${formatarMoeda(total)}</span></div>
      <button class="btn btn-primary btn-full btn-lg mt-2" id="btn-confirmar-prato" ${_cart.length === 0 ? 'disabled style="opacity:.4"' : ''}>✓ Confirmar Pedido</button>
    </div>
  `;

  sidebar.querySelector('#btn-limpar-prato')?.addEventListener('click', () => { _cart = []; renderCartPrato(); });
  sidebar.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => { _cart.splice(parseInt(btn.dataset.idx), 1); renderCartPrato(); });
  });
  sidebar.querySelector('#btn-confirmar-prato')?.addEventListener('click', confirmarPratoPedido);
}

async function confirmarPratoPedido() {
  if (_cart.length === 0) { toast('Carrinho vazio', 'warn'); return; }
  const el = document.getElementById('tab-prato');
  const formaPagamento = el?.querySelector('.payment-opt.selected')?.dataset.forma || '';
  if (!formaPagamento) { toast('Selecione a forma de pagamento', 'warn'); return; }

  const subtotal = _cart.reduce((s, it) => s + it.preco * (it.qty || 1), 0);
  const taxaEntrega = _entrega?.taxaEntrega || 0;
  const total = subtotal + taxaEntrega;
  let pagoEm = 0, troco = 0;
  if (formaPagamento === 'Dinheiro') {
    pagoEm = parseFloat(el?.querySelector('#input-pago-prato')?.value || 0);
    troco  = Math.max(0, pagoEm - total);
  }

  const pedido = novoPedido({
    tipo: 'prato', cliente: _cliente || { nome: 'Balcão', telefone: '' },
    itens: [..._cart], subtotal, taxaEntrega, total,
    tipoEntrega: _entrega?.tipoEntrega || 'retirada', bairro: _entrega?.bairro || '',
    endereco: _entrega?.endereco || null, formaPagamento, pagoEm, troco,
  });

  if (_cliente?.telefone) registrarPedidoNoCliente(_cliente.telefone, pedido.id, `Prato Feito #${pedido.numero}`);
  toast(`Pedido #${pedido.numero} criado!`, 'success');
  _cart = [];
  renderPrato(); wirePratoEvents(); refreshSidebar();
  if (confirm(`Pedido #${pedido.numero} criado!\nImprimir nota?`)) imprimirPedido(pedido);
}

function payIcon(f) {
  return { Pix:'💠', Dinheiro:'💵', 'Cartão Débito':'💳', 'Cartão Crédito':'💳' }[f] || '💰';
}