/* ==========================================================================
   Store — os posts vivem num único JSON em DATA_DIR/posts.json.

   Um banco de dados seria exagero aqui: o blog publica 1 post por semana,
   ou seja ~52 registros por ano, todos lidos de uma vez a cada render.
   Arquivo JSON significa zero dependência nativa (a imagem Docker fica
   pequena e sem etapa de build) e backup = copiar um arquivo.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";

import { caminhos } from "./config.js";
import { normalizarBlocos, slugificar, tempoLeitura } from "./util.js";

export const CATEGORIAS = [
  "Inteligência Artificial",
  "CRM & Funil",
  "Automação",
  "Tráfego & Conteúdo",
  "Gestão & Dados",
  "Atualidades",
];

/* O cache é invalidado pelo mtime do arquivo, e não só na escrita: assim o
   servidor enxerga um posts.json alterado por fora (npm run gerar, restore de
   backup) sem precisar reiniciar. */
let cache = null;
let cacheMtime = 0;

function mtime() {
  try {
    return fs.statSync(caminhos.posts).mtimeMs;
  } catch {
    return 0;
  }
}

function garantirPastas() {
  for (const dir of [caminhos.blogGerado, caminhos.imagensGeradas]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/* Escrita atômica: grava num temporário e renomeia. Evita deixar o JSON
   truncado se o processo morrer no meio (o rename é atômico no mesmo disco). */
function gravar(posts) {
  garantirPastas();

  const temporario = `${caminhos.posts}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(posts, null, 2), "utf8");
  fs.renameSync(temporario, caminhos.posts);

  cache = posts;
  cacheMtime = mtime();
}

function normalizar(post) {
  const blocos = normalizarBlocos(post.blocos || post.paragrafos || []);

  return {
    slug: post.slug || slugificar(post.titulo),
    titulo: post.titulo || "",
    subtitulo: post.subtitulo || "",
    resumo: post.resumo || post.subtitulo || "",
    categoria: CATEGORIAS.includes(post.categoria) ? post.categoria : CATEGORIAS[0],
    data: post.data,
    leitura: post.leitura || tempoLeitura(blocos),
    blocos,
    capa: post.capa || "padrao.jpg",
    capaAlt: post.capaAlt || post.titulo || "",
    /* De onde saiu a foto. A maioria das licenças do Commons é CC BY-SA e
       exige crédito, então autor e licença viajam junto com o post. */
    capaCredito: post.capaCredito || null,
    /* Links das notícias que serviram de pauta. */
    fontes: Array.isArray(post.fontes) ? post.fontes : [],
    destaque: Boolean(post.destaque),
    status: post.status === "rascunho" ? "rascunho" : "publicado",
    origem: post.origem || "gerado",
    criadoEm: post.criadoEm || new Date().toISOString(),
  };
}

function ordenar(posts) {
  return posts.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/* Primeira execução num volume vazio: copia os posts que acompanham o
   repositório, junto das capas que vieram na imagem. */
function semear() {
  if (!fs.existsSync(caminhos.seed)) return [];

  const posts = JSON.parse(fs.readFileSync(caminhos.seed, "utf8")).map(normalizar);

  if (fs.existsSync(caminhos.imagensEstaticas)) {
    garantirPastas();

    for (const arquivo of fs.readdirSync(caminhos.imagensEstaticas)) {
      const destino = path.join(caminhos.imagensGeradas, arquivo);
      if (!fs.existsSync(destino)) {
        fs.copyFileSync(path.join(caminhos.imagensEstaticas, arquivo), destino);
      }
    }
  }

  gravar(ordenar(posts));
  return cache;
}

export function lerPosts() {
  const atual = mtime();

  if (cache && atual === cacheMtime) return cache;
  if (!atual) return semear();

  try {
    const posts = JSON.parse(fs.readFileSync(caminhos.posts, "utf8"));
    cache = ordenar(posts.map(normalizar));
    cacheMtime = atual;
    return cache;
  } catch (erro) {
    /* JSON corrompido não pode derrubar o site inteiro: guardamos o arquivo
       quebrado para inspeção e recomeçamos do seed. */
    fs.renameSync(caminhos.posts, `${caminhos.posts}.quebrado-${Date.now()}`);
    console.error("posts.json ilegível, recomeçando do seed:", erro.message);
    return semear();
  }
}

export function publicados() {
  return lerPosts().filter((p) => p.status === "publicado");
}

export function rascunhos() {
  return lerPosts().filter((p) => p.status === "rascunho");
}

export function buscarPost(slug) {
  return lerPosts().find((p) => p.slug === slug) || null;
}

/* Garante que o slug não colida com um post já existente. */
export function slugLivre(base) {
  const posts = lerPosts();
  let slug = slugificar(base);
  let n = 2;

  while (posts.some((p) => p.slug === slug)) {
    slug = `${slugificar(base)}-${n}`;
    n++;
  }

  return slug;
}

export function salvarPost(post) {
  const posts = lerPosts().slice();
  const normalizado = normalizar(post);
  const i = posts.findIndex((p) => p.slug === normalizado.slug);

  if (i >= 0) posts[i] = normalizado;
  else posts.push(normalizado);

  /* Só um post pode ser o destaque da capa do blog. */
  if (normalizado.destaque) {
    for (const p of posts) {
      if (p.slug !== normalizado.slug) p.destaque = false;
    }
  }

  gravar(ordenar(posts));
  return normalizado;
}

export function removerPost(slug) {
  const posts = lerPosts().filter((p) => p.slug !== slug);
  gravar(ordenar(posts));
}

/* O destaque é o post publicado mais recente, a menos que algum esteja
   marcado à mão no /admin. */
export function destaque() {
  const lista = publicados();
  return lista.find((p) => p.destaque) || lista[0] || null;
}
