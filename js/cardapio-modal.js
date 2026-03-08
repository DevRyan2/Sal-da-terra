// ============================================================
//  cardapio-modal.js — Modal de configuração do cardápio do dia
// ============================================================
import { getCardapio, saveCardapio, getConfig, hoje, formatarMoeda } from './db.js';
import { toast } from '../app.js';

export function abrirModalCardapio(onClose) {
  const cardapio = getCardapio(hoje());
  const cfg      = getConfig();

  let overlay = document.getElementById('modal-cardapio');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-cardapio';
    overlay.className = 'modal-overlay hidden';
    document.body.appendChild(overlay);
  }
  overlay.classList.remove('hidden');

  overlay.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title">⚙️ Cardápio do Dia — ${new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' })}</div>
        <button class="modal-close" id="close-cardapio">✕</button>
      </div>

      <!-- Tamanhos Quentinha -->
      <div class="section-label">Tamanhos & Preços da Quentinha</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        ${cardapio.tamanhos.map(t => `
          <div class="card" style="padding:12px">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:1.2rem;font-weight:800;color:var(--accent)">${t.sigla} — ${t.label}</div>
            <div class="field-row field-row-2 mt-2">
              <div class="field"><label>Preço</label><input class="input" id="preco-${t.sigla}" type="number" value="${t.preco}" step="0.50"></div>
              <div class="field"><label>Máx (0=∞)</label><input class="input" id="max-${t.sigla}" type="number" value="${t.max || 0}"></div>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <label style="font-size:.82rem;color:var(--text2)">Disponível:</label>
              <input type="checkbox" id="disp-${t.sigla}" ${t.disponivel !== false ? 'checked' : ''}>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Proteínas do dia -->
      <div class="section-label">Proteínas disponíveis hoje</div>
      <div class="chip-group mb-3" id="proteinas-chips">
        ${cfg.proteinas.map(p => `
          <div class="chip ${cardapio.proteinas_dia.includes(p) ? 'selected' : ''}" data-prot="${p}">${p}</div>
        `).join('')}
      </div>

      <!-- Acompanhamentos -->
      <div class="section-label">Acompanhamentos disponíveis</div>
      <div class="chip-group mb-3" id="acomp-chips">
        ${['Arroz branco','Feijão','Feijão tropeiro','Macarrão','Farofa','Salada','Fritas','Mandioca frita','Legumes','Purê'].map(a => `
          <div class="chip ${(cfg.acompanhamentos || []).includes(a) ? 'selected' : ''}" data-acomp="${a}">${a}</div>
        `).join('')}
        <input class="input" id="novo-acomp" placeholder="+ Outro acompanhamento..." style="width:220px">
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="cancel-cardapio">Fechar</button>
        <button class="btn btn-primary" id="save-cardapio">✓ Salvar cardápio do dia</button>
      </div>
    </div>
  `;

  const fechar = () => {
    overlay.classList.add('hidden');
    if (onClose) onClose();
  };

  overlay.querySelector('#close-cardapio').onclick   = fechar;
  overlay.querySelector('#cancel-cardapio').onclick  = fechar;
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(); });

  overlay.querySelectorAll('.chip[data-prot]').forEach(c => c.addEventListener('click', () => c.classList.toggle('selected')));
  overlay.querySelectorAll('.chip[data-acomp]').forEach(c => c.addEventListener('click', () => c.classList.toggle('selected')));

  overlay.querySelector('#save-cardapio').onclick = () => {
    // Tamanhos
    cardapio.tamanhos = cardapio.tamanhos.map(t => ({
      ...t,
      preco:     parseFloat(overlay.querySelector(`#preco-${t.sigla}`)?.value || t.preco),
      max:       parseInt(overlay.querySelector(`#max-${t.sigla}`)?.value || 0),
      disponivel: overlay.querySelector(`#disp-${t.sigla}`)?.checked ?? true,
    }));

    // Proteínas
    cardapio.proteinas_dia = [...overlay.querySelectorAll('.chip[data-prot].selected')].map(c => c.dataset.prot);

    // Acompanhamentos
    const acomps = [...overlay.querySelectorAll('.chip[data-acomp].selected')].map(c => c.dataset.acomp);
    const novoAcomp = overlay.querySelector('#novo-acomp').value.trim();
    if (novoAcomp) acomps.push(novoAcomp);

    saveCardapio(hoje(), cardapio);

    // Salvar acompanhamentos na config
    const cfgAtual = JSON.parse(localStorage.getItem('REST_CONFIG') || '{}');
    cfgAtual.acompanhamentos = acomps;
    localStorage.setItem('REST_CONFIG', JSON.stringify(cfgAtual));

    toast('Cardápio do dia salvo!', 'success');
    fechar();
  };
}
