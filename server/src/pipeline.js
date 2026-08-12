/* ==========================================================================
   Pipeline semanal do blog da ARVISX.

   1. coleta pautas no Google News
   2. descarta o que já virou post
   3. a OpenAI escolhe uma pauta e escreve o texto
   4. a capa vem do Wikimedia Commons, com autor e licença
   5. o post é salvo (rascunho por padrão) e o blog é regerado

   Nada aqui publica sozinho a menos que AUTO_PUBLICAR=true. O padrão é
   rascunho: o Google penaliza conteúdo gerado em massa sem curadoria, e um
   olhar humano por semana custa dois minutos.
   ========================================================================== */

import path from "node:path";

import { config, caminhos } from "./config.js";
import { escreverPost } from "./openai.js";
import { renderTudo } from "./render.js";
import { buscarCapa, baixar } from "./sources/commons.js";
import { buscarPautas, filtrarRepetidas } from "./sources/news.js";
import { CATEGORIAS, lerPosts, salvarPost, slugLivre } from "./store.js";
import { hojeISO, normalizarBlocos, tempoLeitura } from "./util.js";

/* Estado da última execução, mostrado no /admin. */
export const ultimaExecucao = {
  em: null,
  ok: null,
  mensagem: "ainda não rodou nesta instância",
  slug: null,
};

function registrar(ok, mensagem, slug = null) {
  ultimaExecucao.em = new Date().toISOString();
  ultimaExecucao.ok = ok;
  ultimaExecucao.mensagem = mensagem;
  ultimaExecucao.slug = slug;

  console[ok ? "log" : "error"](`[pipeline] ${mensagem}`);
}

export async function gerarPost({ publicar = config.autoPublicar } = {}) {
  const posts = lerPosts();

  /* ---------------------------- 1 e 2: pautas ---------------------------- */
  const brutas = await buscarPautas();
  if (!brutas.length) {
    const erro = "nenhuma pauta voltou do Google News";
    registrar(false, erro);
    throw new Error(erro);
  }

  const pautas = filtrarRepetidas(brutas, posts);
  if (!pautas.length) {
    const erro = `as ${brutas.length} pautas da semana repetem assuntos já publicados`;
    registrar(false, erro);
    throw new Error(erro);
  }

  /* Um teto no número de pautas mantém o prompt curto e a escolha focada. */
  const selecionadas = pautas.slice(0, 24);

  /* -------------------------- 3: redação --------------------------------- */
  const escrito = await escreverPost(selecionadas, posts);

  const indice = Number(escrito.pautaEscolhida);
  const pauta = selecionadas[indice] || selecionadas[0];

  const blocos = normalizarBlocos(escrito.corpo);
  if (!blocos.length) throw new Error("o post veio sem corpo utilizável.");

  const slug = slugLivre(escrito.titulo);

  /* ---------------------------- 4: capa ---------------------------------- */
  let capa = `${slug}.jpg`;
  let capaCredito = null;

  try {
    const foto = await buscarCapa(escrito.termoCapa || pauta.titulo);

    if (foto) {
      await baixar(foto.url, path.join(caminhos.imagensGeradas, capa));
      capaCredito = { autor: foto.autor, licenca: foto.licenca, pagina: foto.pagina };
    } else {
      throw new Error("nenhuma foto adequada no Commons");
    }
  } catch (erro) {
    /* Sem capa própria o post não pode ficar quebrado: cai na imagem de
       marca, que já acompanha o site. */
    console.warn(`[pipeline] capa: ${erro.message} — usando a imagem padrão`);
    capa = "padrao.jpg";
  }

  /* --------------------------- 5: gravação -------------------------------- */
  const post = salvarPost({
    slug,
    titulo: escrito.titulo,
    subtitulo: escrito.subtitulo || "",
    resumo: escrito.resumo || escrito.subtitulo || "",
    categoria: CATEGORIAS.includes(escrito.categoria)
      ? escrito.categoria
      : pauta.categoriaSugerida,
    data: hojeISO(),
    leitura: tempoLeitura(blocos),
    blocos,
    capa,
    capaAlt: escrito.capaAlt || escrito.titulo,
    capaCredito,
    fontes: [{ titulo: pauta.titulo, url: pauta.url, fonte: pauta.fonte }],
    status: publicar ? "publicado" : "rascunho",
    origem: "gerado",
  });

  renderTudo();

  registrar(
    true,
    `"${post.titulo}" salvo como ${post.status} (pauta: ${pauta.fonte || "Google News"})`,
    post.slug,
  );

  return post;
}

/* Envoltório usado pelo cron: falha de rede ou da OpenAI não pode derrubar
   o processo que também está servindo o site. */
export async function gerarComSeguranca() {
  try {
    return await gerarPost();
  } catch (erro) {
    registrar(false, `falhou: ${erro.message}`);
    return null;
  }
}
