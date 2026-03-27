// ============================================================
//  impressao.js — Geração e impressão de nota (3 vias)
//  1ª via: COZINHA  — preparo do prato
//  2ª via: MOTOBOY  — rota de entrega
//  3ª via: CLIENTE  — recibo completo
// ============================================================
import { getConfig, formatarMoeda, formatarHora } from '../db.js';

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
  return id + String(valor.length).padStart(2,'0') + valor;
}
function limpar(str, max) {
  return (str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
}
function gerarPixPayload(chave, nome, valor) {
  const nomeLimpo = limpar(nome,25)||'Restaurante';
  const ma = campo('00','BR.GOV.BCB.PIX')+campo('01',chave.trim());
  let p = campo('00','01')+campo('26',ma)+campo('52','0000')+campo('53','986')+campo('54',valor.toFixed(2))+campo('58','BR')+campo('59',nomeLimpo)+campo('60','Brasil')+campo('62',campo('05','***'))+'6304';
  return p + crc16(p);
}
function gerarQRSVG(texto) {
  try {
    const qr = qrcode(0,'M');
    qr.addData(texto); qr.make();
    let svg = qr.createSvgTag(5,4);
    return svg.replace(/width="[^"]*"/,'width="100%"').replace(/height="[^"]*"/,'height="auto"');
  } catch(e){ return null; }
}

// ── 1ª VIA: COZINHA ─────────────────────────────────────────
function viaCozinha(pedido) {
  const itens = (pedido.itens||[]).map(it => {
    const nome     = it.nome || it.descricao || '?';
    const proteina = it.proteina
      ? `<div style="padding-left:8px;font-weight:bold;font-size:12px">→ ${it.proteina}</div>` : '';
    const acomps   = it.acompanhamentos?.length
      ? `<div style="padding-left:8px;font-size:10px">+ ${it.acompanhamentos.join(', ')}</div>` : '';
    const obs      = it.obs
      ? `<div style="padding-left:8px;font-size:10px;font-style:italic">⚠ ${it.obs}</div>` : '';
    return `<div style="margin-bottom:6px;border-left:3px solid #000;padding-left:6px">
      <div style="font-weight:bold;font-size:13px">${it.qty||1}× ${nome}</div>
      ${proteina}${acomps}${obs}
    </div>`;
  }).join('');

  const tipoIcon = pedido.tipoEntrega==='entrega' ? '🛵 ENTREGA' : '🏪 RETIRADA';
  return `
    <div class="via-titulo">✂ COZINHA</div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
      <span style="font-size:22px;font-weight:900">#${pedido.numero}</span>
      <span style="font-size:11px">${formatarHora(pedido.hora)}</span>
    </div>
    <div style="font-size:11px;font-weight:bold;margin-bottom:2px">${tipoIcon}</div>
    <div style="font-size:11px;margin-bottom:2px">Cliente: <strong>${pedido.cliente?.nome||'Balcão'}</strong></div>
    ${pedido.cliente?.observacaoFixa
      ? `<div style="border:1px solid #000;padding:3px 6px;font-size:10px;margin-bottom:4px">⚠ FIXO: ${pedido.cliente.observacaoFixa}</div>` : ''}
    <div class="nota-divider"></div>
    <div style="font-weight:bold;font-size:11px;margin-bottom:4px">ITENS PARA PREPARAR:</div>
    ${itens}
    ${pedido.observacao
      ? `<div class="nota-divider"></div><div style="font-size:10px;font-style:italic">Obs geral: ${pedido.observacao}</div>` : ''}
  `;
}

// ── 2ª VIA: MOTOBOY ─────────────────────────────────────────
function viaMotoboy(pedido) {
  const entrega    = pedido.tipoEntrega === 'entrega';
  const resumoItens = (pedido.itens||[]).map(it=>`${it.qty||1}× ${it.nome||it.descricao||'?'}`).join(', ');

  const cabecalho = `
    <div class="via-titulo">✂ ${entrega ? 'MOTOBOY' : 'RETIRADA'}</div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
      <span style="font-size:22px;font-weight:900">#${pedido.numero}</span>
      <span style="font-size:11px">${formatarHora(pedido.hora)}</span>
    </div>
    <div style="font-size:11px;margin-bottom:2px">Cliente: <strong>${pedido.cliente?.nome||'Sem nome'}</strong></div>
    ${pedido.cliente?.telefone ? `<div style="font-size:11px">Tel: <strong>${pedido.cliente.telefone}</strong></div>` : ''}
  `;

  const enderecoHTML = entrega ? `
    <div class="nota-divider"></div>
    <div style="font-size:11px;font-weight:bold;margin-bottom:2px">ENDEREÇO:</div>
    ${pedido.endereco ? `
      <div style="font-size:13px;font-weight:bold">${pedido.bairro||''}</div>
      <div style="font-size:12px">${pedido.endereco.logradouro||''}${pedido.endereco.numero?', '+pedido.endereco.numero:''}</div>
      ${pedido.endereco.complemento?`<div style="font-size:11px">${pedido.endereco.complemento}</div>`:''}
      ${pedido.endereco.referencia?`<div style="font-size:10px;font-style:italic">Ref: ${pedido.endereco.referencia}</div>`:''}
    ` : `<div style="font-size:13px;font-weight:bold">${pedido.bairro||'—'}</div>`}
  ` : '';

  return `
    ${cabecalho}
    ${enderecoHTML}
    <div class="nota-divider"></div>
    <div style="font-size:10px;color:#444;margin-bottom:4px">${resumoItens}</div>
    <div class="nota-divider"></div>
    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px">
      <span>TOTAL</span><span>${formatarMoeda(pedido.total)}</span>
    </div>
    ${pedido.taxaEntrega>0?`<div style="font-size:10px">(incl. frete: ${formatarMoeda(pedido.taxaEntrega)})</div>`:''}
    <div style="font-size:11px;margin-top:2px">Pgto: <strong>${pedido.formaPagamento||'—'}</strong></div>
    ${pedido.troco>0?`<div style="font-size:11px">Troco p/ ${formatarMoeda(pedido.pagoEm||0)}: <strong>${formatarMoeda(pedido.troco)}</strong></div>`:''}
  `;
}

// ── 3ª VIA: CLIENTE ─────────────────────────────────────────
function viaCliente(pedido, cfg) {
  const entrega = pedido.tipoEntrega === 'entrega';

  const itens = (pedido.itens||[]).map(it => {
    const nome = it.nome||it.descricao||'?';
    const sub  = Math.round((it.qty||1)*(it.preco||0)*100)/100;
    return `
      <div class="nota-linha">
        <span class="nome">${it.qty||1}x ${nome}</span>
        <span class="val">${formatarMoeda(sub)}</span>
      </div>
      ${it.proteina?`<div style="font-size:10px;padding-left:10px">- ${it.proteina}</div>`:''}
      ${it.acompanhamentos?.length?`<div style="font-size:10px;padding-left:10px">- ${it.acompanhamentos.join(', ')}</div>`:''}
      ${it.obs?`<div style="font-size:10px;padding-left:10px;font-style:italic">Obs: ${it.obs}</div>`:''}
    `;
  }).join('');

  const troco = pedido.formaPagamento==='Dinheiro'&&pedido.troco>0
    ? `<div class="nota-linha"><span class="nome">Pagou com</span><span class="val">${formatarMoeda(pedido.pagoEm||0)}</span></div>
       <div class="nota-linha nota-bold"><span class="nome">Troco</span><span class="val">${formatarMoeda(pedido.troco)}</span></div>` : '';

  let pixBox = '';
  if (cfg.pixChave && pedido.formaPagamento==='Pix' && pedido.total>0) {
    const payload = gerarPixPayload(cfg.pixChave, cfg.pixNome||cfg.nome, pedido.total);
    const svg     = gerarQRSVG(payload);
    pixBox = svg
      ? `<div style="border:2px solid #000;padding:8px;margin:8px 0;text-align:center">
           <div style="font-weight:bold;font-size:12px;margin-bottom:4px">PAGAR VIA PIX</div>
           <div style="font-size:9px;margin-bottom:6px;word-break:break-all">${cfg.pixChave}</div>
           <div style="width:180px;margin:0 auto;line-height:0">${svg}</div>
           <div style="font-weight:bold;font-size:14px;margin-top:6px">${formatarMoeda(pedido.total)}</div>
           <div style="font-size:8px;margin-top:2px;color:#333">Escaneie — valor ja preenchido</div>
         </div>`
      : `<div style="border:2px solid #000;padding:8px;margin:8px 0;text-align:center">
           <div style="font-weight:bold">PAGAR VIA PIX</div>
           <div style="word-break:break-all">${cfg.pixChave}</div>
           <div style="font-weight:bold;font-size:14px">${formatarMoeda(pedido.total)}</div>
         </div>`;
  }

  return `
    <div class="via-titulo">✂ CLIENTE</div>
    <div class="nota-center nota-grande">${cfg.nome}</div>
    ${cfg.subtitulo?`<div class="nota-center">${cfg.subtitulo}</div>`:''}
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
    <div>${pedido.cliente?.nome||'Sem identificacao'}</div>
    ${pedido.cliente?.telefone?`<div>${pedido.cliente.telefone}</div>`:''}
    ${entrega&&pedido.endereco?`
      <div style="height:4px"></div>
      <div class="nota-bold">ENDERECO</div>
      <div>${pedido.endereco.logradouro}${pedido.endereco.numero?', '+pedido.endereco.numero:''}</div>
      ${pedido.endereco.complemento?`<div>${pedido.endereco.complemento}</div>`:''}
      <div>${pedido.endereco.bairro}</div>
      ${pedido.endereco.referencia?`<div style="font-size:10px">Ref: ${pedido.endereco.referencia}</div>`:''}
    `:''}
    <div class="nota-divider"></div>
    <div class="nota-bold">ITENS</div>
    <div style="height:4px"></div>
    ${itens}
    <div class="nota-divider"></div>
    <div class="nota-linha"><span class="nome">Subtotal</span><span class="val">${formatarMoeda(pedido.subtotal||0)}</span></div>
    ${entrega?`<div class="nota-linha"><span class="nome">Taxa entrega (${pedido.bairro||''})</span><span class="val">${formatarMoeda(pedido.taxaEntrega||0)}</span></div>`:''}
    ${(pedido.desconto||0)>0?`<div class="nota-linha"><span class="nome">Desconto</span><span class="val">-${formatarMoeda(pedido.desconto)}</span></div>`:''}
    <div class="nota-total-box">
      <div class="nota-linha nota-grande"><span>TOTAL</span><span>${formatarMoeda(pedido.total)}</span></div>
    </div>
    <div class="nota-linha"><span class="nome">Pagamento</span><span class="val nota-bold">${pedido.formaPagamento||'—'}</span></div>
    ${troco}
    ${pixBox}
    ${pedido.observacao?`<div class="nota-divider"></div><div style="font-size:10px">Obs: ${pedido.observacao}</div>`:''}
    <div class="nota-divider"></div>
    <div class="nota-footer">Obrigado pela preferencia!<br>Volte sempre</div>
    <div style="height:8mm"></div>
  `;
}

// ── Impressão principal ───────────────────────────────────────
export async function imprimirPedido(pedido) {
  const cfg = getConfig();
  const el  = document.getElementById('nota-impressao');
  if (!el) return;

  el.innerHTML = `
    <div class="via-bloco">${viaCozinha(pedido)}</div>
    <div class="via-bloco">${viaMotoboy(pedido)}</div>
    <div class="via-bloco">${viaCliente(pedido, cfg)}</div>
  `;

  window.print();
}