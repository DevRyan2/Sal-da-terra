// ============================================================
//  tabs.js — Abas de pedido: Quentinha, Prato Feito, Balcão
// ============================================================
import { getCardapio, saveCardapio, novoPedido, formatarMoeda, registrarPedidoNoCliente, hoje } from './db.js';
import { abrirModalCliente } from './modules/cliente.js';
import { refreshSidebar } from './modules/pedido-list.js';
import { imprimirPedido } from './modules/impressao.js';
import { toast } from './utils.js';

// ── Helper: soma em centavos para evitar bug de float ────────
function somarPrecos(cart, getValor) {
  return Math.round(cart.reduce((s, it) => s + Math.round((getValor(it) || 0) * 100), 0)) / 100;
}


// ── Quentinha ───────────────────────────────────────────────
const OBS_RAPIDAS_QUENTINHA = ['Sem cebola','Sem alho','Sem pimenta','Pouco sal','Bem passado','Mal passado','Sem arroz','Sem feijão','Capricha no feijão','Capricha na carne'];

let _cart_quentinha   = [];
let _cliente_quentinha = null;
let _entrega_quentinha = null;
let _qtd_quentinha = 1;

export function renderQuentinha() {
  const el = document.getElementById('tab-quentinha');
  if (!el) return;
  const cardapio = getCardapio(hoje());
  const proteinas = cardapio.proteinas_dia.length > 0 ? cardapio.proteinas_dia : getConfig_proteinas();

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="dot"></span>Montar Quentinha</div>
        <button class="btn btn-ghost btn-sm" id="btn-config-cardapio">⚙️ Cardápio do dia</button>
      </div>

      <!-- 1. Tamanho -->
      <div class="section-label">1. Tamanho</div>
      <div class="size-cards" id="size-cards">
        ${cardapio.tamanhos.map(t => `
          <div class="size-card ${!t.disponivel ? 'esgotado' : ''}" data-sigla="${t.sigla}" data-preco="${t.preco}">
            <div class="sigla">${t.sigla}</div>
            <div class="label">${t.label}</div>
            <div class="preco">${formatarMoeda(t.preco)}</div>
            ${t.max ? `<div class="estoque">${Math.max(0, t.max - (t.vendidos || 0))} restantes</div>` : ''}
          </div>
        `).join('')}
      </div>

      <!-- 2. Proteína -->
      <div class="section-label mt-3">2. Proteína / Carne</div>
      <div class="chip-group" id="proteina-group">
        ${proteinas.map(p => `<div class="chip" data-proteina="${p}">${p}</div>`).join('')}
        <div class="chip" data-proteina="__outro__">+ Outro...</div>
      </div>
      <input class="input mt-2 hidden" id="proteina-custom" placeholder="Descreva a proteína...">

      <!-- 3. Acompanhamentos -->
      <div class="section-label mt-3">3. Acompanhamentos <span class="text-muted" style="font-size:.75rem">(opcional)</span></div>
      <div class="chip-group" id="acomp-group">
        ${getAcompanhamentos().map(a => `<div class="chip" data-acomp="${a}">${a}</div>`).join('')}
      </div>

      <!-- 4. Observações -->
      <div class="section-label mt-3">4. Observações</div>
      <div class="obs-chips mb-2" id="obs-chips">
        ${OBS_RAPIDAS_QUENTINHA.map(o => `<span class="obs-chip" data-obs="${o}">${o}</span>`).join('')}
      </div>
      <textarea class="input textarea" id="obs-livre" rows="2" placeholder="Observação livre..."></textarea>

      <!-- Quantidade + Adicionar -->
      <div class="flex items-center gap-3 mt-3">
        <div class="qty-stepper">
          <button class="qty-btn" id="qty-minus">−</button>
          <div class="qty-num" id="qty-num">1</div>
          <button class="qty-btn" id="qty-plus">+</button>
        </div>
        <button class="btn btn-primary flex-1" id="btn-add-item">
          Adicionar ao pedido
        </button>
      </div>
    </div>

    <!-- Cliente -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="dot"></span>Cliente & Entrega</div>
      </div>
      <div id="cliente-resumo">
        <button class="btn btn-ghost btn-full" id="btn-selecionar-cliente">👤 Selecionar / Cadastrar cliente</button>
      </div>
    </div>

    <!-- Pagamento -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="dot"></span>Pagamento</div>
      </div>
      <div class="payment-opts" id="payment-opts">
        ${['Pix','Dinheiro','Cartão Débito','Cartão Crédito'].map(f => `
          <div class="payment-opt" data-forma="${f}">
            <div class="ico">${payIcon(f)}</div>
            <div class="lab">${f}</div>
          </div>
        `).join('')}
      </div>
      <div id="troco-block" class="hidden mt-2">
        <div class="field">
          <label>Pagou com quanto?</label>
          <input class="input" id="input-pago-em" type="number" placeholder="50.00">
        </div>
      </div>
    </div>
  `;

  // Sidebar carrinho
  renderCartSidebarQuentinha();

  // Eventos
  el.querySelectorAll('.size-card').forEach(c => {
    c.addEventListener('click', () => {
      el.querySelectorAll('.size-card').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
    });
  });
  el.querySelectorAll('.chip[data-proteina]').forEach(c => {
    c.addEventListener('click', () => {
      el.querySelectorAll('.chip[data-proteina]').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      const inp = el.querySelector('#proteina-custom');
      if (c.dataset.proteina === '__outro__') inp.classList.remove('hidden');
      else inp.classList.add('hidden');
    });
  });
  el.querySelectorAll('.chip[data-acomp]').forEach(c => {
    c.addEventListener('click', () => c.classList.toggle('selected'));
  });
  el.querySelectorAll('.obs-chip').forEach(c => {
    c.addEventListener('click', () => c.classList.toggle('selected'));
  });
  el.querySelector('#qty-minus').onclick = () => { _qtd_quentinha = Math.max(1, _qtd_quentinha - 1); el.querySelector('#qty-num').textContent = _qtd_quentinha; };
  el.querySelector('#qty-plus').onclick  = () => { _qtd_quentinha++; el.querySelector('#qty-num').textContent = _qtd_quentinha; };
  el.querySelector('#btn-add-item').onclick = () => addItemFromFormQuentinha(el);
  el.querySelector('#btn-selecionar-cliente').onclick = selecionarClienteQuentinha;
  el.querySelectorAll('.payment-opt').forEach(o => {
    o.addEventListener('click', () => {
      el.querySelectorAll('.payment-opt').forEach(x => x.classList.remove('selected'));
      o.classList.add('selected');
      const trocoBlock = el.querySelector('#troco-block');
      if (o.dataset.forma === 'Dinheiro') trocoBlock.classList.remove('hidden');
      else trocoBlock.classList.add('hidden');
    });
  });
  el.querySelector('#btn-config-cardapio')?.addEventListener('click', abrirConfigCardapio);
}

function addItemFromFormQuentinha(el) {
  const sizeCard = el.querySelector('.size-card.selected');
  if (!sizeCard) { toast('Selecione um tamanho', 'warn'); return; }

  const sigla  = sizeCard.dataset.sigla;
  const preco  = parseFloat(sizeCard.dataset.preco);
  const label  = sizeCard.querySelector('.label').textContent;

  let proteina = '';
  const chipProt = el.querySelector('.chip[data-proteina].selected');
  if (chipProt) {
    if (chipProt.dataset.proteina === '__outro__') proteina = el.querySelector('#proteina-custom').value.trim();
    else proteina = chipProt.dataset.proteina;
  }

  const acomps = [...el.querySelectorAll('.chip[data-acomp].selected')].map(c => c.dataset.acomp);

  const obsChipsSelected = [...el.querySelectorAll('.obs-chip.selected')].map(c => c.dataset.obs);
  const obsLivre = el.querySelector('#obs-livre').value.trim();
  const obs = [...obsChipsSelected, ...(obsLivre ? [obsLivre] : [])].join(', ');

  const item = {
    id:      Date.now().toString(36),
    tipo:    'quentinha',
    nome:    `Quentinha ${sigla} — ${label}`,
    sigla, preco,
    proteina,
    acompanhamentos: acomps,
    obs,
    qty: _qtd_quentinha,
    detalhe: proteina || label,
  };

  for (let i = 0; i < _qtd_quentinha; i++) {
    _cart_quentinha.push({ ...item, id: item.id + i, qty: 1 });
  }
  _qtd_quentinha = 1;
  el.querySelector('#qty-num').textContent = '1';

  // Limpar seleções
  el.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
  el.querySelectorAll('.obs-chip.selected').forEach(c => c.classList.remove('selected'));
  el.querySelector('#obs-livre').value = '';

  renderCartSidebarQuentinha();
  toast(`Quentinha ${sigla} adicionada!`);
}

async function selecionarClienteQuentinha() {
  const resultado = await abrirModalCliente(_cliente_quentinha);
  if (resultado) {
    _cliente_quentinha = resultado.cliente;
    _entrega_quentinha = resultado;
    renderClienteResumoQuentinha();
    renderCartSidebarQuentinha();
  }
}

function renderClienteResumoQuentinha() {
  const el = document.getElementById('cliente-resumo');
  if (!el || !_cliente_quentinha) return;
  const { cliente, tipoEntrega, bairro, taxaEntrega, endereco } = _entrega_quentinha || {};
  el.innerHTML = `
    <div class="cliente-card">
      <div class="cliente-avatar">${(cliente.nome || 'B').charAt(0).toUpperCase()}</div>
      <div class="cliente-info">
        <div class="cliente-nome">${cliente.nome || 'Balcão'}</div>
        ${cliente.telefone ? `<div class="cliente-tel">${formatTel(cliente.telefone)}</div>` : ''}
        <div style="font-size:.8rem;margin-top:2px">
          ${tipoEntrega === 'entrega' ? `🛵 Entrega — ${bairro} (+${formatarMoeda(taxaEntrega)})` : '🏪 Retirada no local'}
        </div>
        ${cliente.observacaoFixa ? `<div class="cliente-obs">⚠️ ${cliente.observacaoFixa}</div>` : ''}
      </div>
      <button class="btn-icon" id="btn-trocar-cliente">✏️</button>
    </div>
    ${endereco && tipoEntrega === 'entrega' ? `
      <div style="font-size:.82rem;color:var(--text2);margin-top:6px;padding-left:4px">
        📍 ${endereco.logradouro}${endereco.numero ? ', '+endereco.numero : ''}${endereco.complemento ? ' — '+endereco.complemento : ''}<br>
        ${endereco.bairro}${endereco.referencia ? ' · '+endereco.referencia : ''}
      </div>
    ` : ''}
  `;
  el.querySelector('#btn-trocar-cliente')?.addEventListener('click', selecionarClienteQuentinha);
}

function renderCartSidebarQuentinha() {
  const sidebar = document.getElementById('cart-sidebar');
  if (!sidebar) return;

  const subtotal    = somarPrecos(_cart_quentinha, it => it.preco * (it.qty || 1));
  const taxaEntrega = _entrega_quentinha?.taxaEntrega || 0;
  const total       = subtotal + taxaEntrega;

  sidebar.innerHTML = `
    <div class="orders-sidebar-header">
      <div class="orders-sidebar-title">🛒 Carrinho <span class="badge badge-accent">${_cart_quentinha.length}</span></div>
      ${_cart_quentinha.length ? `<button class="btn-icon btn-danger" id="btn-limpar-cart" title="Limpar">🗑</button>` : ''}
    </div>

    <div class="cart">
      ${_cart_quentinha.length === 0 ? `
        <div class="empty-state">
          <div class="ico">🛒</div>
          <p>Carrinho vazio</p>
        </div>
      ` : _cart_quentinha.map((it, i) => `
        <div class="cart-item">
          <div class="cart-item-qty">${it.qty}×</div>
          <div class="cart-item-info">
            <div class="cart-item-nome">${it.nome}</div>
            <div class="cart-item-detalhe">${[it.proteina, it.acompanhamentos?.join(', ')].filter(Boolean).join(' · ')}</div>
            ${it.obs ? `<div style="font-size:.75rem;color:var(--accent);font-style:italic">${it.obs}</div>` : ''}
          </div>
          <div class="cart-item-preco">${formatarMoeda(it.preco)}</div>
          <span class="cart-item-remove" data-idx="${i}">✕</span>
        </div>
      `).join('')}
    </div>

    <div class="cart-footer">
      <div class="total-line"><span>Subtotal</span><span>${formatarMoeda(subtotal)}</span></div>
      ${taxaEntrega > 0 ? `<div class="total-line"><span>Taxa entrega</span><span>${formatarMoeda(taxaEntrega)}</span></div>` : ''}
      <div class="total-line big"><span>Total</span><span class="val">${formatarMoeda(total)}</span></div>
      <button class="btn btn-primary btn-full btn-lg mt-2" id="btn-confirmar-pedido" ${_cart_quentinha.length === 0 ? 'disabled style="opacity:.4"' : ''}>
        ✓ Confirmar Pedido
      </button>
    </div>
  `;

  sidebar.querySelector('#btn-limpar-cart')?.addEventListener('click', () => { _cart_quentinha = []; renderCartSidebarQuentinha(); });
  sidebar.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      _cart_quentinha.splice(parseInt(btn.dataset.idx), 1);
      renderCartSidebarQuentinha();
    });
  });
  sidebar.querySelector('#btn-confirmar-pedido')?.addEventListener('click', confirmarPedidoQuentinha);
}

async function confirmarPedidoQuentinha() {
  if (_cart_quentinha.length === 0) { toast('Carrinho vazio', 'warn'); return; }

  const el = document.getElementById('tab-quentinha');
  const formaPagamento = el?.querySelector('.payment-opt.selected')?.dataset.forma || '';
  if (!formaPagamento) { toast('Selecione a forma de pagamento', 'warn'); return; }

  const subtotal    = somarPrecos(_cart_quentinha, it => it.preco * (it.qty || 1));
  const taxaEntrega = _entrega_quentinha?.taxaEntrega || 0;
  const total       = subtotal + taxaEntrega;

  let pagoEm = 0, troco = 0;
  if (formaPagamento === 'Dinheiro') {
    pagoEm = parseFloat(el?.querySelector('#input-pago-em')?.value || 0);
    troco  = Math.max(0, pagoEm - total);
  }

  const pedido = novoPedido({
    tipo:          'quentinha',
    cliente:       _cliente_quentinha || { nome: 'Balcão', telefone: '' },
    itens:         [..._cart_quentinha],
    subtotal,
    taxaEntrega,
    total,
    tipoEntrega:   _entrega_quentinha?.tipoEntrega || 'retirada',
    bairro:        _entrega_quentinha?.bairro || '',
    endereco:      _entrega_quentinha?.endereco || null,
    formaPagamento,
    pagoEm,
    troco,
  });

  if (_cliente_quentinha?.telefone) registrarPedidoNoCliente(_cliente_quentinha.telefone, pedido.id, `Quentinha #${pedido.numero} — ${formatarMoeda(total)}`);

  toast(`Pedido #${pedido.numero} criado!`, 'success');

  // Reset
  _cart_quentinha = [];
  _qtd_quentinha  = 1;
  renderQuentinha();
  refreshSidebar();

  if (confirm(`Pedido #${pedido.numero} criado!\n\nImprimir nota?`)) imprimirPedido(pedido);
}

function abrirConfigCardapio() {
  // Importação dinâmica para não circular
  import('./modules/cardapio-modal.js').then(m => m.abrirModalCardapio(() => renderQuentinha()));
}

function getConfig_proteinas() {
  try { return JSON.parse(localStorage.getItem('REST_CONFIG') || '{}').proteinas || []; } catch { return []; }
}
function getAcompanhamentos() {
  try {
    const cfg = JSON.parse(localStorage.getItem('REST_CONFIG') || '{}');
    return cfg.acompanhamentos?.length ? cfg.acompanhamentos : ['Arroz branco','Feijão','Feijão tropeiro','Macarrão','Farofa','Salada','Fritas','Mandioca frita'];
  } catch { return []; }
}
function formatTel(t) {
  const d = (t || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return t;
}
function payIcon(f) {
  return { Pix:'💠', Dinheiro:'💵', 'Cartão Débito':'💳', 'Cartão Crédito':'💳' }[f] || '💰';
}

// ── Prato Feito ─────────────────────────────────────────────
const OBS_RAPIDAS_PRATO = ['Sem cebola','Sem alho','Sem pimenta','Pouco sal','Bem passado','Mal passado','Capricha','Porção extra'];

let _cart_prato    = [];
let _cliente_prato = null;
let _entrega_prato = null;

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
        ${OBS_RAPIDAS_PRATO.map(o => `<span class="obs-chip" data-obs="${o}">${o}</span>`).join('')}
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
  el.querySelector('#btn-cliente-prato')?.addEventListener('click', selecionarClientePrato);
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
const _qtds_prato = {};

function getQtdElPrato(id) { return document.getElementById(`qty-prato-${id}`); }
function getQtdPrato(id) { return _qtds_prato[id] || 1; }
function setQtdPrato(id, v) { _qtds_prato[id] = Math.max(1, v); const el = getQtdElPrato(id); if (el) el.textContent = _qtds_prato[id]; }

export function wirePratoEvents() {
  const el = document.getElementById('tab-prato');
  if (!el) return;
  el.querySelectorAll('.btn-prato-minus').forEach(b => b.addEventListener('click', () => setQtdPrato(b.dataset.id, getQtdPrato(b.dataset.id) - 1)));
  el.querySelectorAll('.btn-prato-plus').forEach(b  => b.addEventListener('click', () => setQtdPrato(b.dataset.id, getQtdPrato(b.dataset.id) + 1)));
  el.querySelectorAll('.btn-add-prato-item').forEach(b => b.addEventListener('click', () => {
    const cardapio = getCardapio(hoje());
    const prato = cardapio.pratos.find(p => p.id === b.dataset.id);
    if (!prato) return;
    const qty = getQtdPrato(b.dataset.id);
    const obsChips = [...el.querySelectorAll('.obs-chip.selected')].map(c => c.dataset.obs);
    const obsLivre = el.querySelector('#obs-livre-prato')?.value.trim() || '';
    const obs = [...obsChips, ...(obsLivre ? [obsLivre] : [])].join(', ');
    _cart_prato.push({ id: Date.now().toString(36), tipo: 'prato', nome: prato.nome, preco: prato.preco, qty, obs });
    setQtdPrato(b.dataset.id, 1);
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

async function selecionarClientePrato() {
  const r = await abrirModalCliente(_cliente_prato);
  if (r) { _cliente_prato = r.cliente; _entrega_prato = r; renderClientePrato(); renderCartPrato(); }
}

function renderClientePrato() {
  const el = document.getElementById('cliente-resumo-prato');
  if (!el || !_cliente_prato) return;
  const { cliente, tipoEntrega, bairro, taxaEntrega } = _entrega_prato || {};
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
  el.querySelector('#btn-trocar-prato')?.addEventListener('click', selecionarClientePrato);
}

function renderCartPrato() {
  const sidebar = document.getElementById('cart-sidebar');
  if (!sidebar) return;

  const subtotal    = somarPrecos(_cart_prato, it => it.preco * (it.qty || 1));
  const taxaEntrega = _entrega_prato?.taxaEntrega || 0;
  const total       = subtotal + taxaEntrega;

  sidebar.innerHTML = `
    <div class="orders-sidebar-header">
      <div class="orders-sidebar-title">🛒 Carrinho <span class="badge badge-accent">${_cart_prato.length}</span></div>
      ${_cart_prato.length ? `<button class="btn-icon" id="btn-limpar-prato">🗑</button>` : ''}
    </div>
    <div class="cart">
      ${_cart_prato.length === 0 ? `<div class="empty-state"><div class="ico">🛒</div><p>Selecione um prato</p></div>` :
        _cart_prato.map((it, i) => `
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
      <button class="btn btn-primary btn-full btn-lg mt-2" id="btn-confirmar-prato" ${_cart_prato.length === 0 ? 'disabled style="opacity:.4"' : ''}>✓ Confirmar Pedido</button>
    </div>
  `;

  sidebar.querySelector('#btn-limpar-prato')?.addEventListener('click', () => { _cart_prato = []; renderCartPrato(); });
  sidebar.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => { _cart_prato.splice(parseInt(btn.dataset.idx), 1); renderCartPrato(); });
  });
  sidebar.querySelector('#btn-confirmar-prato')?.addEventListener('click', confirmarPratoPedido);
}

async function confirmarPratoPedido() {
  if (_cart_prato.length === 0) { toast('Carrinho vazio', 'warn'); return; }
  const el = document.getElementById('tab-prato');
  const formaPagamento = el?.querySelector('.payment-opt.selected')?.dataset.forma || '';
  if (!formaPagamento) { toast('Selecione a forma de pagamento', 'warn'); return; }

  const subtotal = somarPrecos(_cart_prato, it => it.preco * (it.qty || 1));
  const taxaEntrega = _entrega_prato?.taxaEntrega || 0;
  const total = subtotal + taxaEntrega;
  let pagoEm = 0, troco = 0;
  if (formaPagamento === 'Dinheiro') {
    pagoEm = parseFloat(el?.querySelector('#input-pago-prato')?.value || 0);
    troco  = Math.max(0, pagoEm - total);
  }

  const pedido = novoPedido({
    tipo: 'prato', cliente: _cliente_prato || { nome: 'Balcão', telefone: '' },
    itens: [..._cart_prato], subtotal, taxaEntrega, total,
    tipoEntrega: _entrega_prato?.tipoEntrega || 'retirada', bairro: _entrega_prato?.bairro || '',
    endereco: _entrega_prato?.endereco || null, formaPagamento, pagoEm, troco,
  });

  if (_cliente_prato?.telefone) registrarPedidoNoCliente(_cliente_prato.telefone, pedido.id, `Prato Feito #${pedido.numero}`);
  toast(`Pedido #${pedido.numero} criado!`, 'success');
  _cart_prato = [];
  renderPrato(); wirePratoEvents(); refreshSidebar();
  if (confirm(`Pedido #${pedido.numero} criado!\nImprimir nota?`)) imprimirPedido(pedido);
}

// ── Balcão ──────────────────────────────────────────────────
const CATEGORIA_ICONS = { Bebida:'🥤', Sobremesa:'🍮', Salgado:'🥐', Lanche:'🥪', Outros:'📦' };

let _cart_balcao = [];

export function renderBalcao() {
  const el = document.getElementById('tab-balcao');
  if (!el) return;
  const cardapio = getCardapio(hoje());
  const itens    = cardapio.balcao || [];

  // Agrupar por categoria
  const categorias = {};
  itens.forEach(it => {
    const cat = it.categoria || 'Outros';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(it);
  });

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><span class="dot"></span>Itens do Balcão</div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" id="btn-add-balcao">+ Novo item</button>
        </div>
      </div>

      ${itens.length === 0 ? `
        <div class="empty-state">
          <div class="ico">🏪</div>
          <p>Nenhum item cadastrado.<br>Edite o arquivo <code>config.js</code> para adicionar itens padrão.</p>
        </div>
      ` : Object.entries(categorias).map(([cat, items]) => `
        <div class="pdv-cat-label">${CATEGORIA_ICONS[cat] || '📦'} ${cat}</div>
        <div class="pdv-grid">
          ${items.map(it => `
            <div class="pdv-item" data-id="${it.id}" data-nome="${it.nome}" data-preco="${it.preco}">
              <div class="pdv-icon">${CATEGORIA_ICONS[it.categoria] || '📦'}</div>
              <div class="pdv-nome">${it.nome}</div>
              <div class="pdv-preco">${formatarMoeda(it.preco)}</div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <!-- Pagamento -->
    <div class="card">
      <div class="card-header"><div class="card-title"><span class="dot"></span>Pagamento</div></div>
      <div class="payment-opts" id="payment-opts-balcao">
        ${['Pix','Dinheiro','Cartão Débito','Cartão Crédito'].map(f => `
          <div class="payment-opt" data-forma="${f}">
            <div class="ico">${payIcon(f)}</div>
            <div class="lab">${f}</div>
          </div>
        `).join('')}
      </div>
      <div id="troco-block-balcao" class="hidden mt-2">
        <div class="field"><label>Pagou com quanto?</label>
        <input class="input" id="input-pago-balcao" type="number" placeholder="50.00"></div>
      </div>
    </div>
  `;

  renderCartBalcao();

  // Eventos
  el.querySelectorAll('.pdv-item').forEach(item => {
    item.addEventListener('click', () => {
      const id    = item.dataset.id;
      const nome  = item.dataset.nome;
      const preco = parseFloat(item.dataset.preco);
      // Ver se já existe no carrinho
      const existe = _cart_balcao.find(x => x.id === id);
      if (existe) { existe.qty++; }
      else { _cart_balcao.push({ id, nome, preco, qty: 1, tipo: 'balcao' }); }
      renderCartBalcao();
    });
  });
  el.querySelector('#btn-add-balcao')?.addEventListener('click', abrirFormNovoItemBalcao);
  el.querySelectorAll('.payment-opt').forEach(o => {
    o.addEventListener('click', () => {
      el.querySelectorAll('.payment-opt').forEach(x => x.classList.remove('selected'));
      o.classList.add('selected');
      const tb = el.querySelector('#troco-block-balcao');
      if (o.dataset.forma === 'Dinheiro') tb.classList.remove('hidden');
      else tb.classList.add('hidden');
    });
  });
}

function renderCartBalcao() {
  const sidebar = document.getElementById('cart-sidebar');
  if (!sidebar) return;

  const total = somarPrecos(_cart_balcao, it => it.preco * it.qty);

  sidebar.innerHTML = `
    <div class="orders-sidebar-header">
      <div class="orders-sidebar-title">🛒 Venda Balcão <span class="badge badge-accent">${_cart_balcao.reduce((s,i)=>s+i.qty,0)}</span></div>
      ${_cart_balcao.length ? `<button class="btn-icon" id="btn-limpar-balcao">🗑</button>` : ''}
    </div>
    <div class="cart">
      ${_cart_balcao.length === 0 ? `<div class="empty-state"><div class="ico">🏪</div><p>Clique nos itens para adicionar</p></div>` :
        _cart_balcao.map((it, i) => `
          <div class="cart-item">
            <div class="qty-stepper" style="gap:2px">
              <button class="qty-btn" style="width:24px;height:24px;font-size:.85rem" data-idx="${i}" data-op="minus">−</button>
              <div class="qty-num" style="min-width:24px;font-size:.88rem">${it.qty}</div>
              <button class="qty-btn" style="width:24px;height:24px;font-size:.85rem" data-idx="${i}" data-op="plus">+</button>
            </div>
            <div class="cart-item-info">
              <div class="cart-item-nome">${it.nome}</div>
              <div class="cart-item-detalhe">${formatarMoeda(it.preco)} × ${it.qty}</div>
            </div>
            <div class="cart-item-preco">${formatarMoeda(it.preco * it.qty)}</div>
            <span class="cart-item-remove" data-idx="${i}">✕</span>
          </div>
        `).join('')
      }
    </div>
    <div class="cart-footer">
      <div class="total-line big"><span>Total</span><span class="val">${formatarMoeda(total)}</span></div>
      <button class="btn btn-primary btn-full btn-lg mt-2" id="btn-confirmar-balcao" ${_cart_balcao.length === 0 ? 'disabled style="opacity:.4"' : ''}>✓ Finalizar Venda</button>
    </div>
  `;

  sidebar.querySelector('#btn-limpar-balcao')?.addEventListener('click', () => { _cart_balcao = []; renderCartBalcao(); });
  sidebar.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (btn.dataset.op === 'plus') _cart_balcao[idx].qty++;
      else { _cart_balcao[idx].qty--; if (_cart_balcao[idx].qty <= 0) _cart_balcao.splice(idx, 1); }
      renderCartBalcao();
    });
  });
  sidebar.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => { _cart_balcao.splice(parseInt(btn.dataset.idx), 1); renderCartBalcao(); });
  });
  sidebar.querySelector('#btn-confirmar-balcao')?.addEventListener('click', confirmarVendaBalcao);
}

async function confirmarVendaBalcao() {
  if (_cart_balcao.length === 0) { toast('Carrinho vazio', 'warn'); return; }
  const el = document.getElementById('tab-balcao');
  const formaPagamento = el?.querySelector('.payment-opt.selected')?.dataset.forma || '';
  if (!formaPagamento) { toast('Selecione a forma de pagamento', 'warn'); return; }

  const total = somarPrecos(_cart_balcao, it => it.preco * it.qty);
  let pagoEm = 0, troco = 0;
  if (formaPagamento === 'Dinheiro') {
    pagoEm = parseFloat(el?.querySelector('#input-pago-balcao')?.value || 0);
    troco  = Math.max(0, pagoEm - total);
  }

  const pedido = novoPedido({
    tipo: 'balcao',
    cliente: { nome: 'Balcão', telefone: '' },
    itens: _cart_balcao.map(it => ({ ...it, nome: it.nome, detalhe: '' })),
    subtotal: total, taxaEntrega: 0, total,
    tipoEntrega: 'retirada', bairro: '',
    formaPagamento, pagoEm, troco,
  });

  toast(`Venda #${pedido.numero} registrada!`, 'success');
  _cart_balcao = [];
  renderBalcao();
  refreshSidebar();
  if (confirm(`Venda #${pedido.numero} — ${formatarMoeda(total)}\n${troco > 0 ? `Troco: ${formatarMoeda(troco)}\n` : ''}Imprimir nota?`)) imprimirPedido(pedido);
}

function abrirFormNovoItemBalcao() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">+ Novo Item Balcão</div>
        <button class="modal-close" id="close-nb">✕</button>
      </div>
      <div class="field-row field-row-2 mb-3">
        <div class="field"><label>Nome *</label><input class="input" id="nb-nome" placeholder="Ex: Suco de laranja"></div>
        <div class="field"><label>Preço *</label><input class="input" id="nb-preco" type="number" placeholder="8.00"></div>
      </div>
      <div class="field mb-3"><label>Categoria</label>
        <select class="select" id="nb-cat">
          ${Object.keys(CATEGORIA_ICONS).map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div style="font-size:.8rem;color:var(--text2);margin-bottom:16px">
        ⚠️ Este item será adicionado apenas para hoje. Para itens permanentes, edite <code>js/config.js</code>.
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="cancel-nb">Cancelar</button>
        <button class="btn btn-primary" id="save-nb">Adicionar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#close-nb').onclick = overlay.querySelector('#cancel-nb').onclick = () => overlay.remove();
  overlay.querySelector('#save-nb').onclick = () => {
    const nome  = overlay.querySelector('#nb-nome').value.trim();
    const preco = parseFloat(overlay.querySelector('#nb-preco').value || 0);
    const cat   = overlay.querySelector('#nb-cat').value;
    if (!nome || !preco) { toast('Preencha nome e preço', 'warn'); return; }
    const cardapio = getCardapio(hoje());
    cardapio.balcao.push({ id: Date.now().toString(36), nome, preco, categoria: cat });
    saveCardapio(hoje(), cardapio);
    overlay.remove();
    renderBalcao();
    toast(`"${nome}" adicionado ao balcão!`);
  };
}