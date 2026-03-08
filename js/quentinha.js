// ============================================================
//  quentinha.js — Aba de pedido de quentinha
// ============================================================
import { getCardapio, saveCardapio, novoPedido, formatarMoeda, registrarPedidoNoCliente, hoje } from '../db.js';
import { abrirModalCliente } from '../modules/cliente.js';
import { refreshSidebar } from '../modules/pedido-list.js';
import { imprimirPedido } from '../modules/impressao.js';
import { toast } from '../app.js';

const OBS_RAPIDAS = ['Sem cebola','Sem alho','Sem pimenta','Pouco sal','Bem passado','Mal passado','Sem arroz','Sem feijão','Capricha no feijão','Capricha na carne'];

let _cart   = [];
let _cliente = null;
let _entrega = null;
let _qtd = 1;

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
        ${OBS_RAPIDAS.map(o => `<span class="obs-chip" data-obs="${o}">${o}</span>`).join('')}
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
  renderCartSidebar();

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
  el.querySelector('#qty-minus').onclick = () => { _qtd = Math.max(1, _qtd - 1); el.querySelector('#qty-num').textContent = _qtd; };
  el.querySelector('#qty-plus').onclick  = () => { _qtd++; el.querySelector('#qty-num').textContent = _qtd; };
  el.querySelector('#btn-add-item').onclick = () => addItemFromForm(el);
  el.querySelector('#btn-selecionar-cliente').onclick = selecionarCliente;
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

function addItemFromForm(el) {
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
    qty: _qtd,
    detalhe: proteina || label,
  };

  for (let i = 0; i < _qtd; i++) {
    _cart.push({ ...item, id: item.id + i, qty: 1 });
  }
  _qtd = 1;
  el.querySelector('#qty-num').textContent = '1';

  // Limpar seleções
  el.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
  el.querySelectorAll('.obs-chip.selected').forEach(c => c.classList.remove('selected'));
  el.querySelector('#obs-livre').value = '';

  renderCartSidebar();
  toast(`Quentinha ${sigla} adicionada!`);
}

async function selecionarCliente() {
  const resultado = await abrirModalCliente(_cliente);
  if (resultado) {
    _cliente = resultado.cliente;
    _entrega = resultado;
    renderClienteResumo();
    renderCartSidebar();
  }
}

function renderClienteResumo() {
  const el = document.getElementById('cliente-resumo');
  if (!el || !_cliente) return;
  const { cliente, tipoEntrega, bairro, taxaEntrega, endereco } = _entrega || {};
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
  el.querySelector('#btn-trocar-cliente')?.addEventListener('click', selecionarCliente);
}

function renderCartSidebar() {
  const sidebar = document.getElementById('cart-sidebar');
  if (!sidebar) return;

  const subtotal    = _cart.reduce((s, it) => s + it.preco * (it.qty || 1), 0);
  const taxaEntrega = _entrega?.taxaEntrega || 0;
  const total       = subtotal + taxaEntrega;

  sidebar.innerHTML = `
    <div class="orders-sidebar-header">
      <div class="orders-sidebar-title">🛒 Carrinho <span class="badge badge-accent">${_cart.length}</span></div>
      ${_cart.length ? `<button class="btn-icon btn-danger" id="btn-limpar-cart" title="Limpar">🗑</button>` : ''}
    </div>

    <div class="cart">
      ${_cart.length === 0 ? `
        <div class="empty-state">
          <div class="ico">🛒</div>
          <p>Carrinho vazio</p>
        </div>
      ` : _cart.map((it, i) => `
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
      <button class="btn btn-primary btn-full btn-lg mt-2" id="btn-confirmar-pedido" ${_cart.length === 0 ? 'disabled style="opacity:.4"' : ''}>
        ✓ Confirmar Pedido
      </button>
    </div>
  `;

  sidebar.querySelector('#btn-limpar-cart')?.addEventListener('click', () => { _cart = []; renderCartSidebar(); });
  sidebar.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      _cart.splice(parseInt(btn.dataset.idx), 1);
      renderCartSidebar();
    });
  });
  sidebar.querySelector('#btn-confirmar-pedido')?.addEventListener('click', confirmarPedido);
}

async function confirmarPedido() {
  if (_cart.length === 0) { toast('Carrinho vazio', 'warn'); return; }

  const el = document.getElementById('tab-quentinha');
  const formaPagamento = el?.querySelector('.payment-opt.selected')?.dataset.forma || '';
  if (!formaPagamento) { toast('Selecione a forma de pagamento', 'warn'); return; }

  const subtotal    = _cart.reduce((s, it) => s + it.preco * (it.qty || 1), 0);
  const taxaEntrega = _entrega?.taxaEntrega || 0;
  const total       = subtotal + taxaEntrega;

  let pagoEm = 0, troco = 0;
  if (formaPagamento === 'Dinheiro') {
    pagoEm = parseFloat(el?.querySelector('#input-pago-em')?.value || 0);
    troco  = Math.max(0, pagoEm - total);
  }

  const pedido = novoPedido({
    tipo:          'quentinha',
    cliente:       _cliente || { nome: 'Balcão', telefone: '' },
    itens:         [..._cart],
    subtotal,
    taxaEntrega,
    total,
    tipoEntrega:   _entrega?.tipoEntrega || 'retirada',
    bairro:        _entrega?.bairro || '',
    endereco:      _entrega?.endereco || null,
    formaPagamento,
    pagoEm,
    troco,
  });

  if (_cliente?.telefone) registrarPedidoNoCliente(_cliente.telefone, pedido.id, `Quentinha #${pedido.numero} — ${formatarMoeda(total)}`);

  toast(`Pedido #${pedido.numero} criado!`, 'success');

  // Reset
  _cart = [];
  _qtd  = 1;
  renderQuentinha();
  refreshSidebar();

  if (confirm(`Pedido #${pedido.numero} criado!\n\nImprimir nota?`)) imprimirPedido(pedido);
}

function abrirConfigCardapio() {
  // Importação dinâmica para não circular
  import('./cardapio-modal.js').then(m => m.abrirModalCardapio(() => renderQuentinha()));
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
