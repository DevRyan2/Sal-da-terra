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
  return id + String(valor.length).padStart(2, '0') + valor;
}

function gerarPixPayload(chave, nome, cidade, valor) {
  const nomeLimpo   = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 25).trim();
  const cidadeLimpa = (cidade || 'Brasil').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15).trim() || 'Brasil';
  const merchantAccount = campo('00', 'BR.GOV.BCB.PIX') + campo('01', chave);
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

function gerarQRDataURL(texto) {
  return new Promise(resolve => {
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
    document.body.appendChild(div);
    try {
      // eslint-disable-next-line no-undef
      new QRCode(div, { text: texto, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
      const canvas = div.querySelector('canvas');
      const dataURL = canvas ? canvas.toDataURL('image/png') : null;
      document.body.removeChild(div);
      resolve(dataURL);
    } catch (e) {
      if (div.parentNode) document.body.removeChild(div);
      resolve(null);
    }
  });
}

export async function imprimirPedido(pedido) {
  const cfg = getConfig();
  const el  = document.getElementById('nota-impressao');
  if (!el) return;

  const itens = (pedido.itens || []).map(it => {
    const nome = it.nome || it.descricao || '?';
    const sub  = (it.qty || 1) * (it.preco || 0);
    return `
      <div class="nota-linha">
        <span class="nome">${it.qty || 1}x ${nome}</span>
        <span class="val">${formatarMoeda(sub)}</span>
      </div>
      ${it.proteina ? `<div style="font-size:10px;padding-left:10px">↳ ${it.proteina}</div>` : ''}
      ${it.acompanhamentos?.length ? `<div style="font-size:10px;padding-left:10px">↳ ${it.acompanhamentos.join(', ')}</div>` : ''}
      ${it.obs ? `<div style="font-size:10px;padding-left:10px;font-style:italic">Obs: ${it.obs}</div>` : ''}
    `;
  }).join('');

  const entrega = pedido.tipoEntrega === 'entrega';
  const troco   = pedido.formaPagamento === 'Dinheiro' && pedido.troco > 0
    ? `<div class="nota-linha"><span class="nome">Pagou com</span><span class="val">${formatarMoeda(pedido.pagoEm || 0)}</span></div>
       <div class="nota-linha nota-bold"><span class="nome">Troco</span><span class="val">${formatarMoeda(pedido.troco)}</span></div>`
    : '';

  let pixBox = '';
  if (cfg.pixChave && pedido.formaPagamento === 'Pix' && pedido.total > 0) {
    const payload   = gerarPixPayload(cfg.pixChave, cfg.pixNome || cfg.nome, cfg.endereco || 'Brasil', pedido.total);
    const qrDataURL = await gerarQRDataURL(payload);
    if (qrDataURL) {
      pixBox = `
        <div class="nota-pix-box">
          <div class="nota-bold" style="font-size:12px">PAGAR VIA PIX</div>
          <div style="font-size:9px;margin:2px 0">${cfg.pixChave}</div>
          <img src="${qrDataURL}" style="width:160px;height:160px;margin:6px auto;display:block">
          <div class="nota-bold nota-grande">${formatarMoeda(pedido.total)}</div>
          <div style="font-size:8px;margin-top:2px">Escaneie — valor ja preenchido automaticamente</div>
        </div>`;
    } else {
      pixBox = `
        <div class="nota-pix-box">
          <div class="nota-bold">PAGAR VIA PIX</div>
          <div>${cfg.pixChave}</div>
          <div class="nota-bold nota-grande">${formatarMoeda(pedido.total)}</div>
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
    <div style="font-size:10px">${new Date(pedido.hora).toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}</div>
    <div class="nota-divider"></div>
    <div class="nota-bold">CLIENTE</div>
    <div>${pedido.cliente?.nome || 'Sem identificacao'}</div>
    ${pedido.cliente?.telefone ? `<div>${pedido.cliente.telefone}</div>` : ''}
    ${entrega && pedido.endereco ? `
      <div class="nota-space"></div>
      <div class="nota-bold">ENDERECO DE ENTREGA</div>
      <div>${pedido.endereco.logradouro}${pedido.endereco.numero ? ', '+pedido.endereco.numero : ''}</div>
      ${pedido.endereco.complemento ? `<div>${pedido.endereco.complemento}</div>` : ''}
      <div>${pedido.endereco.bairro}</div>
      ${pedido.endereco.referencia ? `<div style="font-size:10px">Ref: ${pedido.endereco.referencia}</div>` : ''}
    ` : ''}
    <div class="nota-divider"></div>
    <div class="nota-bold">ITENS</div>
    <div class="nota-space"></div>
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
