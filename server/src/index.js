/* ==========================================================================
   Servidor — entrega o site estático, o blog gerado e o painel /admin,
   e dispara o pipeline semanal.

   Tudo é servido em dois caminhos: na raiz (/) e no prefixo público, quando
   houver. O proxy do EasyPanel pode ou não remover o prefixo antes de chegar
   no container, e responder aos dois evita depender disso.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";

import formbody from "@fastify/formbody";
import estatico from "@fastify/static";
import Fastify from "fastify";
import cron from "node-cron";

import { registrarAdmin } from "./admin.js";
import { config, caminhos } from "./config.js";
import { gerarComSeguranca } from "./pipeline.js";
import { renderTudo } from "./render.js";

/* --------------------------- URLs sem extensão ----------------------------
   O endereço que o visitante vê é o nome da página, não o arquivo por trás
   dela: /funil e /blog/crm-nao-e-agenda, nunca /funil.html. São duas metades:

     1. rewriteUrl, aqui, roda ANTES do roteamento e traduz a URL limpa para
        o .html correspondente, quando ele existe em disco;
     2. o hook onRequest, mais abaixo, faz o caminho inverso — quem chegar por
        um link antigo terminado em .html leva 301 para a URL limpa.

   Assim cada página tem um endereço só, o que também evita conteúdo
   duplicado aos olhos do Google.
   ========================================================================== */

/* As páginas são poucas e estáveis, então guardar os acertos evita um
   existsSync por requisição. As ausências ficam de fora do cache de
   propósito: um post publicado agora precisa responder no mesmo instante. */
const paginasResolvidas = new Set();

function semBasePath(caminho) {
  const base = config.basePath;
  if (base && (caminho === base || caminho.startsWith(`${base}/`))) {
    return caminho.slice(base.length) || "/";
  }
  return caminho;
}

/* Existe um .html por trás desta URL limpa? */
function temPaginaHtml(caminho) {
  if (paginasResolvidas.has(caminho)) return true;

  const relativo = semBasePath(caminho);

  /* Mesma ordem de prioridade das raízes estáticas registradas abaixo: o
     conteúdo do volume ganha do que veio na imagem. */
  const candidatos = relativo.startsWith("/blog/")
    ? [
        [caminhos.blogGerado, relativo.slice("/blog/".length)],
        [caminhos.blogEstatico, relativo.slice("/blog/".length)],
      ]
    : [[config.siteDir, relativo.slice(1)]];

  for (const [raiz, sufixo] of candidatos) {
    const alvo = path.resolve(raiz, `${sufixo}.html`);

    /* path.resolve() já absorveu qualquer ".." da URL; sem esta conferência
       o existsSync viraria uma sonda do disco fora da pasta do site. */
    if (!alvo.startsWith(path.resolve(raiz) + path.sep)) continue;

    if (fs.existsSync(alvo)) {
      paginasResolvidas.add(caminho);
      return true;
    }
  }

  return false;
}

function reescreverUrl(req) {
  const [caminho, query] = req.url.split("?");

  /* Pasta, arquivo com extensão (css, img, feed.xml) e rotas do servidor
     (/admin, /healthz) passam intactos. */
  if (caminho.endsWith("/") || path.extname(caminho)) return req.url;

  let decodificado;
  try {
    decodificado = decodeURIComponent(caminho);
  } catch {
    return req.url;
  }

  if (!temPaginaHtml(decodificado)) return req.url;

  return `${caminho}.html${query ? `?${query}` : ""}`;
}

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || "info" },
  /* O proxy do EasyPanel termina o TLS; sem isto o Fastify acha que tudo
     chega em http e os redirects saem com o esquema errado. */
  trustProxy: true,
  rewriteUrl: reescreverUrl,
});

/* A outra metade: quem pedir o arquivo é mandado para o nome da página.
   Vale para links antigos, para o que o Google já indexou e para quem digita
   o .html na mão. É preciso olhar a URL original porque o rewriteUrl acima
   já pode ter posto o .html de volta em req.url — comparar a versão reescrita
   daria um laço de redirecionamento. */
app.addHook("onRequest", (req, reply, done) => {
  const [caminho, query] = (req.originalUrl || req.url).split("?");

  if (!caminho.endsWith(".html")) return done();

  const limpo = caminho.endsWith("/index.html")
    ? caminho.slice(0, -"index.html".length)
    : caminho.slice(0, -".html".length);

  reply.redirect(301, `${limpo || "/"}${query ? `?${query}` : ""}`);
});

await app.register(formbody);

/* Um volume montado como root deixa o DATA_DIR sem escrita para o usuário
   node, e o erro cru (EACCES em algum caminho interno) não diz o que fazer.
   Melhor falhar aqui, antes de qualquer outra coisa, explicando. */
try {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.accessSync(config.dataDir, fs.constants.W_OK);
} catch (erro) {
  app.log.error(
    `sem permissão de escrita em DATA_DIR (${config.dataDir}): ${erro.code || erro.message}.\n` +
      "No EasyPanel, use um Volume (não um Bind Mount) em /app/data, ou rode\n" +
      `"chown -R 1000:1000 ${config.dataDir}" no host antes de subir o serviço.`,
  );
  process.exit(1);
}

/* Cada @fastify/static extra precisa de decorateReply:false — só o primeiro
   pode instalar reply.sendFile(). */
let primeiroEstatico = true;

async function servir(raiz, prefixo) {
  fs.mkdirSync(raiz, { recursive: true });

  await app.register(estatico, {
    root: raiz,
    prefix: prefixo,
    decorateReply: primeiroEstatico,
    index: ["index.html"],
    list: false,
    /* O HTML é regravado a cada publicação; as imagens e o CSS podem durar. */
    setHeaders(res, caminho) {
      res.setHeader(
        "Cache-Control",
        caminho.endsWith(".html") ? "public, max-age=60" : "public, max-age=86400",
      );
    },
  });

  primeiroEstatico = false;
}

/* As capas que o pipeline baixa vivem no volume, não na imagem. Copiá-las
   para lá no boot garante que DATA_DIR/img/blog seja sempre um superconjunto
   do que veio no repositório — assim uma única raiz estática serve as duas
   origens e não há risco de 404 numa capa nova. */
function sincronizarCapas() {
  if (!fs.existsSync(caminhos.imagensEstaticas)) return;

  fs.mkdirSync(caminhos.imagensGeradas, { recursive: true });

  for (const arquivo of fs.readdirSync(caminhos.imagensEstaticas)) {
    const destino = path.join(caminhos.imagensGeradas, arquivo);
    if (!fs.existsSync(destino)) {
      fs.copyFileSync(path.join(caminhos.imagensEstaticas, arquivo), destino);
    }
  }
}

sincronizarCapas();

/* Os prefixos mais específicos entram primeiro: o conteúdo do volume precisa
   ganhar do que veio estático na imagem. */
const bases = config.basePath ? [config.basePath, ""] : [""];

for (const base of bases) {
  await servir(caminhos.blogGerado, `${base}/blog/`);
}

for (const base of bases) {
  await servir(caminhos.imagensGeradas, `${base}/img/blog/`);
}

for (const base of bases) {
  await servir(config.siteDir, `${base}/`);
}

/* Sem a barra final o wildcard do @fastify/static não casa. */
for (const base of bases.filter(Boolean)) {
  app.get(base, (req, reply) => reply.redirect(301, `${base}/`));
  app.get(`${base}/blog`, (req, reply) => reply.redirect(301, `${base}/blog/`));
}
app.get("/blog", (req, reply) => reply.redirect(301, "/blog/"));

/* -------------------------------- admin ---------------------------------- */

for (const base of bases) {
  registrarAdmin(app, base);
}

/* ------------------------------ utilitários ------------------------------ */

app.get("/healthz", async () => ({
  ok: true,
  posts: fs.existsSync(caminhos.posts) ? JSON.parse(fs.readFileSync(caminhos.posts, "utf8")).length : 0,
}));

app.get("/robots.txt", async (req, reply) =>
  reply
    .type("text/plain")
    .send(`User-agent: *\nDisallow: /admin\nSitemap: ${config.siteUrl}/blog/sitemap.xml\n`),
);

/* -------------------------------- boot ----------------------------------- */

/* Regerar no boot mantém o HTML em dia com qualquer mudança no render ou no
   CSS, sem precisar clicar em nada no painel. */
const total = renderTudo();
app.log.info(`blog gerado: ${total} posts em ${caminhos.blogGerado}`);

if (config.cronAtivo) {
  if (!cron.validate(config.cron)) {
    app.log.error(`CRON_AGENDA inválido ("${config.cron}") — agendamento desligado.`);
  } else {
    cron.schedule(config.cron, gerarComSeguranca, { timezone: config.fusoHorario });
    app.log.info(`pipeline agendado: ${config.cron} (${config.fusoHorario})`);
  }
} else {
  app.log.warn("CRON_ATIVO=false — nenhum post será gerado automaticamente.");
}

if (!config.adminSenha) app.log.warn("ADMIN_PASSWORD vazia — o /admin fica bloqueado.");
if (!config.openaiKey) app.log.warn("OPENAI_API_KEY vazia — a geração de posts vai falhar.");

await app.listen({ port: config.porta, host: config.host });
