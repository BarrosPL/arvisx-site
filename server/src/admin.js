/* ==========================================================================
   Painel de aprovação — /admin

   Uma página só, sem framework de front-end: lista os posts, gera um novo
   sob demanda, permite editar o texto e publicar. Protegido por HTTP Basic;
   como o EasyPanel entrega o site em HTTPS, a senha não trafega em claro.
   ========================================================================== */

import { timingSafeEqual } from "node:crypto";

import { config } from "./config.js";
import { gerarPost, ultimaExecucao } from "./pipeline.js";
import { renderTudo } from "./render.js";
import { CATEGORIAS, buscarPost, lerPosts, removerPost, salvarPost } from "./store.js";
import { blocosParaTexto, dataLonga, escapar, textoParaBlocos, tempoLeitura } from "./util.js";

/* Comparação em tempo constante para a senha não vazar por timing. */
function iguais(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function autenticar(req, reply) {
  if (!config.adminSenha) {
    reply.code(503).type("text/html; charset=utf-8");
    return reply.send(
      pagina(
        "Admin desligado",
        `<p class="aviso">Defina <code>ADMIN_PASSWORD</code> nas variáveis de ambiente do serviço para liberar o painel.</p>`,
      ),
    );
  }

  const cabecalho = req.headers.authorization || "";
  const [tipo, valor] = cabecalho.split(" ");

  if (tipo === "Basic" && valor) {
    const [usuario, senha] = Buffer.from(valor, "base64").toString("utf8").split(":");
    if (iguais(usuario ?? "", config.adminUsuario) && iguais(senha ?? "", config.adminSenha)) {
      return null;
    }
  }

  reply.code(401).header("WWW-Authenticate", 'Basic realm="Blog ARVISX"');
  return reply.send("Acesso restrito.");
}

/* --------------------------------- HTML ---------------------------------- */

const ESTILO = `
  :root { --ink:#0f131a; --gold:#d4af37; --paper:#f0ebe0; --bronze:#b87a2e; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--paper); color:var(--ink); font:14px/1.6 Arial, sans-serif; padding:34px; }
  .wrap { max-width:940px; margin:0 auto; }
  h1 { font:400 42px Georgia, serif; letter-spacing:-.04em; margin-bottom:4px; }
  h1 i { color:var(--bronze); }
  .sub { color:#6b6458; font-size:12px; margin-bottom:26px; }
  .barra { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:24px;
           padding-bottom:20px; border-bottom:1px solid #cec4b2; }
  .status { margin-left:auto; font-size:11px; color:#6b6458; text-align:right; }
  .status.erro { color:#9b2c2c; }
  button, .botao { display:inline-block; padding:10px 16px; border:0; border-radius:999px;
    background:var(--ink); color:var(--gold); font:700 11px Arial, sans-serif;
    letter-spacing:.06em; text-decoration:none; cursor:pointer; }
  button.claro, .botao.claro { background:transparent; color:var(--ink); border:1px solid #b7ac99; }
  button.perigo { background:#7d2323; color:#fff; }
  table { width:100%; border-collapse:collapse; background:#faf6ee; border-radius:14px; overflow:hidden; }
  th, td { padding:13px 14px; text-align:left; border-bottom:1px solid #e2d9c8; vertical-align:top; }
  th { font-size:9px; letter-spacing:.16em; text-transform:uppercase; color:var(--bronze); }
  td.acoes { white-space:nowrap; text-align:right; }
  td.acoes form { display:inline; }
  td.acoes button { padding:7px 12px; font-size:10px; margin-left:5px; }
  .tag { display:inline-block; padding:3px 9px; border-radius:999px; font-size:9px;
         letter-spacing:.1em; text-transform:uppercase; }
  .tag.rascunho { background:#e8d9b0; color:#6b551c; }
  .tag.publicado { background:#d8e4d2; color:#2f5227; }
  .tag.destaque { background:var(--ink); color:var(--gold); }
  label { display:block; margin:20px 0 7px; font-size:10px; letter-spacing:.14em;
          text-transform:uppercase; color:var(--bronze); }
  input, textarea, select { width:100%; padding:12px; background:#fdfaf3; border:1px solid #cabfa9;
    font:14px/1.6 Arial, sans-serif; border-radius:10px; }
  textarea { min-height:340px; font:15px/1.75 Georgia, serif; resize:vertical; }
  .dica { color:#6b6458; font-size:11px; margin-top:6px; }
  img.capa { width:100%; max-height:260px; object-fit:cover; border-radius:12px;
             border:1px solid #cabfa9; display:block; }
  .aviso { padding:14px 16px; background:#f6e7c8; border-left:3px solid var(--bronze);
           border-radius:0 10px 10px 0; font-size:12px; margin-bottom:20px; }
  .aviso.erro { background:#f3d9d9; border-color:#9b2c2c; }
  .voltar { font-size:11px; color:#6b6458; text-decoration:none; }
  .rodape-form { display:flex; gap:10px; margin-top:26px; padding-top:20px; border-top:1px solid #cec4b2; }
  code { background:#e4dbc9; padding:1px 5px; border-radius:4px; font-size:12px; }
`;

function pagina(titulo, corpo) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapar(titulo)} · Blog ARVISX</title>
  <style>${ESTILO}</style>
</head>
<body><div class="wrap">${corpo}</div></body>
</html>`;
}

function linha(post, base) {
  return `
      <tr>
        <td>
          <strong>${escapar(post.titulo)}</strong><br />
          <span style="font-size:11px;color:#6b6458">
            ${escapar(post.categoria)} · ${dataLonga(post.data)} · ${escapar(post.leitura)} ·
            ${post.origem === "gerado" ? "gerado por IA" : "escrito à mão"}
          </span>
        </td>
        <td>
          <span class="tag ${post.status}">${post.status}</span>
          ${post.destaque ? '<span class="tag destaque">destaque</span>' : ""}
        </td>
        <td class="acoes">
          <a class="botao claro" href="${base}/admin/post/${post.slug}">Editar</a>
          ${
            post.status === "rascunho"
              ? `<form method="post" action="${base}/admin/post/${post.slug}/publicar"><button>Publicar</button></form>`
              : `<form method="post" action="${base}/admin/post/${post.slug}/rascunho"><button class="claro">Despublicar</button></form>`
          }
          <form method="post" action="${base}/admin/post/${post.slug}/excluir"
                onsubmit="return confirm('Excluir &quot;${escapar(post.titulo).replace(/'/g, "&#39;")}&quot; definitivamente?')">
            <button class="perigo">Excluir</button>
          </form>
        </td>
      </tr>`;
}

function telaLista(base, mensagem) {
  const posts = lerPosts();
  const rascunhos = posts.filter((p) => p.status === "rascunho");
  const publicados = posts.filter((p) => p.status === "publicado");

  const bloco = (titulo, lista) =>
    lista.length
      ? `
    <h2 style="font:400 24px Georgia,serif;margin:32px 0 12px">${titulo}</h2>
    <table><thead><tr><th>Post</th><th>Estado</th><th></th></tr></thead>
      <tbody>${lista.map((p) => linha(p, base)).join("")}</tbody>
    </table>`
      : "";

  const carimbo = ultimaExecucao.em
    ? `${new Date(ultimaExecucao.em).toLocaleString("pt-BR")} — ${escapar(ultimaExecucao.mensagem)}`
    : escapar(ultimaExecucao.mensagem);

  return pagina(
    "Painel",
    `
    <h1>Blog <i>ARVISX</i></h1>
    <p class="sub">${publicados.length} publicados · ${rascunhos.length} em rascunho ·
       agenda <code>${escapar(config.cron)}</code> (${escapar(config.fusoHorario)})${
         config.cronAtivo ? "" : " — <strong>desligada</strong>"
       }</p>

    ${mensagem ? `<p class="aviso${mensagem.erro ? " erro" : ""}">${escapar(mensagem.texto)}</p>` : ""}

    <div class="barra">
      <form method="post" action="${base}/admin/gerar">
        <button>Gerar post agora</button>
      </form>
      <form method="post" action="${base}/admin/render">
        <button class="claro">Regerar HTML</button>
      </form>
      <a class="botao claro" href="${base}/blog/" target="_blank">Ver o blog ↗</a>
      <span class="status${ultimaExecucao.ok === false ? " erro" : ""}">Última geração:<br />${carimbo}</span>
    </div>

    ${bloco("Aguardando aprovação", rascunhos)}
    ${bloco("No ar", publicados)}
  `,
  );
}

function telaEdicao(post, base, mensagem) {
  const opcoes = CATEGORIAS.map(
    (c) => `<option value="${escapar(c)}"${c === post.categoria ? " selected" : ""}>${escapar(c)}</option>`,
  ).join("");

  return pagina(
    "Editar",
    `
    <a class="voltar" href="${base}/admin">← voltar ao painel</a>
    <h1 style="margin-top:14px">Editar post</h1>
    <p class="sub">${escapar(post.slug)} · ${post.status} · ${
      post.origem === "gerado" ? "gerado por IA" : "escrito à mão"
    }</p>

    ${mensagem ? `<p class="aviso">${escapar(mensagem.texto)}</p>` : ""}

    ${
      post.fontes.length
        ? `<p class="aviso">Pauta: <a href="${escapar(post.fontes[0].url)}" target="_blank" rel="noopener">${escapar(
            post.fontes[0].titulo,
          )}</a> — ${escapar(post.fontes[0].fonte || "Google News")}</p>`
        : ""
    }

    <form method="post" action="${base}/admin/post/${post.slug}">
      <label>Título</label>
      <input name="titulo" value="${escapar(post.titulo)}" required />

      <label>Subtítulo</label>
      <input name="subtitulo" value="${escapar(post.subtitulo)}" />

      <label>Resumo (card do blog)</label>
      <input name="resumo" value="${escapar(post.resumo)}" maxlength="200" />

      <label>Categoria</label>
      <select name="categoria">${opcoes}</select>

      <label>Data</label>
      <input name="data" type="date" value="${escapar(post.data)}" />

      <label>Texto</label>
      <textarea name="corpo">${escapar(blocosParaTexto(post.blocos))}</textarea>
      <p class="dica">Linha em branco separa parágrafos · <code>## </code> vira subtítulo
         (e entra no sumário lateral) · <code>- </code> vira item de lista.</p>

      <label>Capa</label>
      <img class="capa" src="${base}/img/blog/${escapar(post.capa)}" alt="${escapar(post.capaAlt)}" />
      <p class="dica">
        <code>${escapar(post.capa)}</code>${
          post.capaCredito?.autor
            ? ` · ${escapar(post.capaCredito.autor)} (${escapar(post.capaCredito.licenca || "sem licença declarada")})`
            : " · imagem de marca, sem crédito de terceiro"
        }.
        Para trocar, substitua o arquivo em <code>DATA_DIR/img/blog/</code>.
      </p>

      <label>Descrição da capa (acessibilidade)</label>
      <input name="capaAlt" value="${escapar(post.capaAlt)}" />

      <label style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:13px;letter-spacing:0">
        <input type="checkbox" name="destaque" value="1" style="width:auto"${post.destaque ? " checked" : ""} />
        Usar como destaque na capa do blog
      </label>

      <div class="rodape-form">
        <button name="acao" value="salvar">Salvar</button>
        ${
          post.status === "rascunho"
            ? `<button name="acao" value="publicar">Salvar e publicar</button>`
            : `<a class="botao claro" href="${base}/blog/${post.slug}" target="_blank">Ver no site ↗</a>`
        }
      </div>
    </form>
  `,
  );
}

/* -------------------------------- rotas ---------------------------------- */

export function registrarAdmin(app, base) {
  const html = (reply, corpo) => reply.type("text/html; charset=utf-8").send(corpo);
  const voltar = (reply, texto, erro = false) =>
    reply.redirect(`${base}/admin?m=${encodeURIComponent(texto)}${erro ? "&e=1" : ""}`);

  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith(`${base}/admin`)) return;
    const bloqueio = autenticar(req, reply);
    if (bloqueio) return bloqueio;
  });

  const mensagemDaQuery = (req) =>
    req.query?.m ? { texto: String(req.query.m), erro: req.query.e === "1" } : null;

  app.get(`${base}/admin`, async (req, reply) => html(reply, telaLista(base, mensagemDaQuery(req))));

  app.post(`${base}/admin/gerar`, async (req, reply) => {
    try {
      const post = await gerarPost();
      return voltar(reply, `"${post.titulo}" criado como ${post.status}.`);
    } catch (erro) {
      return voltar(reply, `Não deu para gerar: ${erro.message}`, true);
    }
  });

  app.post(`${base}/admin/render`, async (req, reply) => {
    const total = renderTudo();
    return voltar(reply, `HTML regerado — ${total} posts no ar.`);
  });

  app.get(`${base}/admin/post/:slug`, async (req, reply) => {
    const post = buscarPost(req.params.slug);
    if (!post) return reply.code(404).send("Post não encontrado.");
    return html(reply, telaEdicao(post, base, mensagemDaQuery(req)));
  });

  app.post(`${base}/admin/post/:slug`, async (req, reply) => {
    const post = buscarPost(req.params.slug);
    if (!post) return reply.code(404).send("Post não encontrado.");

    const corpo = req.body || {};
    const blocos = textoParaBlocos(corpo.corpo || "");

    if (!blocos.length) return voltar(reply, "O texto do post não pode ficar vazio.", true);

    salvarPost({
      ...post,
      titulo: (corpo.titulo || post.titulo).trim(),
      subtitulo: (corpo.subtitulo || "").trim(),
      resumo: (corpo.resumo || "").trim(),
      categoria: corpo.categoria,
      data: corpo.data || post.data,
      blocos,
      leitura: tempoLeitura(blocos),
      capaAlt: (corpo.capaAlt || "").trim(),
      destaque: corpo.destaque === "1",
      status: corpo.acao === "publicar" ? "publicado" : post.status,
    });

    renderTudo();
    return voltar(reply, corpo.acao === "publicar" ? "Post publicado." : "Alterações salvas.");
  });

  for (const [rota, status] of [["publicar", "publicado"], ["rascunho", "rascunho"]]) {
    app.post(`${base}/admin/post/:slug/${rota}`, async (req, reply) => {
      const post = buscarPost(req.params.slug);
      if (!post) return reply.code(404).send("Post não encontrado.");

      salvarPost({ ...post, status });
      renderTudo();

      return voltar(reply, status === "publicado" ? "Post publicado." : "Post voltou para rascunho.");
    });
  }

  app.post(`${base}/admin/post/:slug/excluir`, async (req, reply) => {
    removerPost(req.params.slug);
    renderTudo();
    return voltar(reply, "Post excluído.");
  });
}
