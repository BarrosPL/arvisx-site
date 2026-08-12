/* ==========================================================================
   Configuração — tudo vem de variável de ambiente, com padrão sensato.
   No EasyPanel essas chaves entram na aba "Environment" do serviço.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizServidor = path.resolve(aqui, "..");
const raizProjeto = path.resolve(raizServidor, "..");

/* Lê um .env simples (KEY=valor) sem depender do pacote dotenv.
   No Docker/EasyPanel as variáveis já chegam pelo ambiente e o arquivo nem
   existe — por isso a leitura é opcional. */
function carregarEnv() {
  const arquivo = path.join(raizServidor, ".env");
  if (!fs.existsSync(arquivo)) return;

  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;

    const corte = limpa.indexOf("=");
    if (corte < 0) continue;

    const chave = limpa.slice(0, corte).trim();
    let valor = limpa.slice(corte + 1).trim();
    if (/^".*"$/.test(valor) || /^'.*'$/.test(valor)) valor = valor.slice(1, -1);

    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}

carregarEnv();

function texto(chave, padrao) {
  const valor = process.env[chave];
  return valor === undefined || valor === "" ? padrao : valor;
}

function numero(chave, padrao) {
  const valor = Number(process.env[chave]);
  return Number.isFinite(valor) ? valor : padrao;
}

function booleano(chave, padrao) {
  const valor = texto(chave, null);
  if (valor === null) return padrao;
  return /^(1|true|sim|yes|on)$/i.test(valor);
}

/* BASE_PATH é o único que precisa aceitar valor vazio: num domínio próprio
   (arvisx.ai) o site fica na raiz, e "" é a resposta certa — não "não
   informado". Por isso não passa por texto(), que trata "" como ausente e
   devolveria o padrão. */
function basePath() {
  const bruto = process.env.BASE_PATH ?? "";
  const limpo = bruto.trim().replace(/\/+$/, "");
  return limpo === "/" ? "" : limpo;
}

export const config = {
  /* ------------------------------ servidor ------------------------------- */
  porta: numero("PORT", 3000),
  host: texto("HOST", "0.0.0.0"),

  /* Prefixo do caminho público.
     - num domínio ou subdomínio próprio, deixe VAZIO: o site é a raiz;
     - numa subpasta (exemplo.com/arvisx), ponha "/arvisx" e o servidor
       responde tanto em / quanto no prefixo, funcionando com o proxy
       removendo o prefixo ou não. */
  basePath: basePath(),

  /* URL pública completa, usada nas tags canonical, og: e no sitemap.
     Precisa bater com o endereço real, senão o Google indexa o errado. */
  siteUrl: texto("SITE_URL", "https://arvisx.ai").replace(/\/+$/, ""),

  /* ------------------------------- pastas -------------------------------- */
  /* Site estático versionado junto do código. */
  siteDir: path.resolve(texto("SITE_DIR", path.join(raizProjeto, "arvisx"))),

  /* Conteúdo gerado. No EasyPanel isto precisa ser um volume, senão os posts
     novos somem a cada redeploy. */
  dataDir: path.resolve(texto("DATA_DIR", path.join(raizServidor, "data"))),

  /* -------------------------------- admin -------------------------------- */
  adminUsuario: texto("ADMIN_USER", "arvisx"),
  adminSenha: texto("ADMIN_PASSWORD", ""),

  /* ------------------------------- OpenAI -------------------------------- */
  openaiKey: texto("OPENAI_API_KEY", ""),
  openaiModel: texto("OPENAI_MODEL", "gpt-4o"),
  openaiBaseUrl: texto("OPENAI_BASE_URL", "https://api.openai.com/v1"),

  /* ------------------------------- geração ------------------------------- */
  /* Cron do agendamento. Padrão: terça-feira às 9h. */
  cron: texto("CRON_AGENDA", "0 9 * * 2"),
  cronAtivo: booleano("CRON_ATIVO", true),
  fusoHorario: texto("TZ_AGENDA", "America/Sao_Paulo"),

  /* Com false (padrão) o post nasce como rascunho e espera aprovação no
     /admin. Com true ele já entra publicado. */
  autoPublicar: booleano("AUTO_PUBLICAR", false),

  /* ------------------------------- contato ------------------------------- */
  /* Se WHATSAPP estiver preenchido, as chamadas do blog abrem uma conversa
     com contexto. Vazio (padrão), elas caem no Instagram. */
  whatsapp: texto("WHATSAPP", ""),
  instagram: texto("INSTAGRAM", "https://instagram.com/arvisxai"),
  tiktok: texto("TIKTOK", "https://tiktok.com/@arvisxai"),
};

export const caminhos = {
  raizProjeto,
  raizServidor,
  /* Fonte da verdade de todo o blog. */
  posts: path.join(config.dataDir, "posts.json"),
  /* HTML gerado — servido com prioridade sobre o site estático. */
  blogGerado: path.join(config.dataDir, "blog"),
  /* Capas baixadas pelo pipeline. */
  imagensGeradas: path.join(config.dataDir, "img", "blog"),
  /* Seed: os posts que acompanham o repositório. */
  seed: path.join(raizServidor, "seed", "posts.json"),
  /* Blog estático que acompanha o repositório (fallback e leitura offline). */
  blogEstatico: path.join(config.siteDir, "blog"),
  imagensEstaticas: path.join(config.siteDir, "img", "blog"),
};
