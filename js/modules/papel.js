// ============================================================
//  papel.js — Aba "Papel": referência de preços + pedidos do dia
//  Objetivo: evitar erros de precificação no celular
// ============================================================
import { getCardapio, getPedidos, formatarMoeda, formatarHora, hoje } from '../db.js';

export function renderPapel() {
  const el = document.getElementById('tab-papel');
  if (!el) return;

  const cardapio = getCardapio(hoje());
  const todos    = getPedidos(hoje());
  const ativos   = todos.filter(p => p.status !== 'cancelado').reverse();
  const cancelados = todos.filter(p => p.status === 'cancelado').length;

  // Totais do dia
  const faturamento = ativos.reduce((s, p) => s + (p.total || 0), 0);
  const entregues   = ativos.filter(p => p.status === 'entregue').length;
  const novos       = ativos.filter(p => p.status === 'novo' || p.status === 'preparo' || p.status === 'pronto').length;

  el.innerHTML = `
    <!-- TABELA DE PREÇOS -->
    <div class="papel-card">
      <div class="papel-card-titulo">💰 Tabela de Preços — Consulte aqui!</div>

      <div class="papel-secao">🍱 QUENTINHA</div>
      ${cardapio.tamanhos.map(t => `
        <div class="papel-preco-linha ${!t.disponivel ? 'esgotado' : ''}">
          <span>Quentinha <strong>${t.sigla}</strong> — ${t.label}</span>
          <span class="papel-valor">${formatarMoeda(t.preco)}</span>
        </div>
      `).join('')}

      ${cardapio.pratos?.length ? `
        <div class="papel-secao">🍽️ PRATOS DO DIA</div>
        ${cardapio.pratos.map(p => `
          <div class="papel-preco-linha ${!p.disponivel ? 'esgotado' : ''}">
            <span>${p.nome}</span>
            <span class="papel-valor">${formatarMoeda(p.preco)}</span>
          </div>
        `).join('')}
      ` : ''}

      ${cardapio.balcao?.length ? `
        <div class="papel-secao">🏪 BALCÃO</div>
        ${cardapio.balcao.map(it => `
          <div class="papel-preco-linha">
            <span>${it.nome}</span>
            <span class="papel-valor">${formatarMoeda(it.preco)}</span>
          </div>
        `).join('')}
      ` : ''}
    </div>

    <!-- RESUMO RÁPIDO DO DIA -->
    <div class="papel-resumo-dia">
      <div class="papel-resumo-item">
        <div class="papel-resumo-num">${ativos.length}</div>
        <div class="papel-resumo-lab">Total</div>
      </div>
      <div class="papel-resumo-item destaque">
        <div class="papel-resumo-num">${novos}</div>
        <div class="papel-resumo-lab">Em aberto</div>
      </div>
      <div class="papel-resumo-item">
        <div class="papel-resumo-num">${entregues}</div>
        <div class="papel-resumo-lab">Entregues</div>
      </div>
      <div class="papel-resumo-item verde">
        <div class="papel-resumo-num" style="font-size:1rem">${formatarMoeda(faturamento)}</div>
        <div class="papel-resumo-lab">Faturamento</div>
      </div>
    </div>

    <!-- LISTA DE PEDIDOS DO DIA -->
    <div class="papel-card">
      <div class="papel-card-titulo">
        📋 Pedidos de Hoje
        <button class="btn btn-ghost btn-sm" id="btn-papel-refresh" style="margin-left:auto">↻ Atualizar</button>
      </div>

      ${ativos.length === 0 ? `
        <div style="text-align:center;padding:30px;color:var(--text3)">
          <div style="font-size:2rem;margin-bottom:8px">📋</div>
          <div>Nenhum pedido ainda hoje</div>
        </div>
      ` : ativos.map(p => `
        <div class="papel-pedido status-borda-${p.status}">
          <div class="papel-pedido-header">
            <div class="papel-pedido-num">#${p.numero}</div>
            <div class="papel-pedido-cliente">${p.cliente?.nome || 'Balcão'}</div>
            <span class="badge status-${p.status}" style="margin-left:auto">${statusLabel(p.status)}</span>
          </div>

          <div class="papel-pedido-itens">
            ${(p.itens || []).map(it => `
              <div class="papel-item-linha">
                <span class="papel-item-qty">${it.qty || 1}×</span>
                <span class="papel-item-nome">${it.nome || it.descricao || '?'}${it.proteina ? ' — ' + it.proteina : ''}</span>
                <span class="papel-item-preco">${formatarMoeda((it.preco || 0) * (it.qty || 1))}</span>
              </div>
            `).join('')}
          </div>

          <div class="papel-pedido-rodape">
            <span>${p.tipoEntrega === 'entrega' ? '🛵 ' + (p.bairro || 'Entrega') : '🏪 Retirada'}</span>
            <span>${p.formaPagamento || '—'}</span>
            <span style="font-size:.75rem;color:var(--text3)">${formatarHora(p.hora)}</span>
            <span class="papel-pedido-total">${formatarMoeda(p.total || 0)}</span>
          </div>

          ${p.troco > 0 ? `
            <div style="font-size:.8rem;color:var(--green);padding:4px 0">
              💵 Pagou ${formatarMoeda(p.pagoEm || 0)} → Troco: <strong>${formatarMoeda(p.troco)}</strong>
            </div>
          ` : ''}
        </div>
      `).join('')}

      ${cancelados > 0 ? `
        <div style="text-align:center;font-size:.78rem;color:var(--text3);margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
          ${cancelados} pedido${cancelados > 1 ? 's' : ''} cancelado${cancelados > 1 ? 's' : ''} (não mostrado${cancelados > 1 ? 's' : ''})
        </div>
      ` : ''}
    </div>
  `;

  el.querySelector('#btn-papel-refresh')?.addEventListener('click', renderPapel);
}

function statusLabel(s) {
  return { novo:'Novo', preparo:'Preparo', pronto:'Pronto!', entregue:'Entregue', cancelado:'Cancelado' }[s] || s;
}