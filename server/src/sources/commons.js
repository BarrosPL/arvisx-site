/* ==========================================================================
   Capa — Wikimedia Commons.

   Fotos livres, com autor e licença declarados na própria API. A licença é
   gravada no post e aparece no rodapé do artigo, porque a maioria é CC BY-SA
   e exige crédito.

   A busca é por termo em inglês: o acervo do Commons é indexado assim, e
   consulta em português devolve quase nada fora de temas locais.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "ArvisxBlog/1.0 (+https://arvisx.ai)";

/* Arquivos que nunca servem de capa: vetores, mapas, brasões, capturas de
   tela e diagramas. O filtro é por nome porque a API não expõe categoria
   utilizável aqui sem uma segunda chamada por arquivo. */
const DESCARTAR = /(map|mapa|coat of arms|bras[aã]o|logo|flag|bandeira|diagram|chart|screenshot|icon|seal|emblem)/i;

function limpar(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Procura uma foto boa para o termo. Descarta o que não serve de capa:
   arquivos pequenos, formatos vetoriais e imagens em retrato — a capa é
   sempre exibida em faixa larga. */
export async function buscarCapa(termo) {
  const url =
    `${API}?action=query&format=json&formatversion=2` +
    `&generator=search&gsrsearch=${encodeURIComponent(`${termo} filetype:bitmap`)}` +
    "&gsrnamespace=6&gsrlimit=25" +
    "&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600";

  const resposta = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });

  if (!resposta.ok) throw new Error(`Commons respondeu ${resposta.status}`);

  const dados = await resposta.json();
  const paginas = dados?.query?.pages || [];

  for (const pagina of paginas) {
    const info = pagina.imageinfo?.[0];
    if (!info) continue;

    const nome = String(pagina.title || "");
    if (!/\.(jpe?g|png)$/i.test(nome)) continue;
    if (DESCARTAR.test(nome)) continue;
    /* Precisa ser grande e em paisagem: a capa ocupa a largura toda. */
    if (info.width < 1200 || info.width < info.height * 1.2) continue;

    const meta = info.extmetadata || {};

    return {
      url: info.thumburl || info.url,
      autor: limpar(meta.Artist?.value) || "Wikimedia Commons",
      licenca: limpar(meta.LicenseShortName?.value) || "Wikimedia Commons",
      pagina: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(nome)}`,
      titulo: nome.replace(/^File:/, ""),
    };
  }

  return null;
}

export async function baixar(url, destino) {
  const resposta = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(60000),
  });

  if (!resposta.ok) throw new Error(`download da capa falhou (${resposta.status})`);

  const bytes = Buffer.from(await resposta.arrayBuffer());
  if (bytes.length < 10_000) throw new Error("capa veio pequena demais, provavelmente um erro");

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, bytes);

  return bytes.length;
}
