// ============================================================
//  CONFIGURAÇÕES DO RESTAURANTE — EDITE AQUI
// ============================================================

export const RESTAURANTE = {
  nome: "Restaurante da Vó",
  subtitulo: "Comida caseira todo dia",
  telefone: "(21) 99999-9999",
  endereco: "Rua das Flores, 123 — Centro",
  pixChave: "11.222.333/0001-44",    // CPF, CNPJ, email ou telefone
  pixNome: "Restaurante da Vó",
};

// ============================================================
//  FIREBASE (opcional — deixe como null para usar só offline)
// ============================================================
//  Para ativar: crie um projeto em console.firebase.google.com
//  Vá em Realtime Database > Criar banco > Copie a URL abaixo
//  Regras do banco: { "rules": { ".read": true, ".write": true } }

export const FIREBASE_URL = null;
// Exemplo: export const FIREBASE_URL = "https://meu-restaurante-default-rtdb.firebaseio.com";

// ============================================================
//  BAIRROS E TAXAS DE ENTREGA
// ============================================================
export const BAIRROS_PADRAO = [
  { nome: "Centro",         taxa: 0    },
  { nome: "Bairro Norte",   taxa: 3    },
  { nome: "Bairro Sul",     taxa: 5    },
  { nome: "Bairro Leste",   taxa: 5    },
  { nome: "Bairro Oeste",   taxa: 7    },
  { nome: "Distrito Ind.",  taxa: 10   },
];

// ============================================================
//  PROTEÍNAS / CARNES DISPONÍVEIS
// ============================================================
export const PROTEINAS_PADRAO = [
  "Frango grelhado",
  "Frango frito",
  "Carne bovina",
  "Carne moída",
  "Linguiça",
  "Peixe",
  "Ovo frito",
  "Ovo mexido",
  "Vegano / Sem carne",
];

// ============================================================
//  ACOMPANHAMENTOS PADRÃO
// ============================================================
export const ACOMPANHAMENTOS_PADRAO = [
  "Arroz branco",
  "Feijão",
  "Feijão tropeiro",
  "Macarrão",
  "Farofa",
  "Salada",
  "Fritas",
  "Mandioca frita",
  "Legumes",
  "Purê",
];

// ============================================================
//  ITENS DE BALCÃO FIXOS (adicione conforme seu cardápio)
// ============================================================
export const BALCAO_PADRAO = [
  { nome: "Refrigerante lata",   preco: 5,   categoria: "Bebida"    },
  { nome: "Suco natural",        preco: 7,   categoria: "Bebida"    },
  { nome: "Água mineral",        preco: 3,   categoria: "Bebida"    },
  { nome: "Sobremesa do dia",    preco: 6,   categoria: "Sobremesa" },
  { nome: "Pudim",               preco: 7,   categoria: "Sobremesa" },
  { nome: "Brigadeiro",          preco: 3,   categoria: "Sobremesa" },
  { nome: "Salgado frito",       preco: 4,   categoria: "Salgado"   },
  { nome: "Pão de queijo",       preco: 3,   categoria: "Salgado"   },
];

// ============================================================
//  TAMANHOS DE QUENTINHA
// ============================================================
export const TAMANHOS_QUENTINHA = [
  { sigla: "P", label: "Pequena", preco: 15 },
  { sigla: "M", label: "Média",   preco: 20 },
  { sigla: "G", label: "Grande",  preco: 25 },
];
