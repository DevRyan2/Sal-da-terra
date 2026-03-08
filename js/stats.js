// ============================================================
//  stats.js — Estatísticas
// ============================================================
import { getPedidos, getEstatisticasDia, formatarMoeda, hoje } from './db.js';

// ── Exportado: chamado pelo app.js ao abrir a página ─────────
export function renderStats(data) {
  data = data || hoje();

  const stats      = getEstatisticasDia(data);
  const pedidos    = getPedidos(data).filter(p => p.status !== 'cancelado');
  const cancelados = getPedidos(data).filter(p => p.status === 'cancelado').length;

  // KPIs
  document.getElementById('stat-faturamento').textContent = formatarMoeda(stats.total);
  document.getElementById('stat-pedidos').textContent     = stats.qtd;
  document.getElementById('stat-ticket').textContent      = formatarMoeda(stats.ticket);
  document.getElementById('stat-cancelados').textContent  = cancelados;
  document.getElementById('stat-entregas').textContent    = stats.entregas;
  document.getElementById('stat-retiradas').textContent   = stats.retiradas;

  // Proteínas ranking
  const protRank = Object.entries(stats.proteinas).sort((a, b) => b[1] - a[1]).slice(0, 10);
  document.getElementById('proteinas-ranking').innerHTML = protRank.length === 0
    ? '<div style="color:var(--text3);font-size:.88rem">Nenhum dado</div>'
    : protRank.map(([nome, qtd], i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:1.1rem;font-weight:800;color:var(--accent);min-width:20px">${i+1}°</span>
        <span style="flex:1;font-weight:600">${nome}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.88rem;color:var(--text2)">${qtd}×</span>
        <div style="width:80px;height:6px;background:var(--border2);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${Math.round(qtd/protRank[0][1]*100)}%;background:var(--accent);border-radius:99px"></div>
        </div>
      </div>
    `).join('');

  // Itens mais vendidos
  const itensRank = Object.entries(stats.itens).sort((a, b) => b[1] - a[1]).slice(0, 8);
  document.getElementById('itens-ranking').innerHTML = itensRank.length === 0
    ? '<div style="color:var(--text3);font-size:.88rem">Nenhum dado</div>'
    : itensRank.map(([nome, qtd]) => `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-size:.9rem">${nome}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.82rem;background:var(--card2);padding:2px 7px;border-radius:99px">${qtd}×</span>
      </div>
    `).join('');

  // Formas de pagamento
  const formas = Object.entries(stats.formas).sort((a, b) => b[1] - a[1]);
  document.getElementById('formas-pagamento').innerHTML = formas.length === 0
    ? '<div style="color:var(--text3);font-size:.88rem">Nenhum dado</div>'
    : formas.map(([forma, qtd]) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
        <span>${payIcon(forma)} ${forma}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.88rem">${qtd} (${stats.qtd > 0 ? Math.round(qtd/stats.qtd*100) : 0}%)</span>
      </div>
    `).join('');

  // Bairros
  const bairros = Object.entries(stats.bairros).sort((a, b) => b[1] - a[1]);
  document.getElementById('bairros-ranking').innerHTML = bairros.length === 0
    ? '<div style="color:var(--text3);font-size:.88rem">Só retiradas hoje</div>'
    : bairros.map(([bairro, qtd]) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
        <span>📍 ${bairro}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:.88rem">${qtd} entrega${qtd !== 1 ? 's' : ''}</span>
      </div>
    `).join('');

  // Lista de pedidos
  document.getElementById('lista-pedidos-stats').innerHTML = pedidos.length === 0
    ? '<div style="color:var(--text3);font-size:.88rem;text-align:center;padding:20px">Sem pedidos para esta data</div>'
    : [...pedidos].reverse().map(p => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border);font-size:.88rem">
        <span style="font-family:'JetBrains Mono',monospace;color:var(--text3)">#${p.numero}</span>
        <span style="flex:1;font-weight:600">${p.cliente?.nome || 'Balcão'}</span>
        <span class="badge status-${p.status}">${statusLabel(p.status)}</span>
        <span>${p.tipoEntrega === 'entrega' ? '🛵' : '🏪'}</span>
        <span style="font-family:'JetBrains Mono',monospace;color:var(--accent)">${formatarMoeda(p.total)}</span>
      </div>
    `).join('');
}

function payIcon(f) {
  return { Pix:'💠', Dinheiro:'💵', 'Cartão Débito':'💳', 'Cartão Crédito':'💳' }[f] || '💰';
}
function statusLabel(s) {
  return { novo:'Novo', preparo:'Preparo', pronto:'Pronto', entregue:'Entregue', cancelado:'Cancelado' }[s] || s;
}
