// ============================================================
//  impressao.js — Geração e impressão de nota
// ============================================================
import { getConfig, formatarMoeda, formatarHora } from '../db.js';

// ── Gerador de payload PIX (BR Code / EMV) ───────────────────
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function campo(id, valor) {
  const len = String(valor.length).padStart(2, '0');
  return id + len + valor;
}

function limpar(str, max) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, '')    // só letras, números e espaço
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function gerarPixPayload(chave, nome, valor) {
  // Cidade: pega só a última parte do endereço ou usa "Brasil"
  const nomeLimpo   = limpar(nome, 25) || 'Restaurante';
  const cidadeLimpa = 'Brasil'; // campo obrigatório, valor genérico válido

  const merchantAccount = campo('00', 'BR.GOV.BCB.PIX') + campo('01', chave.trim());

  let payload =
    campo('00', '01') +
    campo('26', merchantAccount) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', valor.toFixed(2)) +
    campo('58', 'BR') +
    campo('59', nomeLimpo) +
    campo('60', cidadeLimpa) +
    campo('62', campo('05', '***')) +
    '6304';

  return payload + crc16(payload);
}

// ── Gera QR Code como SVG ────────────────────────────────────
function gerarQRSVG(texto) {
  try {
    // eslint-disable-next-line no-undef
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();

    // margin=4 módulos (quiet zone obrigatória pelo padrão QR)
    // cellSize=5 para ficar legível na impressão
    let svg = qr.createSvgTag(5, 4);

    // Substituir tamanho fixo por 100% para caber no container
    svg = svg.replace(/width="[^"]*"/, 'width="100%"')
             .replace(/height="[^"]*"/, 'height="auto"');

    return svg;
  } catch (e) {
    console.error('QR erro:', e);
    return null;
  }
}

// ── Impressão principal ───────────────────────────────────────
export async function imprimirPedido(pedido) {
  const cfg = getConfig();
  const el  = document.getElementById('nota-impressao');
  if (!el) return;

  const itens = (pedido.itens || []).map(it => {
    const nome = it.nome || it.descricao || '?';
    const sub  = Math.round((it.qty || 1) * (it.preco || 0) * 100) / 100;
    return `
      <div class="nota-linha">
        <span class="nome">${it.qty || 1}x ${nome}</span>
        <span class="val">${formatarMoeda(sub)}</span>
      </div>
      ${it.proteina ? `<div style="font-size:10px;padding-left:10px">- ${it.proteina}</div>` : ''}
      ${it.acompanhamentos?.length ? `<div style="font-size:10px;padding-left:10px">- ${it.acompanhamentos.join(', ')}</div>` : ''}
      ${it.obs ? `<div style="font-size:10px;padding-left:10px;font-style:italic">Obs: ${it.obs}</div>` : ''}
    `;
  }).join('');

  const entrega = pedido.tipoEntrega === 'entrega';
  const troco   = pedido.formaPagamento === 'Dinheiro' && pedido.troco > 0
    ? `<div class="nota-linha"><span class="nome">Pagou com</span><span class="val">${formatarMoeda(pedido.pagoEm || 0)}</span></div>
       <div class="nota-linha nota-bold"><span class="nome">Troco</span><span class="val">${formatarMoeda(pedido.troco)}</span></div>`
    : '';

  // ── QR PIX com valor embutido ──────────────────────────────
  let pixBox = '';
  if (cfg.pixChave && pedido.formaPagamento === 'Pix' && pedido.total > 0) {
    const payload = gerarPixPayload(cfg.pixChave, cfg.pixNome || cfg.nome, pedido.total);
    const svg     = gerarQRSVG(payload);

    if (svg) {
      pixBox = `
        <div style="border:2px solid #000;padding:8px;margin:8px 0;text-align:center;">
          <div style="font-weight:bold;font-size:12px;margin-bottom:4px">PAGAR VIA PIX</div>
          <div style="font-size:9px;margin-bottom:6px;word-break:break-all">${cfg.pixChave}</div>
          <div style="width:180px;margin:0 auto;display:block;line-height:0">${svg}</div>
          <div style="font-weight:bold;font-size:14px;margin-top:6px">${formatarMoeda(pedido.total)}</div>
          <div style="font-size:8px;margin-top:2px;color:#333">Escaneie — valor ja preenchido</div>
        </div>`;
    } else {
      pixBox = `
        <div style="border:2px solid #000;padding:8px;margin:8px 0;text-align:center;">
          <div style="font-weight:bold">PAGAR VIA PIX</div>
          <div style="word-break:break-all">${cfg.pixChave}</div>
          <div style="font-weight:bold;font-size:14px">${formatarMoeda(pedido.total)}</div>
        </div>`;
    }
  }

  el.innerHTML = `
    <div class="nota-center nota-grande">${cfg.nome}</div>
    ${cfg.subtitulo ? `<div class="nota-center">${cfg.subtitulo}</div>` : ''}
    <div class="nota-center">${cfg.telefone}</div>
    <div class="nota-center" style="font-size:9px">${cfg.endereco}</div>
    <div class="nota-divider"></div>

    <div class="nota-linha">
      <span class="nota-bold">Pedido #${pedido.numero}</span>
      <span>${formatarHora(pedido.hora)}</span>
    </div>
    <div style="font-size:10px">${new Date(pedido.hora).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</div>
    <div class="nota-divider"></div>

    <div class="nota-bold">CLIENTE</div>
    <div>${pedido.cliente?.nome || 'Sem identificacao'}</div>
    ${pedido.cliente?.telefone ? `<div>${pedido.cliente.telefone}</div>` : ''}
    ${entrega && pedido.endereco ? `
      <div style="height:4px"></div>
      <div class="nota-bold">ENDERECO</div>
      <div>${pedido.endereco.logradouro}${pedido.endereco.numero ? ', '+pedido.endereco.numero : ''}</div>
      ${pedido.endereco.complemento ? `<div>${pedido.endereco.complemento}</div>` : ''}
      <div>${pedido.endereco.bairro}</div>
      ${pedido.endereco.referencia ? `<div style="font-size:10px">Ref: ${pedido.endereco.referencia}</div>` : ''}
    ` : ''}
    <div class="nota-divider"></div>

    <div class="nota-bold">ITENS</div>
    <div style="height:4px"></div>
    ${itens}
    <div class="nota-divider"></div>

    <div class="nota-linha"><span class="nome">Subtotal</span><span class="val">${formatarMoeda(pedido.subtotal || 0)}</span></div>
    ${entrega ? `<div class="nota-linha"><span class="nome">Taxa entrega (${pedido.bairro || ''})</span><span class="val">${formatarMoeda(pedido.taxaEntrega || 0)}</span></div>` : ''}
    ${(pedido.desconto||0) > 0 ? `<div class="nota-linha"><span class="nome">Desconto</span><span class="val">-${formatarMoeda(pedido.desconto)}</span></div>` : ''}

    <div class="nota-total-box">
      <div class="nota-linha nota-grande">
        <span>TOTAL</span><span>${formatarMoeda(pedido.total)}</span>
      </div>
    </div>

    <div class="nota-linha">
      <span class="nome">Pagamento</span>
      <span class="val nota-bold">${pedido.formaPagamento || '—'}</span>
    </div>
    ${troco}
    ${pixBox}
    ${pedido.observacao ? `<div class="nota-divider"></div><div style="font-size:10px">Obs: ${pedido.observacao}</div>` : ''}
    <div class="nota-divider"></div>
    <div class="nota-footer">Obrigado pela preferencia!<br>Volte sempre</div>
    <div style="height:8mm"></div>
  `;

  window.print();
}
