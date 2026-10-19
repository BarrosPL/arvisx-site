/* ==========================================================================
   Render — transforma os posts do store em HTML estático dentro de
   DATA_DIR/blog/. O servidor apenas entrega esses arquivos; nada é montado
   por requisição, então o blog continua tão rápido quanto o resto do site.

   As classes usadas aqui são as de arvisx/css/style.css e blog.css.
   Todos os caminhos são relativos porque as páginas moram em blog/ e o site
   pode ser servido em / ou num prefixo.

   Os links entre páginas não levam ".html": o servidor entrega /blog/slug a
   partir de slug.html, e é esse endereço limpo que aparece no navegador.
   Como o post é servido em /blog/slug, a base relativa continua sendo
   /blog/ — por isso "../" chega na home e "./" no índice do blog.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";

import { config, caminhos } from "./config.js";
import { CATEGORIAS, destaque, publicados } from "./store.js";
import { dataLonga, escapar, slugificar } from "./util.js";

const ANO = new Date().getFullYear();

const FONTES_GOOGLE =
  "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500" +
  "&family=Manrope:wght@400;500;600;700;800" +
  "&family=Playfair+Display:ital,wght@0,500;0,600;1,600&display=swap";

function urlPublica(caminho) {
  return `${config.siteUrl}${caminho}`;
}

/* Destino das chamadas para ação dentro do blog.

   Com WHATSAPP preenchido a conversa já abre com o contexto do artigo — é o
   caminho de menor atrito para quem está lendo. Sem ele, cai no Instagram,
   que é o canal público que o site anuncia hoje. */
function contato(linhas = []) {
  if (!config.whatsapp) return config.instagram;

  const corpo = linhas.filter(([, valor]) => valor).map(([campo, valor]) => `${campo}: ${valor}`);
  const abertura = "Olá! Vim pelo blog da ARVISX e quero um diagnóstico da minha operação.";
  const texto = corpo.length ? `${abertura}\n\n${corpo.join("\n")}` : abertura;

  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(texto)}`;
}

/* ------------------------------- pedaços --------------------------------- */

function cabecalho({ titulo, descricao, canonical, imagem, tipo = "article" }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <title>${escapar(titulo)}</title>
  <meta name="description" content="${escapar(descricao)}" />
  <link rel="canonical" href="${escapar(canonical)}" />

  <meta property="og:type" content="${tipo}" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:title" content="${escapar(titulo)}" />
  <meta property="og:description" content="${escapar(descricao)}" />
  <meta property="og:url" content="${escapar(canonical)}" />
  <meta property="og:image" content="${escapar(imagem || urlPublica("/img/og-arvisx.jpg"))}" />
  <meta name="twitter:card" content="summary_large_image" />

  <link rel="icon" href="../img/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="32x32" href="../img/favicon-32.png" />
  <link rel="apple-touch-icon" href="../img/apple-touch-icon.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONTES_GOOGLE}" rel="stylesheet" />

  <link rel="stylesheet" href="../css/style.css" />
  <link rel="stylesheet" href="../css/blog.css" />
  <link rel="alternate" type="application/rss+xml" title="Blog ARVISX AI" href="feed.xml" />
</head>
<body>
  <a class="pular" href="#abertura">Pular para o conteúdo</a>
  <div class="grain" aria-hidden="true"></div>
${navegacao()}`;
}

function navegacao() {
  return `
  <nav class="nav" id="nav">
    <a class="brand" href="../" aria-label="ARVISX AI, início">
      <img src="../img/arvisx-marca-branca.png" alt="ARVISX AI" width="168" height="23" />
    </a>

    <button class="menu-mobile" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="nav-links">☰</button>

    <div class="nav-links" id="nav-links">
      <a href="../#solucoes">Soluções</a>
      <a href="../#agentes">Agentes de IA</a>
      <a href="../#clientes">Ecossistema</a>
      <a href="../funil">Guia de Funil</a>
      <a href="./">Blog</a>
      <a class="nav-cta nav-cta-mobile" href="../#contato">Diagnóstico estratégico <b>↗</b></a>
    </div>

    <a class="nav-cta" href="../#contato">Diagnóstico estratégico <b>↗</b></a>
  </nav>`;
}

function rodape() {
  return `
  <footer class="rodape">
    <a class="brand compacta" href="../">
      <img src="../img/arvisx-marca-branca.png" alt="ARVISX AI" width="140" height="19" />
    </a>
    <p>O elo inteligente do seu ecossistema. © ${ANO}</p>
    <nav aria-label="Rodapé">
      <a href="../#solucoes">Soluções</a>
      <a href="../funil">Guia de Funil</a>
      <a href="./">Blog</a>
      <a href="../#contato">Contato</a>
    </nav>
  </footer>

  <script src="../js/main.js" defer></script>
  <script src="../js/blog.js" defer></script>`;
}

function cartao(post, { destaque: emDestaque = false, prioridade = false } = {}) {
  return `
        <article${emDestaque ? ' class="destaque"' : ""} data-categoria="${escapar(post.categoria)}">
          <img src="../img/blog/${escapar(post.capa)}" alt="${escapar(post.capaAlt)}"${
            prioridade ? "" : ' loading="lazy"'
          } />
          <div>
            <p>${emDestaque ? "DESTAQUE · " : ""}${escapar(post.categoria)}</p>
            <h2>${escapar(post.titulo)}</h2>
            <small>${dataLonga(post.data)} · ${escapar(post.leitura)} de leitura</small>
            <a href="${escapar(post.slug)}">Ler o artigo ↗</a>
          </div>
        </article>`;
}

/* -------------------------- corpo em seções --------------------------------
   O corpo do post é uma lista plana de blocos. Aqui ele vira: um parágrafo
   de abertura (.lead), depois uma <section> por subtítulo — que é o que o
   sumário lateral e o scroll-spy do blog.js precisam para funcionar. */

function agrupar(blocos) {
  const secoes = [];
  let abertura = [];
  let atual = null;

  for (const bloco of blocos) {
    if (bloco.tipo === "h2") {
      if (atual) secoes.push(atual);
      atual = { titulo: bloco.texto, id: slugificar(bloco.texto) || `secao-${secoes.length + 1}`, blocos: [] };
      continue;
    }

    if (atual) atual.blocos.push(bloco);
    else abertura.push(bloco);
  }

  if (atual) secoes.push(atual);

  /* Ids repetidos quebrariam as âncoras do sumário. */
  const vistos = new Set();
  for (const secao of secoes) {
    let id = secao.id;
    let n = 2;
    while (vistos.has(id)) id = `${secao.id}-${n++}`;
    vistos.add(id);
    secao.id = id;
  }

  return { abertura, secoes };
}

function corpoDoBloco(bloco, indentacao = "          ") {
  if (bloco.tipo === "ul") {
    const itens = bloco.itens.map((i) => `${indentacao}  <li>${escapar(i)}</li>`).join("\n");
    return `${indentacao}<ul>\n${itens}\n${indentacao}</ul>`;
  }

  return `${indentacao}<p>${escapar(bloco.texto)}</p>`;
}

/* ---------------------------- página de post ------------------------------ */

export function renderPost(post, todos) {
  const relacionados = todos.filter((p) => p.slug !== post.slug).slice(0, 2);
  const { abertura, secoes } = agrupar(post.blocos);

  const [primeiro, ...resto] = abertura;

  const dadosEstruturados = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.titulo,
    description: post.resumo,
    datePublished: post.data,
    articleSection: post.categoria,
    inLanguage: "pt-BR",
    image: urlPublica(`/img/blog/${post.capa}`),
    author: { "@type": "Organization", name: "ARVISX AI" },
    publisher: { "@type": "Organization", name: "ARVISX AI" },
    mainEntityOfPage: urlPublica(`/blog/${post.slug}`),
  };

  const sumario = secoes.length
    ? `
      <aside data-indice>
        <span>NESTE ARTIGO</span>
${secoes.map((s) => `        <a href="#${s.id}">${escapar(s.titulo)}</a>`).join("\n")}
      </aside>`
    : "<aside></aside>";

  /* Crédito da foto e das pautas. Transparência sobre a origem: o texto é
     original, a foto e a pauta não. A licença do Commons costuma exigir a
     atribuição, então ela não é opcional. */
  const partesCredito = [];

  if (post.capaCredito?.autor) {
    const { autor, licenca, pagina } = post.capaCredito;
    const nome = pagina
      ? `<a href="${escapar(pagina)}" target="_blank" rel="noopener nofollow">${escapar(autor)}</a>`
      : escapar(autor);
    partesCredito.push(`Foto de ${nome}${licenca ? ` · ${escapar(licenca)}` : ""}, via Wikimedia Commons.`);
  }

  if (post.fontes.length) {
    const links = post.fontes
      .map(
        (f) =>
          `<a href="${escapar(f.url)}" target="_blank" rel="noopener nofollow">${escapar(f.fonte || f.titulo)}</a>`,
      )
      .join(" · ");
    partesCredito.push(`Pauta consultada: ${links}.`);
  }

  const fontes = partesCredito.length
    ? `
  <div class="article-fontes">
    <strong>CRÉDITOS</strong>
    ${partesCredito.join("<br />\n    ")}
  </div>`
    : "";

  const continuar = relacionados.length
    ? `
  <section class="article-more">
    <p class="eyebrow purple"><i></i> CONTINUE LENDO</p>
    <h2>Outros conteúdos</h2>
    <div class="blog-grid">${relacionados.map((p) => cartao(p)).join("")}
    </div>
  </section>`
    : "";

  return `${cabecalho({
    titulo: `${post.titulo} | ARVISX AI`,
    descricao: post.resumo,
    canonical: urlPublica(`/blog/${post.slug}`),
    imagem: urlPublica(`/img/blog/${post.capa}`),
  })}

  <main class="article-page">
    <header class="article-hero" id="abertura">
      <a class="voltar" href="./">← VOLTAR AO BLOG</a>
      <p class="eyebrow"><i></i> ${escapar(post.categoria)} · ${dataLonga(post.data)} · ${escapar(post.leitura)}</p>
      <h1>${escapar(post.titulo)}</h1>
      <p>${escapar(post.subtitulo)}</p>
    </header>

    <figure class="article-cover">
      <img src="../img/blog/${escapar(post.capa)}" alt="${escapar(post.capaAlt)}" fetchpriority="high" />
    </figure>

    <div class="article-content">${sumario}

      <div>
${primeiro ? `        <p class="lead">${escapar(primeiro.texto || "")}</p>` : ""}
${resto.map((b) => corpoDoBloco(b, "        ")).join("\n")}
${secoes
  .map(
    (secao, i) => `
        <section id="${secao.id}">
          <p class="kicker">${String(i + 1).padStart(2, "0")}</p>
          <h2>${escapar(secao.titulo)}</h2>
${secao.blocos.map((b) => corpoDoBloco(b)).join("\n")}
        </section>`,
  )
  .join("")}

        <div class="article-cta">
          <p>Quer transformar este assunto em resultado na sua operação?</p>
          <a class="button primary" href="${escapar(
            contato([
              ["Assunto", post.titulo],
              ["Categoria", post.categoria],
              ["Página", urlPublica(`/blog/${post.slug}`)],
            ]),
          )}" target="_blank" rel="noopener">Solicitar diagnóstico estratégico <span>↗</span></a>
        </div>
      </div>
    </div>
${fontes}${continuar}
  </main>
${rodape()}

  <script type="application/ld+json">${JSON.stringify(dadosEstruturados)}</script>
</body>
</html>
`;
}

/* ---------------------------- índice do blog ------------------------------ */

export function renderIndice(posts, emDestaque) {
  const usadas = CATEGORIAS.filter((c) => posts.some((p) => p.categoria === c));

  const botoes = [
    `<button type="button" class="ativo" data-categoria="todos" aria-pressed="true">Todos</button>`,
    ...usadas.map(
      (c) =>
        `<button type="button" data-categoria="${escapar(c)}" aria-pressed="false">${escapar(c)}</button>`,
    ),
  ].join("\n        ");

  /* O destaque abre a grade em largura total; os demais seguem em duas
     colunas, na ordem cronológica. */
  const demais = emDestaque ? posts.filter((p) => p.slug !== emDestaque.slug) : posts;

  /* A capa do destaque é a única acima da dobra: carrega sem lazy. */
  const cartoes =
    (emDestaque ? cartao(emDestaque, { destaque: true, prioridade: true }) : "") +
    demais.map((p) => cartao(p)).join("");

  return `${cabecalho({
    titulo: "Blog ARVISX AI | Inteligência, automação e crescimento comercial",
    descricao:
      "Artigos sobre inteligência artificial aplicada a vendas, CRM, automação de processos, tráfego, conteúdo e gestão por dados.",
    canonical: urlPublica("/blog/"),
    imagem: emDestaque ? urlPublica(`/img/blog/${emDestaque.capa}`) : null,
    tipo: "website",
  })}

  <main class="blog-page">
    <header class="blog-hero" id="abertura">
      <p class="eyebrow"><i></i> BLOG ARVISX AI</p>
      <h1>Inteligência que<br />vira <em>receita.</em></h1>
      <p>
        O que estamos aprendendo ao conectar IA, CRM, automação e tráfego em
        operações comerciais reais — sem promessa mágica e sem jargão vazio.
      </p>
    </header>

    <div class="blog-toolbar" data-filtros>
      <div>
        ${botoes}
      </div>
      <span data-contador>${posts.length} ${posts.length === 1 ? "conteúdo" : "conteúdos"}</span>
    </div>

    <div class="blog-grid" data-posts>${cartoes}
      <p class="blog-vazio" hidden>Nenhum conteúdo nesta categoria por enquanto.</p>
    </div>
  </main>
${rodape()}
</body>
</html>
`;
}

/* ------------------------------ feed e sitemap ---------------------------- */

function renderFeed(posts) {
  const itens = posts
    .map(
      (p) => `    <item>
      <title>${escapar(p.titulo)}</title>
      <link>${escapar(urlPublica(`/blog/${p.slug}`))}</link>
      <guid isPermaLink="true">${escapar(urlPublica(`/blog/${p.slug}`))}</guid>
      <category>${escapar(p.categoria)}</category>
      <pubDate>${new Date(`${p.data}T09:00:00Z`).toUTCString()}</pubDate>
      <description>${escapar(p.resumo)}</description>
    </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog ARVISX AI</title>
    <link>${escapar(urlPublica("/blog/"))}</link>
    <description>Inteligência artificial, CRM, automação e dados aplicados a operações comerciais.</description>
    <language>pt-BR</language>
${itens}
  </channel>
</rss>
`;
}

function renderSitemap(posts) {
  const urls = [urlPublica("/"), urlPublica("/funil"), urlPublica("/blog/")]
    .map((u) => `  <url><loc>${escapar(u)}</loc></url>`)
    .concat(
      posts.map(
        (p) =>
          `  <url><loc>${escapar(urlPublica(`/blog/${p.slug}`))}</loc><lastmod>${p.data}</lastmod></url>`,
      ),
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/* ------------------------------ orquestração ------------------------------ */

/* Regenera o blog inteiro. É barato (dezenas de arquivos pequenos) e evita
   qualquer risco de índice e posts saírem de sincronia. */
export function renderTudo(destino = caminhos.blogGerado) {
  fs.mkdirSync(destino, { recursive: true });

  const posts = publicados();
  const emDestaque = destaque();

  /* Remove HTML de posts que foram apagados ou voltaram a rascunho. */
  const validos = new Set([...posts.map((p) => `${p.slug}.html`), "index.html"]);
  for (const arquivo of fs.readdirSync(destino)) {
    if (arquivo.endsWith(".html") && !validos.has(arquivo)) {
      fs.unlinkSync(path.join(destino, arquivo));
    }
  }

  for (const post of posts) {
    fs.writeFileSync(path.join(destino, `${post.slug}.html`), renderPost(post, posts), "utf8");
  }

  fs.writeFileSync(path.join(destino, "index.html"), renderIndice(posts, emDestaque), "utf8");
  fs.writeFileSync(path.join(destino, "feed.xml"), renderFeed(posts), "utf8");
  fs.writeFileSync(path.join(destino, "sitemap.xml"), renderSitemap(posts), "utf8");

  return posts.length;
}
