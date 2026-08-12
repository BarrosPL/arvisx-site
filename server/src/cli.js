/* ==========================================================================
   CLI — as mesmas operações do painel, pela linha de comando.

     npm run gerar        cria um post (rascunho, salvo AUTO_PUBLICAR=true)
     npm run publicar     cria um post já publicado
     npm run render       regera o HTML no DATA_DIR (o que o servidor entrega)
     npm run render:site  regera também arvisx/blog/, a cópia que fica no
                          repositório e permite abrir o site sem servidor

   Útil para testar a integração antes de subir e para rodar o pipeline por
   um cron externo, se um dia o agendamento sair de dentro do processo.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";

import { caminhos } from "./config.js";
import { gerarPost } from "./pipeline.js";
import { renderTudo } from "./render.js";

/* Traz para o repositório as capas que o pipeline baixou no DATA_DIR, para
   a cópia estática do blog não ficar com imagem faltando. */
function copiarCapas() {
  if (!fs.existsSync(caminhos.imagensGeradas)) return 0;

  fs.mkdirSync(caminhos.imagensEstaticas, { recursive: true });
  let copiadas = 0;

  for (const arquivo of fs.readdirSync(caminhos.imagensGeradas)) {
    const destino = path.join(caminhos.imagensEstaticas, arquivo);
    if (!fs.existsSync(destino)) {
      fs.copyFileSync(path.join(caminhos.imagensGeradas, arquivo), destino);
      copiadas++;
    }
  }

  return copiadas;
}

const comando = process.argv[2];

try {
  if (comando === "render") {
    const total = renderTudo();
    console.log(`ok — ${total} posts gerados em ${caminhos.blogGerado}`);
  } else if (comando === "render-site") {
    const total = renderTudo(caminhos.blogEstatico);
    const capas = copiarCapas();
    console.log(`ok — ${total} posts gerados em ${caminhos.blogEstatico}`);
    if (capas) console.log(`     ${capas} capas copiadas para ${caminhos.imagensEstaticas}`);
  } else if (comando === "gerar" || comando === "publicar") {
    const post = await gerarPost({ publicar: comando === "publicar" });
    console.log(`ok — "${post.titulo}" (${post.status})`);
    console.log(`     blog/${post.slug}.html`);
  } else {
    console.log("uso: node src/cli.js [gerar|publicar|render|render-site]");
    process.exit(1);
  }
} catch (erro) {
  console.error(`erro: ${erro.message}`);
  process.exit(1);
}
