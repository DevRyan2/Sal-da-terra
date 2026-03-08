# 🍱 Sistema de Pedidos — Guia de Uso

Sistema completo de gerenciamento de pedidos para restaurante.  
Funciona 100% no navegador, sem precisar de servidor. Dados salvos localmente.

---

## 🚀 Como usar no GitHub Pages

1. Crie um repositório no GitHub (público ou privado)
2. Faça upload de todos os arquivos mantendo a estrutura de pastas
3. Vá em **Settings → Pages → Source: Deploy from branch → main / root**
4. Acesse: `https://seu-usuario.github.io/nome-do-repositorio/`

---

## 💻 Como testar localmente (Linux)

Precisa de um servidor local por causa dos ES Modules:

```bash
# Opção 1 — Python (já instalado no Linux)
cd pasta-do-projeto
python3 -m http.server 8080
# Acesse: http://localhost:8080

# Opção 2 — Node.js
npx serve .
# Acesse: http://localhost:3000
```

---

## ⚙️ Configuração inicial

### 1. Dados do restaurante
Edite `js/config.js` com os dados do seu restaurante:
- Nome, endereço, telefone
- Chave Pix para impressão nas notas
- Bairros com taxas de entrega
- Proteínas padrão
- Itens fixos do balcão

Você também pode configurar tudo pela interface clicando no ícone ⚙️ no canto superior direito.

### 2. Cardápio do dia
Todo dia de manhã, clique em **"⚙️ Cardápio do dia"** na aba Quentinha para:
- Definir preços e limites de cada tamanho
- Selecionar quais proteínas estão disponíveis
- Definir acompanhamentos do dia

### 3. Painel da Cozinha
Clique no ícone 👨‍🍳 no topbar para abrir o painel da cozinha em outra aba/dispositivo.
- Atualiza automaticamente a cada 10 segundos
- Botões de status: Novo → Preparo → Pronto → Entregue

---

## 📁 Estrutura de arquivos

```
index.html          → App principal (3 abas)
cozinha.html        → Painel da cozinha
stats.html          → Estatísticas do dia

css/
  style.css         → Design completo
  print.css         → Estilos de impressão da nota

js/
  config.js         → ⭐ EDITE AQUI (dados do restaurante)
  db.js             → Camada de dados (localStorage)
  app.js            → Controlador principal

js/tabs/
  quentinha.js      → Aba Quentinha
  prato.js          → Aba Prato Feito
  balcao.js         → Aba Balcão (PDV)

js/modules/
  cliente.js        → Modal de busca/cadastro de cliente
  cardapio-modal.js → Modal de configuração do cardápio
  pedido-list.js    → Sidebar de pedidos do dia
  impressao.js      → Geração e impressão da nota
```

---

## 🔥 Firebase (opcional — para sincronização entre dispositivos)

Para a cozinha funcionar em **outro dispositivo** (tablet, celular), ative o Firebase:

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um projeto → Realtime Database → Criar banco (modo teste)
3. Copie a URL do banco (ex: `https://meu-rest-default-rtdb.firebaseio.com`)
4. Cole em `js/config.js`:
   ```js
   export const FIREBASE_URL = "https://meu-rest-default-rtdb.firebaseio.com";
   ```
5. Regras do banco (Settings → Realtime Database → Rules):
   ```json
   { "rules": { ".read": true, ".write": true } }
   ```

> ⚠️ As regras acima são abertas. Para uso em produção, configure autenticação.

---

## 🖨️ Impressão da nota

- A nota é formatada para impressora térmica de **80mm**
- Clique em 🖨️ ao lado de qualquer pedido na sidebar
- Ou confirme e o sistema pergunta se quer imprimir

Para impressora USB no Linux, certifique-se que o Chrome/Chromium pode acessa-la nas configurações de impressão.

---

## 💾 Backup dos dados

Os dados ficam no `localStorage` do navegador. Para fazer backup:

1. Abra o Console do navegador (F12)
2. Execute:
```js
// Exportar tudo
const dados = {};
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key.startsWith('REST_')) dados[key] = JSON.parse(localStorage.getItem(key));
}
console.log(JSON.stringify(dados, null, 2));
// Copie o output e salve em um arquivo .json
```

---

## 🛠️ Customizações comuns

### Mudar cores
Edite as variáveis CSS no topo de `css/style.css`:
```css
--accent: #F5A623;  /* Cor principal (laranja) */
--bg: #0A0C12;      /* Fundo */
```

### Adicionar aba/tipo de pedido
Crie um novo arquivo em `js/tabs/`, siga o padrão dos existentes e registre em `js/app.js`.

### Mudar observações rápidas
Edite o array `OBS_RAPIDAS` no topo de `js/tabs/quentinha.js` e `js/tabs/prato.js`.
