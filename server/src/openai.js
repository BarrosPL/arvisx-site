/* ==========================================================================
   OpenAI — redação do post.

   Usa a API de Chat Completions em modo JSON. Chamada por fetch em vez do
   SDK oficial para manter a imagem Docker sem dependências extras; o formato
   do corpo é estável e o servidor faz uma chamada por semana.
   ========================================================================== */

import { config } from "./config.js";
import { CATEGORIAS } from "./store.js";
import { blocosParaTexto } from "./util.js";

const SISTEMA = `Você é o editor do blog da ARVISX AI — uma empresa brasileira que
arquiteta operações comerciais: agentes de inteligência artificial, CRM (Kommo),
automação de processos, SDR e agendamento, tráfego pago, conteúdo e gestão por dados.
O público é dono de empresa, sócio de escritório e gestor comercial.

Como você escreve:
- Português do Brasil, tom sóbrio e adulto, de quem opera e não de quem vende curso.
  Nada de "revolucionário", "descubra agora", "o futuro chegou" ou linguagem de folheto.
- Frases curtas. Concretude acima de adjetivo: prefira a etapa do processo, o gargalo
  real, o indicador, o exemplo prático.
- Entre 5 e 8 parágrafos, com 2 a 4 subtítulos e no máximo uma lista curta.
- Termine ligando o assunto ao que a ARVISX faz, sem prometer número, prazo, preço
  ou resultado garantido.

Regras inegociáveis:
- O texto é ORIGINAL. As notícias recebidas são apenas pauta: você não copia frase,
  não traduz trecho e não reproduz o texto do veículo.
- Não invente estatística, percentual, estudo, nome de cliente, caso de sucesso nem
  funcionalidade de ferramenta. Se um dado desses for essencial e você não tiver
  certeza, escreva de forma qualitativa ou deixe de fora.
- Não cite concorrentes nem prometa resultado.`;

function exemplos(posts) {
  return posts
    .slice(0, 2)
    .map((p) => `TÍTULO: ${p.titulo}\nSUBTÍTULO: ${p.subtitulo}\nTEXTO:\n${blocosParaTexto(p.blocos)}`)
    .join("\n\n---\n\n");
}

function instrucao(pautas, posts) {
  const listaPautas = pautas
    .map((p, i) => `[${i}] ${p.titulo} — ${p.fonte || "sem veículo"} (${p.categoriaSugerida})`)
    .join("\n");

  const jaEscritos = posts.map((p) => `- ${p.titulo}`).join("\n") || "- (nenhum ainda)";

  return `PAUTAS DA SEMANA (manchetes coletadas no Google News):
${listaPautas}

POSTS JÁ PUBLICADOS — não repita nenhum destes assuntos:
${jaEscritos}

EXEMPLOS DO TOM DA CASA (imite o ritmo, não o conteúdo):
${exemplos(posts)}

TAREFA
1. Escolha UMA pauta da lista que renda um post útil para quem toca uma operação
   comercial. Prefira a que tenha ângulo prático e durabilidade — o post fica no ar
   por anos. Se nenhuma prestar, escolha a menos ruim e trate o tema de forma mais
   ampla e atemporal.
2. Escreva o post seguindo as regras do sistema.
3. Sugira um termo de busca EM INGLÊS para achar a foto de capa no Wikimedia
   Commons. Precisa ser uma cena física e fotografável (ex.: "casual meeting
   room", "server racks data center", "person using smartphone"), nunca um
   conceito abstrato ("produtividade", "inovação") — o acervo não indexa isso.
   Acrescente a palavra "Unsplash" ao termo quando a cena for genérica de
   escritório, tecnologia ou negócios: é assim que se alcança o acervo de
   fotos modernas espelhado no Commons.

Responda SOMENTE com um objeto JSON neste formato:
{
  "pautaEscolhida": <índice numérico da pauta>,
  "titulo": "até 70 caracteres, sem ponto final",
  "subtitulo": "uma frase que complementa o título",
  "resumo": "uma frase de até 160 caracteres para o card do blog",
  "categoria": "uma de: ${CATEGORIAS.join(" | ")}",
  "corpo": [
    {"tipo": "p", "texto": "..."},
    {"tipo": "h2", "texto": "..."},
    {"tipo": "ul", "itens": ["...", "..."]}
  ],
  "termoCapa": "termo de busca em inglês",
  "capaAlt": "descrição da foto em português, para leitores de tela"
}`;
}

export async function escreverPost(pautas, postsExistentes) {
  if (!config.openaiKey) {
    throw new Error("OPENAI_API_KEY não configurada — defina a chave no ambiente do serviço.");
  }

  const resposta = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SISTEMA },
        { role: "user", content: instrucao(pautas, postsExistentes) },
      ],
    }),
    signal: AbortSignal.timeout(180000),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`OpenAI respondeu ${resposta.status}: ${detalhe.slice(0, 400)}`);
  }

  const dados = await resposta.json();
  const conteudo = dados?.choices?.[0]?.message?.content;

  if (!conteudo) throw new Error("OpenAI devolveu resposta vazia.");

  let json;
  try {
    json = JSON.parse(conteudo);
  } catch {
    throw new Error(`OpenAI devolveu JSON inválido: ${conteudo.slice(0, 300)}`);
  }

  if (!json.titulo || !Array.isArray(json.corpo) || json.corpo.length === 0) {
    throw new Error("OpenAI devolveu um post sem título ou sem corpo.");
  }

  return json;
}
