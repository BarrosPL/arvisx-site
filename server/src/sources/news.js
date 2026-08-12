/* ==========================================================================
   Pautas — Google News RSS.

   Escolhido por ser gratuito, sem chave de API e sem limite prático. O feed
   devolve título, link, data e veículo; isso basta porque a notícia entra
   apenas como PAUTA. O texto do post é escrito do zero pela OpenAI, nunca
   copiado — republicar manchete de terceiro é problema de licença e de SEO.
   ========================================================================== */

const BASE = "https://news.google.com/rss/search";

/* Consultas fixas cobrindo os temas que a ARVISX vende. Editar aqui muda a
   pauta do blog inteiro. */
export const CONSULTAS = [
  { termo: "inteligência artificial vendas empresas", categoria: "Inteligência Artificial" },
  { termo: "agentes de IA atendimento empresas", categoria: "Inteligência Artificial" },
  { termo: "CRM funil de vendas gestão comercial", categoria: "CRM & Funil" },
  { termo: "automação de processos empresas produtividade", categoria: "Automação" },
  { termo: "WhatsApp Business API atendimento empresas", categoria: "Automação" },
  { termo: "tráfego pago Meta Ads marketing digital", categoria: "Tráfego & Conteúdo" },
  { termo: "marketing de conteúdo SEO busca com IA", categoria: "Tráfego & Conteúdo" },
  { termo: "dados indicadores gestão comercial empresas", categoria: "Gestão & Dados" },
];

const ENTIDADES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodificar(texto) {
  return String(texto)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? e)
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extrair(xml, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? decodificar(m[1]) : "";
}

/* O RSS do Google News é um formato fixo e simples; um parser XML completo
   seria uma dependência a mais para ganhar nada. */
function parsear(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const item = m[1];
    const titulo = extrair(item, "title");

    return {
      /* O Google anexa " - Veículo" no fim do título; separamos os dois. */
      titulo: titulo.replace(/\s+-\s+[^-]+$/, "").trim() || titulo,
      url: extrair(item, "link"),
      publicadoEm: extrair(item, "pubDate"),
      fonte: extrair(item, "source") || (titulo.match(/\s+-\s+([^-]+)$/)?.[1] ?? "").trim(),
    };
  });
}

async function buscarFeed(termo) {
  const url = `${BASE}?q=${encodeURIComponent(termo)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

  const resposta = await fetch(url, {
    headers: { "User-Agent": "ArvisxBlog/1.0 (+https://arvisx.ai)" },
    signal: AbortSignal.timeout(20000),
  });

  if (!resposta.ok) throw new Error(`Google News respondeu ${resposta.status} para "${termo}"`);

  return parsear(await resposta.text());
}

/* Retorna as pautas mais recentes, sem repetição, de todas as consultas.
   Uma consulta que falhar não derruba as outras. */
export async function buscarPautas({ dias = 21, porConsulta = 6 } = {}) {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  const vistos = new Set();
  const pautas = [];

  const resultados = await Promise.allSettled(
    CONSULTAS.map(async (c) => ({ consulta: c, itens: await buscarFeed(c.termo) })),
  );

  for (const resultado of resultados) {
    if (resultado.status === "rejected") {
      console.warn("pauta ignorada:", resultado.reason?.message);
      continue;
    }

    const { consulta, itens } = resultado.value;
    let aceitos = 0;

    for (const item of itens) {
      if (aceitos >= porConsulta) break;
      if (!item.titulo || !item.url) continue;

      const data = Date.parse(item.publicadoEm);
      if (Number.isFinite(data) && data < limite) continue;

      const chave = item.titulo.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      pautas.push({ ...item, categoriaSugerida: consulta.categoria, termo: consulta.termo });
      aceitos++;
    }
  }

  return pautas;
}

/* Evita escrever duas vezes sobre o mesmo assunto: descarta a pauta que
   compartilhar muitas palavras significativas com um post já existente. */
export function filtrarRepetidas(pautas, postsExistentes) {
  const irrelevantes = new Set([
    "para", "como", "sobre", "está", "estão", "após", "pela", "pelo", "mais",
    "novo", "nova", "novos", "novas", "com", "dos", "das", "que", "uma", "não",
    "empresa", "empresas", "negocio", "negocios", "mercado", "brasil",
    "inteligencia", "artificial", "digital", "vendas", "marketing",
  ]);

  const tokens = (texto) =>
    new Set(
      String(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((p) => p.length > 3 && !irrelevantes.has(p)),
    );

  const anteriores = postsExistentes.map((p) => tokens(`${p.titulo} ${p.resumo}`));

  return pautas.filter((pauta) => {
    const atual = tokens(pauta.titulo);
    if (atual.size === 0) return false;

    return !anteriores.some((anterior) => {
      const comuns = [...atual].filter((t) => anterior.has(t)).length;
      return comuns / atual.size >= 0.5;
    });
  });
}
