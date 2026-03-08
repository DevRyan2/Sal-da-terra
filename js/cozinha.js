// ============================================================
//  cozinha.js — Painel da Cozinha
// ============================================================
import { getPedidos, atualizarStatusPedido, syncPedidosFirebase, hoje, formatarHora } from './db.js';

let _pedidosAtivos = [];
let _pollInterval  = null;

document.addEventListener('DOMContentLoaded', () => {
  render();
  startPolling();

  document.getElementById('btn-refresh-cozinha')?.addEventListener('click', () => { render(); });

  // Som de alerta
  document.getElementById('btn-toggle-som')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.classList.toggle('ativo');
    btn.textContent = btn.classList.contains('ativo') ? '🔔 Som ligado' : '🔕 Som desligado';
  });
});

async function render() {
  await syncPedidosFirebase(hoje()).catch(() => {});
  const pedidos = getPedidos(hoje());
  const ativos  = pedidos.filter(p => p.status === 'novo' || p.status === 'preparo');
  const prontos = pedidos.filter(p => p.status === 'pronto');

  // Detectar novos pedidos
  const idsAtuais = ativos.map(p => p.id);
  const idsAntes  = _pedidosAtivos.map(p => p.id);
  const novos = idsAtuais.filter(id => !idsAntes.includes(id));
  if (novos.length > 0) alertarNovoPedido();
  _pedidosAtivos = ativos;

  // Atualizar contador
  const counter = document.getElementById('cozinha-counter');
  if (counter) counter.textContent = `${ativos.length} em fila · ${prontos.length} pronto${prontos.length !== 1 ? 's' : ''}`;

  const grid = document.getElementById('kitchen-grid');
  if (!grid) return;

  if (ativos.length === 0 && prontos.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text3)">
        <div style="font-size:3rem;margin-bottom:12px">✓</div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:1.5rem;font-weight:700">Fila limpa!</div>
        <div style="margin-top:8px">Nenhum pedido aguardando</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = [...ativos, ...prontos].map(p => renderKitchenCard(p)).join('');

  // Eventos dos botões
  grid.querySelectorAll('[data-btn-status]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      atualizarStatusPedido(btn.dataset.id, btn.dataset.btn_status);
      render();
    });
  });
}

function renderKitchenCard(p) {
  const itens    = (p.itens || []).map(it => {
    const nome     = it.nome || it.descricao || '?';
    const proteina = it.proteina ? `<strong>${it.proteina}</strong>` : '';
    const acomps   = it.acompanhamentos?.length ? it.acompanhamentos.join(', ') : '';
    const obs      = it.obs ? `<em style="color:var(--accent)">${it.obs}</em>` : '';
    const partes   = [proteina, acomps, obs].filter(Boolean).join(' · ');
    return `
      <div class="kitchen-item">
        <span>${it.qty || 1}× ${nome}</span>
        ${partes ? `<div style="font-size:.82rem;color:var(--text2);padding-left:12px;margin-top:2px">${partes}</div>` : ''}
      </div>
    `;
  }).join('');

  const tipoIcon = p.tipoEntrega === 'entrega' ? '🛵' : '🏪';
  const minutos  = Math.floor((Date.now() - p.hora) / 60000);
  const timerColor = minutos > 20 ? 'var(--hot)' : minutos > 10 ? 'var(--accent)' : 'var(--text2)';

  let acoes = '';
  if (p.status === 'novo')    acoes = `<button class="btn btn-primary btn-sm" data-btn-status="preparo" data-id="${p.id}">🔥 Iniciar preparo</button>`;
  if (p.status === 'preparo') acoes = `<button class="btn btn-success btn-sm" data-btn-status="pronto"  data-id="${p.id}">✓ Marcar pronto</button>`;
  if (p.status === 'pronto')  acoes = `<button class="btn btn-ghost btn-sm"   data-btn-status="entregue" data-id="${p.id}">✓ Entregue</button>`;

  return `
    <div class="kitchen-card status-${p.status}">
      <div class="kitchen-card-head">
        <div>
          <div class="kitchen-num">#${p.numero} — ${p.cliente?.nome || 'Balcão'}</div>
          <div style="font-size:.8rem;color:var(--text2)">${tipoIcon} ${p.tipoEntrega === 'entrega' ? p.bairro || 'Entrega' : 'Retirada'} · ${formatarHora(p.hora)}</div>
        </div>
        <div>
          <span class="badge status-${p.status}" style="display:block;text-align:center;margin-bottom:4px">${statusLabel(p.status)}</span>
          <div class="kitchen-timer" style="color:${timerColor}">${minutos}min</div>
        </div>
      </div>
      <div class="kitchen-body">
        ${itens}
        ${p.observacao ? `<div class="kitchen-obs">📝 ${p.observacao}</div>` : ''}
        ${p.cliente?.observacaoFixa ? `<div class="kitchen-obs" style="color:var(--hot)">⚠️ FIXO: ${p.cliente.observacaoFixa}</div>` : ''}
      </div>
      <div class="kitchen-foot">${acoes}</div>
    </div>
  `;
}

function startPolling() {
  if (_pollInterval) clearInterval(_pollInterval);
  _pollInterval = setInterval(render, 10000); // Atualiza a cada 10s
}

function alertarNovoPedido() {
  const somLigado = document.getElementById('btn-toggle-som')?.classList.contains('ativo');
  if (somLigado) {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }
  // Flash visual
  document.body.style.outline = '4px solid var(--green)';
  setTimeout(() => document.body.style.outline = '', 600);
}

function statusLabel(s) {
  return { novo:'Novo', preparo:'Preparo', pronto:'Pronto!', entregue:'Entregue' }[s] || s;
}
