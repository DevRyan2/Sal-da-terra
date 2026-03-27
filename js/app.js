// ============================================================
//  app.js — Controlador principal
// ============================================================
import { getConfig, saveConfig, hoje, formatarMoeda } from './db.js';
import { toast } from './utils.js';
import { renderQuentinha, renderPrato, wirePratoEvents, renderBalcao } from './tabs.js';
import { initSidebar, refreshSidebar } from './modules/pedido-list.js';

let _tabAtual = 'quentinha';
let _statsInited = false;

// ── openPage — chamada pelos botões do topbar ─────────────────
window.openPage = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const section = document.getElementById(`page-${page}`);
  if (section) section.classList.add('active');

  if (page === 'stats')   _initStats();
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const cfg = getConfig();
  document.querySelector('.topbar-logo').innerHTML = `${cfg.nome} <span>${cfg.subtitulo || ''}</span>`;
  document.title = cfg.nome;

  // Relógio
  const clk = document.getElementById('topbar-clock');
  if (clk) {
    const tick = () => clk.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    tick(); setInterval(tick, 1000);
  }

  // Navegação das abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Sidebar de pedidos (lado direito do layout principal)
  const sidebarEl = document.getElementById('sidebar-pedidos');
  if (sidebarEl) {
    initSidebar(pedido => {
      console.log('Pedido selecionado:', pedido);
    });
  }

  // Botões do topbar — abrem as páginas internas
  document.getElementById('btn-abrir-stats')?.addEventListener('click',   () => openPage('stats'));

  // Botões voltar
  document.getElementById('btn-voltar-stats')?.addEventListener('click',   () => openPage('app'));

  // Config do restaurante
  document.getElementById('btn-config-restaurante')?.addEventListener('click', abrirConfigRestaurante);

  // Data inicial do stats
  const dateEl = document.getElementById('stats-date');
  if (dateEl) dateEl.value = hoje();

  // Iniciar na aba quentinha
  switchTab('quentinha');

  // Auto-refresh da sidebar a cada 30s
  setInterval(refreshSidebar, 30000);

  // ── Drawer mobile do carrinho ─────────────────────────────
  const cartPanel  = document.querySelector('.panel-right');
  const fabBtn     = document.getElementById('btn-cart-mobile');
  const overlay    = document.getElementById('cart-drawer-overlay');
  const badge      = document.getElementById('cart-count-badge');

  function abrirCartDrawer() {
    cartPanel?.classList.add('open');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function fecharCartDrawer() {
    cartPanel?.classList.remove('open');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  fabBtn?.addEventListener('click', abrirCartDrawer);
  overlay?.addEventListener('click', fecharCartDrawer);

  // Atualizar badge do FAB quando sidebar mudar
  const badgeObserver = new MutationObserver(() => {
    const countEl = document.querySelector('.orders-sidebar-title .badge-accent, .badge-accent');
    if (countEl && badge) badge.textContent = countEl.textContent.trim() || '0';
  });
  if (cartPanel) badgeObserver.observe(cartPanel, { childList: true, subtree: true });

  // Fechar drawer ao confirmar pedido (quando cart fica vazio)
  document.addEventListener('click', e => {
    if (e.target?.id?.includes('confirmar')) {
      setTimeout(fecharCartDrawer, 400);
    }
  });
});

function switchTab(tab) {
  _tabAtual = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));

  const el = document.getElementById(`tab-${tab}`);
  if (el) el.classList.remove('hidden');

  if (tab === 'quentinha') renderQuentinha();
  if (tab === 'prato')     { renderPrato(); wirePratoEvents(); }
  if (tab === 'balcao')    renderBalcao();
}

// ── Lazy init de Stats ────────────────────────────────────────
async function _initStats() {
  const mod = await import('./stats.js');
  const dateVal = document.getElementById('stats-date')?.value || hoje();
  mod.renderStats?.(dateVal);

  // Garante que o listener de data funcione sempre
  if (!_statsInited) {
    _statsInited = true;
    document.getElementById('stats-date')?.addEventListener('change', e => {
      mod.renderStats?.(e.target.value);
    });
  }
}

// ── Modal de configuração do restaurante ─────────────────────
function abrirConfigRestaurante() {
  const cfg = getConfig();
  let overlay = document.getElementById('modal-config-rest');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-config-rest';
    overlay.className = 'modal-overlay hidden';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title">⚙️ Configurações do Restaurante</div>
        <button class="modal-close" id="close-cfg">✕</button>
      </div>

      <div class="section-label">Dados do estabelecimento</div>
      <div class="field-row field-row-2 mb-3">
        <div class="field"><label>Nome</label><input class="input" id="cfg-nome" value="${cfg.nome}"></div>
        <div class="field"><label>Subtítulo</label><input class="input" id="cfg-sub" value="${cfg.subtitulo || ''}"></div>
      </div>
      <div class="field-row field-row-2 mb-3">
        <div class="field"><label>Telefone</label><input class="input" id="cfg-tel" value="${cfg.telefone}"></div>
        <div class="field"><label>Endereço</label><input class="input" id="cfg-end" value="${cfg.endereco}"></div>
      </div>
      <div class="field-row field-row-2 mb-3">
        <div class="field"><label>Chave Pix</label><input class="input" id="cfg-pix" value="${cfg.pixChave}"></div>
        <div class="field"><label>Nome Pix</label><input class="input" id="cfg-pixnome" value="${cfg.pixNome || ''}"></div>
      </div>

      <div class="section-label">Bairros & Taxas de entrega</div>
      <div id="lista-bairros" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
        ${cfg.bairros.map((b, i) => `
          <div class="flex gap-2 items-center" data-bairro-idx="${i}">
            <input class="input" style="flex:2" value="${b.nome}" placeholder="Bairro">
            <input class="input" style="flex:1;max-width:100px" type="number" value="${b.taxa}" placeholder="Taxa R$">
            <button class="btn-icon remove-bairro" data-idx="${i}">✕</button>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-ghost btn-sm mb-3" id="btn-add-bairro">+ Adicionar bairro</button>

      <div class="section-label">Proteínas disponíveis</div>
      <div id="lista-proteinas" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
        ${cfg.proteinas.map((p, i) => `
          <div class="flex gap-1 items-center" style="background:var(--card2);border:1px solid var(--border2);border-radius:99px;padding:3px 10px">
            <span style="font-size:.88rem">${p}</span>
            <button class="btn-icon remove-prot" data-idx="${i}" style="background:none;border:none;color:var(--text3);padding:0 0 0 4px">✕</button>
          </div>
        `).join('')}
      </div>
      <div class="flex gap-2 mb-3">
        <input class="input" id="nova-proteina" placeholder="Nova proteína..." style="flex:1">
        <button class="btn btn-ghost btn-sm" id="btn-add-prot">+ Add</button>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="cancel-cfg">Fechar</button>
        <button class="btn btn-primary" id="save-cfg">✓ Salvar configurações</button>
      </div>
    </div>
  `;

  overlay.classList.remove('hidden');
  const fechar = () => overlay.classList.add('hidden');
  overlay.querySelector('#close-cfg').onclick  = fechar;
  overlay.querySelector('#cancel-cfg').onclick = fechar;
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

  overlay.querySelectorAll('.remove-bairro').forEach(btn => {
    btn.addEventListener('click', () => { cfg.bairros.splice(parseInt(btn.dataset.idx), 1); abrirConfigRestaurante(); });
  });
  overlay.querySelector('#btn-add-bairro')?.addEventListener('click', () => {
    const li = document.createElement('div');
    li.className = 'flex gap-2 items-center';
    li.innerHTML = `<input class="input" style="flex:2" placeholder="Nome do bairro"><input class="input" style="flex:1;max-width:100px" type="number" placeholder="Taxa R$"><button class="btn-icon remove-bairro-new">✕</button>`;
    overlay.querySelector('#lista-bairros').appendChild(li);
    li.querySelector('.remove-bairro-new').onclick = () => li.remove();
  });
  overlay.querySelectorAll('.remove-prot').forEach(btn => {
    btn.addEventListener('click', () => { cfg.proteinas.splice(parseInt(btn.dataset.idx), 1); abrirConfigRestaurante(); });
  });
  overlay.querySelector('#btn-add-prot')?.addEventListener('click', () => {
    const inp = overlay.querySelector('#nova-proteina');
    const v   = inp.value.trim();
    if (v) { cfg.proteinas.push(v); abrirConfigRestaurante(); }
  });

  overlay.querySelector('#save-cfg').onclick = () => {
    const novoCfg = {
      ...cfg,
      nome:      overlay.querySelector('#cfg-nome').value.trim(),
      subtitulo: overlay.querySelector('#cfg-sub').value.trim(),
      telefone:  overlay.querySelector('#cfg-tel').value.trim(),
      endereco:  overlay.querySelector('#cfg-end').value.trim(),
      pixChave:  overlay.querySelector('#cfg-pix').value.trim(),
      pixNome:   overlay.querySelector('#cfg-pixnome').value.trim(),
    };
    const bairroEls = overlay.querySelectorAll('#lista-bairros > div');
    novoCfg.bairros = [];
    bairroEls.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const nome   = inputs[0]?.value.trim();
      const taxa   = parseFloat(inputs[1]?.value || 0);
      if (nome) novoCfg.bairros.push({ nome, taxa });
    });
    saveConfig(novoCfg);
    document.querySelector('.topbar-logo').innerHTML = `${novoCfg.nome} <span>${novoCfg.subtitulo || ''}</span>`;
    document.title = novoCfg.nome;
    fechar();
    toast('Configurações salvas!', 'success');
  };
}