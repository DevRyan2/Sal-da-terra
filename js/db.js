// ============================================================
//  db.js — Camada de dados (localStorage + Firebase opcional)
// ============================================================
import { FIREBASE_URL, BAIRROS_PADRAO, PROTEINAS_PADRAO, BALCAO_PADRAO, TAMANHOS_QUENTINHA, RESTAURANTE } from './config.js';

// ── Helpers de data ─────────────────────────────────────────
export function hoje() {
  return new Date().toISOString().split('T')[0];
}
export function formatarData(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
export function formatarHora(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
export function formatarMoeda(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

// ── Chaves localStorage ──────────────────────────────────────
const KEY_CONFIG   = 'REST_CONFIG';
const KEY_CARDAPIO = d => `REST_CARDAPIO_${d}`;
const KEY_PEDIDOS  = d => `REST_PEDIDOS_${d}`;
const KEY_COUNTER  = 'REST_PEDIDO_COUNTER';
const KEY_CLIENTES = 'REST_CLIENTES';

function ls_get(key, def = null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function ls_set(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── Config do restaurante ────────────────────────────────────
export function getConfig() {
  const saved = ls_get(KEY_CONFIG, {});
  return {
    nome:      saved.nome      ?? RESTAURANTE.nome,
    subtitulo: saved.subtitulo ?? RESTAURANTE.subtitulo,
    telefone:  saved.telefone  ?? RESTAURANTE.telefone,
    endereco:  saved.endereco  ?? RESTAURANTE.endereco,
    pixChave:  saved.pixChave  ?? RESTAURANTE.pixChave,
    pixNome:   saved.pixNome   ?? RESTAURANTE.pixNome,
    bairros:   saved.bairros   ?? BAIRROS_PADRAO,
    proteinas: saved.proteinas ?? PROTEINAS_PADRAO,
    acompanhamentos: saved.acompanhamentos ?? [],
  };
}
export function saveConfig(data) {
  ls_set(KEY_CONFIG, data);
  firebaseSet('config', data);
}

// ── Cardápio do dia ──────────────────────────────────────────
export function getCardapio(data = hoje()) {
  return ls_get(KEY_CARDAPIO(data), {
    quentinhas:     [],
    pratos:         [],
    balcao:         BALCAO_PADRAO,
    proteinas_dia:  [],
    tamanhos:       TAMANHOS_QUENTINHA,
  });
}
export function saveCardapio(data = hoje(), cardapio) {
  ls_set(KEY_CARDAPIO(data), cardapio);
  firebaseSet(`cardapio/${data}`, cardapio);
}
export function addProteinaDia(nome, data = hoje()) {
  const c = getCardapio(data);
  if (!c.proteinas_dia.includes(nome)) c.proteinas_dia.push(nome);
  saveCardapio(data, c);
}
export function addPratoDia(prato, data = hoje()) {
  const c = getCardapio(data);
  const id = Date.now().toString(36);
  c.pratos.push({ id, ...prato, disponivel: true, vendidos: 0 });
  saveCardapio(data, c);
  return id;
}
export function addBalcaoItem(item) {
  const c = getCardapio(hoje());
  const id = Date.now().toString(36);
  c.balcao.push({ id, ...item });
  saveCardapio(hoje(), c);
  return id;
}
export function setTamanhoQuentinha(sigla, preco, disponivel, max) {
  const c = getCardapio(hoje());
  c.tamanhos = c.tamanhos.map(t =>
    t.sigla === sigla ? { ...t, preco, disponivel: disponivel ?? t.disponivel, max: max ?? t.max } : t
  );
  saveCardapio(hoje(), c);
}

// ── Pedidos ──────────────────────────────────────────────────
let _counter = ls_get(KEY_COUNTER, 0);

export function getPedidos(data = hoje()) {
  return ls_get(KEY_PEDIDOS(data), []);
}
export function savePedido(pedido) {
  const data = pedido.data || hoje();
  const lista = getPedidos(data);
  const idx = lista.findIndex(p => p.id === pedido.id);
  if (idx >= 0) lista[idx] = pedido;
  else lista.push(pedido);
  ls_set(KEY_PEDIDOS(data), lista);
  firebaseSet(`pedidos/${data}/${pedido.id}`, pedido);
  return pedido;
}
export function novoPedido(parcial) {
  _counter++;
  ls_set(KEY_COUNTER, _counter);
  const pedido = {
    id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    numero:  _counter,
    data:    hoje(),
    hora:    Date.now(),
    status:  'novo',   // novo | preparo | pronto | entregue | cancelado
    ...parcial,
  };
  return savePedido(pedido);
}
export function atualizarStatusPedido(id, status, data = hoje()) {
  const lista = getPedidos(data);
  const pedido = lista.find(p => p.id === id);
  if (!pedido) return;
  pedido.status = status;
  pedido.statusAt = Date.now();
  ls_set(KEY_PEDIDOS(data), lista);
  firebaseSet(`pedidos/${data}/${id}/status`, status);
  firebaseSet(`pedidos/${data}/${id}/statusAt`, pedido.statusAt);
  return pedido;
}
export function cancelarPedido(id, data = hoje()) {
  return atualizarStatusPedido(id, 'cancelado', data);
}

// ── Clientes ─────────────────────────────────────────────────
export function getClientes() {
  return ls_get(KEY_CLIENTES, {});
}
export function getCliente(telefone) {
  const tel = telefone.replace(/\D/g, '');
  return getClientes()[tel] ?? null;
}
export function saveCliente(cliente) {
  const tel = cliente.telefone.replace(/\D/g, '');
  const todos = getClientes();
  todos[tel] = { ...todos[tel], ...cliente, telefone: tel };
  ls_set(KEY_CLIENTES, todos);
  firebaseSet(`clientes/${tel}`, todos[tel]);
  return todos[tel];
}
export function adicionarEnderecoCliente(telefone, endereco) {
  const tel = telefone.replace(/\D/g, '');
  const todos = getClientes();
  const c = todos[tel] ?? { telefone: tel, nome: '', enderecos: [] };
  if (!c.enderecos) c.enderecos = [];
  // Evita duplicata
  const existe = c.enderecos.find(e => e.logradouro === endereco.logradouro && e.bairro === endereco.bairro);
  if (!existe) c.enderecos.unshift({ ...endereco, id: Date.now().toString(36) });
  if (c.enderecos.length > 10) c.enderecos = c.enderecos.slice(0, 10);
  todos[tel] = c;
  ls_set(KEY_CLIENTES, todos);
  return c;
}
export function registrarPedidoNoCliente(telefone, pedidoId, resumo) {
  const tel = telefone.replace(/\D/g, '');
  const todos = getClientes();
  const c = todos[tel];
  if (!c) return;
  if (!c.historico) c.historico = [];
  c.historico.unshift({ pedidoId, data: hoje(), resumo, ts: Date.now() });
  if (c.historico.length > 50) c.historico = c.historico.slice(0, 50);
  todos[tel] = c;
  ls_set(KEY_CLIENTES, todos);
}

// ── Estatísticas ─────────────────────────────────────────────
export function getEstatisticasDia(data = hoje()) {
  const pedidos = getPedidos(data).filter(p => p.status !== 'cancelado');
  const total   = pedidos.reduce((s, p) => s + (p.total || 0), 0);
  const qtd     = pedidos.length;
  const ticket  = qtd ? total / qtd : 0;

  // Proteínas
  const proteinas = {};
  // Itens mais vendidos
  const itens = {};
  // Bairros
  const bairros = {};
  // Formas de pagamento
  const formas = {};
  // Entregas vs retiradas
  let entregas = 0, retiradas = 0;

  pedidos.forEach(p => {
    // pagamento
    const fp = p.formaPagamento || 'Não informado';
    formas[fp] = (formas[fp] || 0) + 1;
    // entrega
    if (p.tipoEntrega === 'entrega') { entregas++; if (p.bairro) bairros[p.bairro] = (bairros[p.bairro] || 0) + 1; }
    else retiradas++;
    // itens
    (p.itens || []).forEach(it => {
      const nome = it.nome || it.descricao || '?';
      itens[nome] = (itens[nome] || 0) + (it.qty || 1);
      if (it.proteina) proteinas[it.proteina] = (proteinas[it.proteina] || 0) + 1;
    });
  });

  return { total, qtd, ticket, proteinas, itens, bairros, formas, entregas, retiradas };
}

// ── Firebase REST (opcional) ─────────────────────────────────
async function firebaseSet(path, data) {
  if (!FIREBASE_URL) return;
  try {
    await fetch(`${FIREBASE_URL}/${path}.json`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch {}
}
export async function firebaseGet(path) {
  if (!FIREBASE_URL) return null;
  try {
    const r = await fetch(`${FIREBASE_URL}/${path}.json`);
    return await r.json();
  } catch { return null; }
}
// Sincronizar pedidos do Firebase para localStorage (cozinha usa isso)
export async function syncPedidosFirebase(data = hoje()) {
  if (!FIREBASE_URL) return getPedidos(data);
  const remote = await firebaseGet(`pedidos/${data}`);
  if (!remote) return getPedidos(data);
  const lista = Object.values(remote).sort((a, b) => (a.hora || 0) - (b.hora || 0));
  ls_set(KEY_PEDIDOS(data), lista);
  return lista;
}
