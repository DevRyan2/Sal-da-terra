// ============================================================
//  pedido-list.js — Sidebar da lista de pedidos do dia
//  + Edição de pedidos (preço, qtd, itens)
// ============================================================
import { getPedidos, savePedido, atualizarStatusPedido, cancelarPedido, formatarMoeda, formatarHora, hoje } from '../db.js';
import { imprimirPedido } from './impressao.js';
import { toast } from '../utils.js';

let _onSelect    = null;
let _selectedId  = null;
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

  const pedidos  = getPedidos(hoje()).reverse();
  const filtrados = _filtroStatus === 'todos' ? pedidos : pedidos.filter(p => p.status === _filtroStatus);

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

  wireActions();
}

function renderOrderCard(p) {
  const tipoIcon = p.tipoEntrega === 'entrega' ? '🛵' : '🏪';
  const podeEditar = p.status !== 'cancelado' && p.status !== 'entregue';

  return `
    <div class="order-card ${p.id === _selectedId ? 'selected' : ''}" data-id="${p.id}">
      <div class="flex items-center gap-2 mb-1">
        <span class="order-num">#${p.numero}</span>
        <span class="badge ${statusClass(p.status)}">${statusLabel(p.status)}</span>
        <span style="margin-left:auto;font-size:.8rem">${tipoIcon} ${formatarHora(p.hora)}</span>
      </div>
      <div class="order-cliente">${p.cliente?.nome || 'Balcão'}</div>
      <div class="order-meta">
        <span>${(p.itens || []).length} iten${(p.itens||[]).length !== 1 ? 's' : ''}</span>
        ${p.tipoEntrega === 'entrega' && p.bairro ? `<span>· ${p.bairro}</span>` : ''}
        <span style="margin-left:auto" class="order-total">${formatarMoeda(p.total || 0)}</span>
      </div>
      <div class="flex gap-1 mt-2" style="flex-wrap:wrap">
        ${acoesPedido(p)}
        ${podeEditar ? `<button class="btn btn-sm btn-ghost" data-action="editar" data-id="${p.id}" title="Editar pedido">✏️ Editar</button>` : ''}
      </div>
    </div>
  `;
}

function acoesPedido(p) {
  const btns = [];
  if (p.status === 'novo')    btns.push(`<button class="btn btn-sm btn-ghost"   data-action="preparo"  data-id="${p.id}">🔥 Preparo</button>`);
  if (p.status === 'preparo') btns.push(`<button class="btn btn-sm btn-success" data-action="pronto"   data-id="${p.id}">✓ Pronto</button>`);
  if (p.status === 'pronto')  btns.push(`<button class="btn btn-sm btn-success" data-action="entregue" data-id="${p.id}">✓ Entregue</button>`);
  btns.push(`<button class="btn btn-sm btn-ghost" data-action="imprimir" data-id="${p.id}" title="Imprimir">🖨️</button>`);
  if (p.status !== 'cancelado' && p.status !== 'entregue') {
    btns.push(`<button class="btn btn-sm btn-danger" data-action="cancelar" data-id="${p.id}" title="Cancelar">✕</button>`);
  }
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
      const id     = btn.dataset.id;
      const action = btn.dataset.action;
      const pedidos = getPedidos(hoje());
      const pedido  = pedidos.find(p => p.id === id);
      if (!pedido) return;

      if (action === 'imprimir') { imprimirPedido(pedido); return; }
      if (action === 'editar')   { abrirModalEditar(pedido); return; }
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

// ============================================================
//  MODAL DE EDIÇÃO DE PEDIDO
//  Permite corrigir preços, quantidades, itens e pagamento
// ============================================================
function abrirModalEditar(pedido) {
  // Trabalhar numa cópia para não afetar o original enquanto edita
  let itens = (pedido.itens || []).map(it => ({ ...it }));
  let formaPagamento = pedido.formaPagamento || '';

  let overlay = document.getElementById('modal-editar-pedido');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-editar-pedido';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  function recalcTotal() {
    const subtotal    = Math.round(itens.reduce((s, it) => s + Math.round((it.preco||0)*(it.qty||1)*100), 0)) / 100;
    const taxaEntrega = pedido.taxaEntrega || 0;
    return { subtotal, total: subtotal + taxaEntrega };
  }

  function renderModalContent() {
    const { subtotal, total } = recalcTotal();

    overlay.innerHTML = `
      <div class="modal modal-lg" style="max-width:560px">
        <div class="modal-header">
          <div class="modal-title">✏️ Editar Pedido #${pedido.numero}</div>
          <button class="modal-close" id="edit-close">✕</button>
        </div>

        <div style="font-size:.82rem;color:var(--text2);margin-bottom:12px">
          Cliente: <strong>${pedido.cliente?.nome || 'Balcão'}</strong>
          · ${pedido.tipoEntrega === 'entrega' ? '🛵 ' + (pedido.bairro || 'Entrega') : '🏪 Retirada'}
        </div>

        <!-- ITENS EDITÁVEIS -->
        <div class="section-label">Itens do pedido</div>
        <div id="edit-itens-lista" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
          ${itens.map((it, i) => `
            <div class="edit-item-row" data-idx="${i}">
              <div style="flex:1;min-width:0">
                <div class="edit-item-nome">${it.nome || it.descricao || '?'}</div>
                ${it.proteina ? `<div style="font-size:.75rem;color:var(--text2)">${it.proteina}</div>` : ''}
                ${it.obs ? `<div style="font-size:.75rem;color:var(--accent);font-style:italic">${it.obs}</div>` : ''}
              </div>
              <div class="edit-item-controles">
                <div>
                  <label class="edit-label">Qtd</label>
                  <input class="input edit-input-qty" type="number" min="1" value="${it.qty || 1}" data-idx="${i}" style="width:60px;text-align:center">
                </div>
                <div>
                  <label class="edit-label">Preço unit.</label>
                  <div style="position:relative">
                    <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:.8rem;color:var(--text3)">R$</span>
                    <input class="input edit-input-preco" type="number" min="0" step="0.50" value="${Number(it.preco||0).toFixed(2)}" data-idx="${i}" style="width:90px;padding-left:26px">
                  </div>
                </div>
                <div style="align-self:flex-end">
                  <div class="edit-subtotal" id="edit-sub-${i}">${formatarMoeda((it.preco||0)*(it.qty||1))}</div>
                  <button class="btn btn-sm" style="background:rgba(255,77,46,.15);color:var(--hot);border:none;margin-top:2px;width:100%" data-remover="${i}">Remover</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- ADICIONAR ITEM LIVRE -->
        <div style="background:var(--card2);border:1px dashed var(--border2);border-radius:var(--r);padding:10px;margin-bottom:12px">
          <div class="section-label" style="margin:0 0 8px">+ Adicionar item</div>
          <div style="display:grid;grid-template-columns:1fr 80px 80px auto;gap:8px;align-items:end">
            <div class="field"><label>Nome</label><input class="input" id="novo-item-nome" placeholder="Ex: Refrigerante"></div>
            <div class="field"><label>Preço</label><input class="input" id="novo-item-preco" type="number" step="0.50" placeholder="5.00"></div>
            <div class="field"><label>Qtd</label><input class="input" id="novo-item-qty" type="number" min="1" value="1"></div>
            <button class="btn btn-ghost btn-sm" id="btn-add-item-livre" style="align-self:flex-end">+ Add</button>
          </div>
        </div>

        <!-- FORMA DE PAGAMENTO -->
        <div class="section-label">Forma de pagamento</div>
        <div class="payment-opts mb-3" id="edit-payment-opts">
          ${['Pix','Dinheiro','Cartão Débito','Cartão Crédito'].map(f => `
            <div class="payment-opt ${formaPagamento === f ? 'selected' : ''}" data-forma="${f}">
              <div class="ico">${payIcon(f)}</div>
              <div class="lab">${f}</div>
            </div>
          `).join('')}
        </div>

        <!-- TOTAIS -->
        <div style="background:var(--card2);border-radius:var(--r);padding:12px;margin-bottom:4px">
          ${pedido.taxaEntrega > 0 ? `
            <div style="display:flex;justify-content:space-between;font-size:.88rem;color:var(--text2);margin-bottom:4px">
              <span>Subtotal</span><span id="edit-subtotal-val">${formatarMoeda(subtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.88rem;color:var(--text2);margin-bottom:4px">
              <span>Taxa entrega (${pedido.bairro || ''})</span><span>${formatarMoeda(pedido.taxaEntrega)}</span>
            </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;font-family:'Barlow Condensed',sans-serif;font-size:1.3rem;font-weight:700">
            <span>TOTAL</span>
            <span style="font-family:'JetBrains Mono',monospace;color:var(--accent)" id="edit-total-val">${formatarMoeda(total)}</span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" id="edit-cancel">Cancelar</button>
          <button class="btn btn-primary" id="edit-save">✓ Salvar alterações</button>
        </div>
      </div>
    `;

    // Fechar
    const fechar = () => overlay.remove();
    overlay.querySelector('#edit-close').onclick   = fechar;
    overlay.querySelector('#edit-cancel').onclick  = fechar;
    overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

    // Atualiza subtotal da linha ao mudar qty ou preco
    function atualizarSubtotal(idx) {
      const { subtotal: sub, total: tot } = recalcTotal();
      const subEl = overlay.querySelector(`#edit-sub-${idx}`);
      if (subEl) subEl.textContent = formatarMoeda((itens[idx]?.preco||0)*(itens[idx]?.qty||1));
      const stEl = overlay.querySelector('#edit-subtotal-val');
      const ttEl = overlay.querySelector('#edit-total-val');
      if (stEl) stEl.textContent = formatarMoeda(sub);
      if (ttEl) ttEl.textContent = formatarMoeda(tot);
    }

    // Inputs de quantidade
    overlay.querySelectorAll('.edit-input-qty').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.dataset.idx);
        itens[idx].qty = Math.max(1, parseInt(inp.value) || 1);
        atualizarSubtotal(idx);
      });
    });

    // Inputs de preço
    overlay.querySelectorAll('.edit-input-preco').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.dataset.idx);
        itens[idx].preco = parseFloat(inp.value) || 0;
        atualizarSubtotal(idx);
      });
    });

    // Remover item
    overlay.querySelectorAll('[data-remover]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.remover);
        if (itens.length <= 1) { toast('Não é possível remover o único item. Cancele o pedido.', 'warn'); return; }
        if (confirm(`Remover "${itens[idx].nome || itens[idx].descricao}"?`)) {
          itens.splice(idx, 1);
          renderModalContent(); // re-render completo
        }
      });
    });

    // Adicionar item livre
    overlay.querySelector('#btn-add-item-livre')?.addEventListener('click', () => {
      const nome  = overlay.querySelector('#novo-item-nome').value.trim();
      const preco = parseFloat(overlay.querySelector('#novo-item-preco').value || 0);
      const qty   = parseInt(overlay.querySelector('#novo-item-qty').value || 1);
      if (!nome) { toast('Informe o nome do item', 'warn'); return; }
      if (!preco) { toast('Informe o preço', 'warn'); return; }
      itens.push({ id: Date.now().toString(36), nome, preco, qty, tipo: 'avulso' });
      renderModalContent();
    });

    // Forma de pagamento
    overlay.querySelectorAll('.payment-opt').forEach(o => {
      o.addEventListener('click', () => {
        overlay.querySelectorAll('.payment-opt').forEach(x => x.classList.remove('selected'));
        o.classList.add('selected');
        formaPagamento = o.dataset.forma;
      });
    });

    // SALVAR
    overlay.querySelector('#edit-save').onclick = () => {
      const { subtotal: sub, total: tot } = recalcTotal();
      const pedidoAtualizado = {
        ...pedido,
        itens,
        subtotal: sub,
        total: tot,
        formaPagamento,
        _editadoEm: Date.now(),
      };
      savePedido(pedidoAtualizado);
      fechar();
      renderSidebar();
      toast(`Pedido #${pedido.numero} atualizado!`, 'success');
    };
  }

  renderModalContent();
}

function payIcon(f) {
  return { Pix:'💠', Dinheiro:'💵', 'Cartão Débito':'💳', 'Cartão Crédito':'💳' }[f] || '💰';
}
function statusLabel(s) {
  return { todos:'Todos', novo:'Novo', preparo:'Preparo', pronto:'Pronto', entregue:'Entregue', cancelado:'Cancelado' }[s] || s;
}
function statusClass(s) {
  return `status-${s}`;
}