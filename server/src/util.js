/* ==========================================================================
   Utilidades compartilhadas — slug, datas, escape de HTML e corpo do post.
   ========================================================================== */

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/* Mesma regra de slug usada nos nomes dos arquivos do site, para o blog não
   destoar do resto. */
export function slugificar(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70)
    .replace(/-$/, "");
}

export function escapar(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* "2026-08-11" -> "11 ago 2026" */
export function dataLonga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  return `${m[3]} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

export function hojeISO(agora = new Date()) {
  return agora.toISOString().slice(0, 10);
}

/* Estimativa de tempo de leitura a 200 palavras por minuto, com piso de 3. */
export function tempoLeitura(blocos) {
  const palavras = blocos
    .map((b) => (b.tipo === "ul" ? b.itens.join(" ") : b.texto))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  return `${Math.max(3, Math.round(palavras / 200))} min`;
}

/* ------------------------- corpo do post ---------------------------------
   O corpo é uma lista de blocos ({tipo:"p"|"h2"|"ul"}). No /admin ele vira
   texto simples para caber num <textarea>:

     ## vira um subtítulo (h2)
     - vira um item de lista
     qualquer outra linha vira parágrafo, separado por linha em branco
   ------------------------------------------------------------------------ */

export function textoParaBlocos(texto) {
  const blocos = [];
  let paragrafo = [];
  let lista = null;

  const fecharParagrafo = () => {
    if (paragrafo.length) {
      blocos.push({ tipo: "p", texto: paragrafo.join(" ").trim() });
      paragrafo = [];
    }
  };

  const fecharLista = () => {
    if (lista && lista.length) blocos.push({ tipo: "ul", itens: lista });
    lista = null;
  };

  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.trim();

    if (!linha) {
      fecharParagrafo();
      fecharLista();
      continue;
    }

    if (linha.startsWith("##")) {
      fecharParagrafo();
      fecharLista();
      blocos.push({ tipo: "h2", texto: linha.replace(/^#+\s*/, "") });
      continue;
    }

    if (/^[-*]\s+/.test(linha)) {
      fecharParagrafo();
      lista = lista || [];
      lista.push(linha.replace(/^[-*]\s+/, ""));
      continue;
    }

    fecharLista();
    paragrafo.push(linha);
  }

  fecharParagrafo();
  fecharLista();

  return blocos;
}

export function blocosParaTexto(blocos) {
  return (blocos || [])
    .map((b) => {
      if (b.tipo === "h2") return `## ${b.texto}`;
      if (b.tipo === "ul") return b.itens.map((i) => `- ${i}`).join("\n");
      return b.texto;
    })
    .join("\n\n");
}

/* Normaliza o que vier da OpenAI ou de uma edição manual. Blocos com tipo
   desconhecido ou vazios são descartados em vez de quebrar o render. */
export function normalizarBlocos(bruto) {
  if (typeof bruto === "string") return textoParaBlocos(bruto);
  if (!Array.isArray(bruto)) return [];

  const blocos = [];

  for (const item of bruto) {
    if (typeof item === "string") {
      if (item.trim()) blocos.push({ tipo: "p", texto: item.trim() });
      continue;
    }

    if (!item || typeof item !== "object") continue;

    if (item.tipo === "ul") {
      const itens = (item.itens || []).map((i) => String(i).trim()).filter(Boolean);
      if (itens.length) blocos.push({ tipo: "ul", itens });
      continue;
    }

    const texto = String(item.texto || "").trim();
    if (!texto) continue;

    blocos.push({ tipo: item.tipo === "h2" ? "h2" : "p", texto });
  }

  return blocos;
}
