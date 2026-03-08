// ============================================================
//  balcao.js — Aba Balcão (PDV)
// ============================================================
import { getCardapio, saveCardapio, novoPedido, formatarMoeda, hoje } from './db.js';
import { refreshSidebar } from '../modules/pedido-list.js';
import { imprimirPedido } from '../modules/impressao.js';
import { toast } from '../app.js';

const CATEGORIA_ICONS = { Bebida:'🥤', Sobremesa:'🍮', Salgado:'🥐', Lanche:'🥪', Outros:'📦' };

let _cart = [];

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
      const existe = _cart.find(x => x.id === id);
      if (existe) { existe.qty++; }
      else { _cart.push({ id, nome, preco, qty: 1, tipo: 'balcao' }); }
      renderCartBalcao();
    });
  });
  el.querySelector('#btn-add-balcao')?.addEventListener('click', abrirFormNovoItem);
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

  const total = _cart.reduce((s, it) => s + it.preco * it.qty, 0);

  sidebar.innerHTML = `
    <div class="orders-sidebar-header">
      <div class="orders-sidebar-title">🛒 Venda Balcão <span class="badge badge-accent">${_cart.reduce((s,i)=>s+i.qty,0)}</span></div>
      ${_cart.length ? `<button class="btn-icon" id="btn-limpar-balcao">🗑</button>` : ''}
    </div>
    <div class="cart">
      ${_cart.length === 0 ? `<div class="empty-state"><div class="ico">🏪</div><p>Clique nos itens para adicionar</p></div>` :
        _cart.map((it, i) => `
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
      <button class="btn btn-primary btn-full btn-lg mt-2" id="btn-confirmar-balcao" ${_cart.length === 0 ? 'disabled style="opacity:.4"' : ''}>✓ Finalizar Venda</button>
    </div>
  `;

  sidebar.querySelector('#btn-limpar-balcao')?.addEventListener('click', () => { _cart = []; renderCartBalcao(); });
  sidebar.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (btn.dataset.op === 'plus') _cart[idx].qty++;
      else { _cart[idx].qty--; if (_cart[idx].qty <= 0) _cart.splice(idx, 1); }
      renderCartBalcao();
    });
  });
  sidebar.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => { _cart.splice(parseInt(btn.dataset.idx), 1); renderCartBalcao(); });
  });
  sidebar.querySelector('#btn-confirmar-balcao')?.addEventListener('click', confirmarVendaBalcao);
}

async function confirmarVendaBalcao() {
  if (_cart.length === 0) { toast('Carrinho vazio', 'warn'); return; }
  const el = document.getElementById('tab-balcao');
  const formaPagamento = el?.querySelector('.payment-opt.selected')?.dataset.forma || '';
  if (!formaPagamento) { toast('Selecione a forma de pagamento', 'warn'); return; }

  const total = _cart.reduce((s, it) => s + it.preco * it.qty, 0);
  let pagoEm = 0, troco = 0;
  if (formaPagamento === 'Dinheiro') {
    pagoEm = parseFloat(el?.querySelector('#input-pago-balcao')?.value || 0);
    troco  = Math.max(0, pagoEm - total);
  }

  const pedido = novoPedido({
    tipo: 'balcao',
    cliente: { nome: 'Balcão', telefone: '' },
    itens: _cart.map(it => ({ ...it, nome: it.nome, detalhe: '' })),
    subtotal: total, taxaEntrega: 0, total,
    tipoEntrega: 'retirada', bairro: '',
    formaPagamento, pagoEm, troco,
  });

  toast(`Venda #${pedido.numero} registrada!`, 'success');
  _cart = [];
  renderBalcao();
  refreshSidebar();
  if (confirm(`Venda #${pedido.numero} — ${formatarMoeda(total)}\n${troco > 0 ? `Troco: ${formatarMoeda(troco)}\n` : ''}Imprimir nota?`)) imprimirPedido(pedido);
}

function abrirFormNovoItem() {
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

function payIcon(f) {
  return { Pix:'💠', Dinheiro:'💵', 'Cartão Débito':'💳', 'Cartão Crédito':'💳' }[f] || '💰';
}
