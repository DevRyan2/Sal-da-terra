// ============================================================
//  impressao.js — Geração e impressão de nota
// ============================================================
import { getConfig, formatarMoeda, formatarHora } from '../db.js';

export function imprimirPedido(pedido) {
  const cfg = getConfig();
  const el  = document.getElementById('nota-impressao');
  if (!el) return;

  const itens = (pedido.itens || []).map(it => {
    const nome = it.nome || it.descricao || '?';
    const det  = it.detalhe ? ` (${it.detalhe})` : '';
    const obs  = it.obs ? `\n   >${it.obs}` : '';
    const sub  = (it.qty || 1) * (it.preco || 0);
    return `
      <div class="nota-linha">
        <span class="nome">${it.qty || 1}x ${nome}${det}</span>
        <span class="val">${formatarMoeda(sub)}</span>
      </div>
      ${it.proteina ? `<div style="font-size:10px;padding-left:10px">↳ ${it.proteina}</div>` : ''}
      ${it.acompanhamentos?.length ? `<div style="font-size:10px;padding-left:10px">↳ ${it.acompanhamentos.join(', ')}</div>` : ''}
      ${it.obs ? `<div style="font-size:10px;padding-left:10px;font-style:italic">Obs: ${it.obs}</div>` : ''}
    `;
  }).join('');

  const entrega = pedido.tipoEntrega === 'entrega';
  const troco   = pedido.formaPagamento === 'Dinheiro' && pedido.troco > 0
    ? `<div class="nota-linha"><span class="nome">Troco para</span><span class="val">${formatarMoeda(pedido.pagoEm || 0)}</span></div>
       <div class="nota-linha nota-bold"><span class="nome">Troco a dar</span><span class="val">${formatarMoeda(pedido.troco)}</span></div>`
    : '';

  const pixBox = cfg.pixChave && pedido.formaPagamento === 'Pix'
    ? `<div class="nota-pix-box">
         <div class="nota-bold">PAGAR VIA PIX</div>
         <div>${cfg.pixChave}</div>
         <div style="font-size:9px">${cfg.pixNome}</div>
         <div class="nota-bold nota-grande">${formatarMoeda(pedido.total)}</div>
       </div>`
    : '';

  el.innerHTML = `
    <!-- Cabeçalho -->
    <div class="nota-center nota-grande">${cfg.nome}</div>
    ${cfg.subtitulo ? `<div class="nota-center">${cfg.subtitulo}</div>` : ''}
    <div class="nota-center">${cfg.telefone}</div>
    <div class="nota-center" style="font-size:9px">${cfg.endereco}</div>
    <div class="nota-divider"></div>

    <!-- Número e data -->
    <div class="nota-linha">
      <span class="nota-bold">Pedido #${pedido.numero}</span>
      <span>${formatarHora(pedido.hora)}</span>
    </div>
    <div style="font-size:10px">${new Date(pedido.hora).toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })}</div>
    <div class="nota-divider"></div>

    <!-- Cliente -->
    <div class="nota-bold">CLIENTE</div>
    <div>${pedido.cliente?.nome || 'Sem identificação'}</div>
    ${pedido.cliente?.telefone ? `<div>${pedido.cliente.telefone}</div>` : ''}
    ${entrega && pedido.endereco ? `
      <div class="nota-space"></div>
      <div class="nota-bold">ENDEREÇO DE ENTREGA</div>
      <div>${pedido.endereco.logradouro}${pedido.endereco.numero ? ', '+pedido.endereco.numero : ''}</div>
      ${pedido.endereco.complemento ? `<div>${pedido.endereco.complemento}</div>` : ''}
      <div>${pedido.endereco.bairro}</div>
      ${pedido.endereco.referencia ? `<div style="font-size:10px">Ref: ${pedido.endereco.referencia}</div>` : ''}
    ` : ''}
    <div class="nota-divider"></div>

    <!-- Itens -->
    <div class="nota-bold">ITENS</div>
    <div class="nota-space"></div>
    ${itens}
    <div class="nota-divider"></div>

    <!-- Totais -->
    <div class="nota-linha"><span class="nome">Subtotal</span><span class="val">${formatarMoeda(pedido.subtotal || 0)}</span></div>
    ${entrega ? `<div class="nota-linha"><span class="nome">Taxa de entrega (${pedido.bairro || ''})</span><span class="val">${formatarMoeda(pedido.taxaEntrega || 0)}</span></div>` : ''}
    ${pedido.desconto > 0 ? `<div class="nota-linha"><span class="nome">Desconto</span><span class="val">-${formatarMoeda(pedido.desconto)}</span></div>` : ''}

    <div class="nota-total-box">
      <div class="nota-linha nota-grande">
        <span>TOTAL</span>
        <span>${formatarMoeda(pedido.total)}</span>
      </div>
    </div>

    <!-- Pagamento -->
    <div class="nota-linha">
      <span class="nome">Forma de pagamento</span>
      <span class="val nota-bold">${pedido.formaPagamento || '—'}</span>
    </div>
    ${troco}

    ${pixBox}

    <!-- Observação geral -->
    ${pedido.observacao ? `<div class="nota-divider"></div><div style="font-size:10px">Obs: ${pedido.observacao}</div>` : ''}

    <!-- Rodapé -->
    <div class="nota-divider"></div>
    <div class="nota-footer">
      Obrigado pela preferência!<br>
      Volte sempre 🍱
    </div>
    <div style="height:8mm"></div>
  `;

  window.print();
}
