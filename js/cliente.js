// ============================================================
//  cliente.js — Busca e cadastro de cliente
// ============================================================
import { getCliente, saveCliente, getConfig, adicionarEnderecoCliente } from './db.js';

let _resolve = null;
let _currentCliente = null;

// ── Abre o modal e retorna Promise com { cliente, endereco, tipoEntrega, bairro, taxaEntrega }
export function abrirModalCliente(clienteAtual = null) {
  return new Promise(resolve => {
    _resolve = resolve;
    _currentCliente = clienteAtual;
    buildModal();
    document.getElementById('modal-cliente').classList.remove('hidden');
    document.getElementById('input-telefone').focus();
    if (clienteAtual?.telefone) {
      document.getElementById('input-telefone').value = clienteAtual.telefone;
      buscarCliente(clienteAtual.telefone);
    }
  });
}

function fechar(resultado = null) {
  document.getElementById('modal-cliente').classList.add('hidden');
  if (_resolve) { _resolve(resultado); _resolve = null; }
}

function buildModal() {
  if (document.getElementById('modal-cliente')) {
    renderModalContent();
    return;
  }
  const overlay = document.createElement('div');
  overlay.id = 'modal-cliente';
  overlay.className = 'modal-overlay hidden';
  overlay.addEventListener('click', e => { if (e.target === overlay) fechar(null); });
  document.body.appendChild(overlay);
  renderModalContent();
}

function renderModalContent() {
  const cfg = getConfig();
  const overlay = document.getElementById('modal-cliente');
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">👤 Cliente & Entrega</div>
        <button class="modal-close" id="btn-fechar-cliente">✕</button>
      </div>

      <!-- Telefone + busca -->
      <div class="field mb-3">
        <label>Telefone</label>
        <div class="flex gap-2">
          <input class="input" id="input-telefone" placeholder="(11) 99999-9999" maxlength="15" style="flex:1">
          <button class="btn btn-primary" id="btn-buscar-tel">Buscar</button>
        </div>
      </div>

      <!-- Resultado / cadastro -->
      <div id="cliente-resultado"></div>

      <!-- Tipo de entrega -->
      <div class="section-label mt-3">Tipo</div>
      <div class="flex gap-2 mb-3" id="tipo-entrega-group">
        <button class="btn btn-ghost flex-1" data-tipo="retirada" id="btn-retirada">🏪 Retirada no local</button>
        <button class="btn btn-ghost flex-1" data-tipo="entrega"  id="btn-entrega">🛵 Entrega</button>
      </div>

      <!-- Endereço (só aparece em entrega) -->
      <div id="bloco-endereco" class="hidden">
        <div class="section-label">Bairro / Taxa de entrega</div>
        <select class="select mb-3" id="sel-bairro">
          <option value="">Selecione o bairro...</option>
          ${cfg.bairros.map(b => `<option value="${b.nome}" data-taxa="${b.taxa}">${b.nome} — ${b.taxa === 0 ? 'Grátis' : 'R$ ' + b.taxa.toFixed(2)}</option>`).join('')}
          <option value="__outro__">Outro bairro</option>
        </select>
        <div id="bloco-enderecos-salvos"></div>
        <div class="section-label mt-3">Endereço</div>
        <div class="field-row field-row-2 mb-2">
          <div class="field"><label>Logradouro</label><input class="input" id="end-logradouro" placeholder="Rua, Av..."></div>
          <div class="field"><label>Número</label><input class="input" id="end-numero" placeholder="123"></div>
        </div>
        <div class="field-row field-row-2 mb-2">
          <div class="field"><label>Complemento</label><input class="input" id="end-complemento" placeholder="Apto, Casa..."></div>
          <div class="field"><label>Referência</label><input class="input" id="end-referencia" placeholder="Próx. ao mercado..."></div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" id="btn-cliente-cancelar">Cancelar</button>
        <button class="btn btn-primary" id="btn-cliente-ok">Confirmar ✓</button>
      </div>
    </div>
  `;

  // Eventos
  overlay.querySelector('#btn-fechar-cliente').onclick = () => fechar(null);
  overlay.querySelector('#btn-cliente-cancelar').onclick = () => fechar(null);
  overlay.querySelector('#btn-buscar-tel').onclick = () => buscarCliente(document.getElementById('input-telefone').value);
  overlay.querySelector('#input-telefone').addEventListener('keydown', e => { if (e.key === 'Enter') buscarCliente(e.target.value); });
  overlay.querySelector('#input-telefone').addEventListener('input', e => {
    // Máscara telefone
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    e.target.value = v;
  });

  overlay.querySelector('#btn-retirada').onclick = () => setTipo('retirada');
  overlay.querySelector('#btn-entrega').onclick  = () => setTipo('entrega');
  overlay.querySelector('#sel-bairro')?.addEventListener('change', onBairroChange);
  overlay.querySelector('#btn-cliente-ok').onclick = confirmar;

  setTipo('retirada');
}

let _tipo = 'retirada';
let _bairro = '';
let _taxaEntrega = 0;
let _enderecoSelecionado = null;

function setTipo(tipo) {
  _tipo = tipo;
  const r = document.getElementById('btn-retirada');
  const e = document.getElementById('btn-entrega');
  const bloco = document.getElementById('bloco-endereco');
  if (tipo === 'retirada') {
    r.className = 'btn btn-primary flex-1';
    e.className = 'btn btn-ghost flex-1';
    bloco.classList.add('hidden');
  } else {
    e.className = 'btn btn-primary flex-1';
    r.className = 'btn btn-ghost flex-1';
    bloco.classList.remove('hidden');
  }
}

function onBairroChange(e) {
  const sel = e.target;
  const opt = sel.options[sel.selectedIndex];
  _bairro = sel.value;
  _taxaEntrega = parseFloat(opt.dataset.taxa || 0);
}

function buscarCliente(tel) {
  const digits = tel.replace(/\D/g, '');
  if (!digits || digits.length < 8) {
    showClienteForm(null);
    return;
  }
  const c = getCliente(digits);
  showClienteForm(c, digits);
}

function showClienteForm(c, tel = '') {
  const el = document.getElementById('cliente-resultado');
  if (!el) return;

  if (c) {
    // Cliente encontrado
    el.innerHTML = `
      <div class="cliente-card mb-3">
        <div class="cliente-avatar">${c.nome.charAt(0).toUpperCase()}</div>
        <div class="cliente-info">
          <div class="cliente-nome">${c.nome}</div>
          <div class="cliente-tel">${formatTel(c.telefone)}</div>
          ${c.observacaoFixa ? `<div class="cliente-obs">⚠️ ${c.observacaoFixa}</div>` : ''}
        </div>
        <button class="btn-icon" id="btn-editar-cliente" title="Editar cliente">✏️</button>
      </div>
      <div id="form-cliente-inline" class="hidden">
        <div class="field-row field-row-2 mb-2">
          <div class="field"><label>Nome</label><input class="input" id="input-nome" value="${c.nome}"></div>
          <div class="field"><label>Obs. fixa</label><input class="input" id="input-obs-fixa" value="${c.observacaoFixa || ''}" placeholder="sem cebola sempre..."></div>
        </div>
      </div>
    `;
    el.querySelector('#btn-editar-cliente').onclick = () => {
      el.querySelector('#form-cliente-inline').classList.toggle('hidden');
    };
    // Endereços salvos
    if (c.enderecos?.length) renderEnderecosSalvos(c.enderecos);
    _currentCliente = c;
  } else {
    // Novo cliente
    el.innerHTML = `
      <div class="section-label">Novo cliente</div>
      <div class="field-row field-row-2 mb-3">
        <div class="field"><label>Nome *</label><input class="input" id="input-nome" placeholder="Nome do cliente"></div>
        <div class="field"><label>Obs. fixa</label><input class="input" id="input-obs-fixa" placeholder="sem cebola sempre..."></div>
      </div>
    `;
    _currentCliente = null;
    if (tel) {
      const inp = document.getElementById('input-telefone');
      if (inp && !inp.value) inp.value = formatTel(tel);
    }
  }
}

function renderEnderecosSalvos(enderecos) {
  const el = document.getElementById('bloco-enderecos-salvos');
  if (!el) return;
  el.innerHTML = `
    <div class="section-label">Endereços salvos</div>
    <div class="endereco-list">
      ${enderecos.map(end => `
        <div class="endereco-item" data-id="${end.id}" data-bairro="${end.bairro}">
          <span class="ico">📍</span>
          <span>${end.logradouro}${end.numero ? ', '+end.numero : ''}${end.bairro ? ' — '+end.bairro : ''}</span>
          <span class="taxa"></span>
        </div>
      `).join('')}
    </div>
    <div class="section-label mt-2">Ou novo endereço</div>
  `;
  el.querySelectorAll('.endereco-item').forEach(item => {
    item.addEventListener('click', () => {
      el.querySelectorAll('.endereco-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      const end = enderecos.find(e => e.id === item.dataset.id);
      if (end) {
        _enderecoSelecionado = end;
        // Selecionar bairro correspondente
        const sel = document.getElementById('sel-bairro');
        if (sel && end.bairro) {
          for (let opt of sel.options) {
            if (opt.value === end.bairro) {
              sel.value = end.bairro;
              _bairro = end.bairro;
              _taxaEntrega = parseFloat(opt.dataset.taxa || 0);
              break;
            }
          }
        }
        if (document.getElementById('end-logradouro')) document.getElementById('end-logradouro').value = end.logradouro || '';
        if (document.getElementById('end-numero')) document.getElementById('end-numero').value = end.numero || '';
        if (document.getElementById('end-complemento')) document.getElementById('end-complemento').value = end.complemento || '';
        if (document.getElementById('end-referencia')) document.getElementById('end-referencia').value = end.referencia || '';
      }
    });
  });
}

function confirmar() {
  const telInput = document.getElementById('input-telefone');
  const nomeInput = document.getElementById('input-nome');
  const obsInput  = document.getElementById('input-obs-fixa');

  const tel  = (telInput?.value || '').replace(/\D/g, '');
  const nome = nomeInput?.value.trim() || '';

  // Salvar/atualizar cliente
  let cliente = { telefone: tel, nome, observacaoFixa: obsInput?.value.trim() || '' };
  if (tel && nome) {
    saveCliente(cliente);
  } else if (tel) {
    cliente = getCliente(tel) ?? { telefone: tel, nome: 'Sem nome' };
  } else {
    cliente = { telefone: '', nome: 'Balcão' };
  }

  // Montar endereço se entrega
  let endereco = null;
  if (_tipo === 'entrega') {
    const logr = document.getElementById('end-logradouro')?.value.trim();
    const num  = document.getElementById('end-numero')?.value.trim();
    const comp = document.getElementById('end-complemento')?.value.trim();
    const ref  = document.getElementById('end-referencia')?.value.trim();
    endereco = {
      logradouro:  logr || '',
      numero:      num  || '',
      complemento: comp || '',
      referencia:  ref  || '',
      bairro:      _bairro || '',
    };
    if (logr && tel) adicionarEnderecoCliente(tel, endereco);
  }

  fechar({ cliente, tipoEntrega: _tipo, endereco, bairro: _bairro, taxaEntrega: _taxaEntrega });
}

function formatTel(t) {
  const d = t.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return t;
}
