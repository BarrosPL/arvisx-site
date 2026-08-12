# ARVISX AI — site e blog automático

Site institucional da ARVISX AI mais um blog que se escreve sozinho: uma vez
por semana o servidor coleta pautas no Google News, pede um texto original à
OpenAI e guarda o resultado como **rascunho** até alguém aprovar no `/admin`.

Nada é montado por requisição. O blog é gerado como HTML estático e apenas
entregue — o site continua tão rápido quanto as páginas escritas à mão.

---

## O que tem aqui

```
arvisx/                    site estático — é isto que vai para o ar
  index.html               home
  funil.html               Guia de Funil de Vendas
  css/style.css            identidade, componentes e a home
  css/blog.css             índice do blog, artigo e o guia
  js/main.js               menu, navbar, revelar ao rolar, esteiras
  js/blog.js               filtro de categorias e sumário do artigo
  img/                     marca, arte da hero, ícones
  img/clientes/            logos do ecossistema
  img/blog/                capas dos posts (padrao.jpg é o fallback)
  blog/                    cópia estática do blog (gerada — não editar à mão)

server/                    servidor e gerador
  src/index.js             Fastify: estáticos, /admin, cron, /healthz
  src/config.js            todas as variáveis de ambiente
  src/store.js             posts.json — leitura, escrita e normalização
  src/render.js            posts → HTML, feed.xml e sitemap.xml
  src/pipeline.js          pauta → texto → capa → post salvo
  src/openai.js            a chamada de redação
  src/sources/news.js      pautas do Google News
  src/sources/commons.js   capas do Wikimedia Commons, com autor e licença
  src/admin.js             painel de aprovação
  src/cli.js               as mesmas operações pela linha de comando
  seed/posts.json          os posts que acompanham o repositório

marca/                     material de origem — não vai para a imagem
  arvisx-brand-board.png   o manual da marca, fonte dos assets
  logos-originais/         logos do ecossistema antes do tratamento

Dockerfile                 imagem única com site + servidor
docker-compose.yml         para rodar local do jeito que roda na VPS
DEPLOY.md                  passo a passo do EasyPanel
```

---

## Rodar na sua máquina

Requer Node 20 ou mais novo.

```bash
cd server
npm install
cp .env.example .env      # e preencha ADMIN_PASSWORD e OPENAI_API_KEY
npm start
```

O site sobe em `http://localhost:3000`, o blog em `/blog/` e o painel em
`/admin`.

Para só olhar o site, sem servidor, abra `arvisx/index.html` no navegador —
a cópia estática do blog em `arvisx/blog/` funciona junto.

---

## Comandos

| Comando              | O que faz                                                        |
| -------------------- | ---------------------------------------------------------------- |
| `npm start`          | sobe o servidor e o agendamento semanal                           |
| `npm run dev`        | o mesmo, reiniciando a cada alteração                             |
| `npm run gerar`      | gera um post agora, como rascunho                                 |
| `npm run publicar`   | gera um post agora, já publicado                                  |
| `npm run render`     | regera o HTML no `DATA_DIR` (o que o servidor entrega)            |
| `npm run render:site`| regera também `arvisx/blog/`, a cópia versionada no repositório   |

Mexeu no CSS, no `render.js` ou no `seed/posts.json`? Rode
`npm run render:site` para a cópia do repositório acompanhar. O servidor já
regera sozinho a cada boot.

---

## Como o blog funciona

1. **Pauta.** `sources/news.js` consulta o RSS do Google News em oito temas
   (IA em vendas, CRM, automação, WhatsApp, tráfego, conteúdo, dados). Pautas
   que repetem assunto de um post existente são descartadas.
2. **Redação.** `openai.js` manda as pautas e os títulos já publicados, e
   pede um texto **original** em JSON, mais um termo de busca em inglês para
   a capa. A notícia é só pauta: o prompt proíbe copiar frase, inventar
   estatística e prometer resultado.
3. **Capa.** `sources/commons.js` busca a foto no Wikimedia Commons e grava
   autor e licença junto do post — a maioria é CC BY-SA e exige crédito, que
   aparece no rodapé do artigo. Sem foto adequada, cai em `padrao.jpg`, uma
   imagem de marca que acompanha o site.
4. **Gravação.** O post entra em `posts.json` como `rascunho`
   (ou `publicado`, se `AUTO_PUBLICAR=true`).
5. **Render.** Todo o blog é regerado: uma página por post, o índice, o
   `feed.xml` e o `sitemap.xml`.
6. **Aprovação.** No `/admin` você lê, edita e publica.

O padrão é rascunho de propósito. Conteúdo gerado em massa sem curadoria é
penalizado pela busca, e a revisão custa dois minutos por semana.

### Sobre as capas

O Commons é um acervo documental, não um banco de imagens comerciais: busca
por tema corporativo devolve pouco, e o que devolve costuma ser datado. A
saída foi orientar o prompt a acrescentar a palavra **"Unsplash"** ao termo
quando a cena for genérica de escritório, tecnologia ou negócios — isso
alcança o acervo de fotos modernas espelhado no Commons, quase todo em CC0.

Se uma capa não agradar, troque o arquivo em `DATA_DIR/img/blog/<slug>.jpg`
e rode **Regerar HTML** no painel. O nome do arquivo é o slug do post.

### Escrever um post à mão

Acrescente o objeto em `server/seed/posts.json` (ou edite direto pelo
`/admin`) e rode `npm run render:site`. No corpo, cada bloco é um objeto:

```json
{ "tipo": "p",  "texto": "um parágrafo" }
{ "tipo": "h2", "texto": "um subtítulo — vira seção e entra no sumário" }
{ "tipo": "ul", "itens": ["primeiro item", "segundo item"] }
```

No `/admin` o mesmo corpo aparece como texto simples: linha em branco separa
parágrafos, `## ` vira subtítulo e `- ` vira item de lista.

---

## Trocar imagens e marca

Tudo mora em `arvisx/img/`:

- `hero-fundo.jpg` — a foto de fundo da hero. Para trocar, sobrescreva o
  arquivo com algo em paisagem larga (o site usa 2400×1500) e escuro. O
  contraste do texto não depende da foto: quem garante é o `.hero-veu`, um
  degradê navy aplicado por cima no CSS. Crédito em
  [img/CREDITOS.md](arvisx/img/CREDITOS.md).
- `arvisx-marca-branca.png` — a marca na navbar e no rodapé.
  `arvisx-marca-escura.png` é a mesma em versão chapada, para a faixa
  dourada. `arvisx-logo.png` é o lockup completo, usado só nos dados
  estruturados.
- `og-arvisx.jpg` — a imagem de compartilhamento das páginas sem capa
  própria.
- `blog/*.jpg` — as capas dos posts, uma por slug, mais `padrao.jpg`.
- `clientes/*.png` — os logos do ecossistema já tratados: fundo branco
  removido, margem aparada e largura normalizada.

Tudo em `arvisx/img/` é servido ao navegador. O material de origem — o
manual da marca, as variações que o site não usa e os logos do ecossistema
antes do tratamento — fica em [`marca/`](marca/), fora da imagem Docker.

Para acrescentar uma marca ao ecossistema: ponha o PNG em `img/clientes/`
e adicione um `.client-card` em `index.html` e um `<li>` na esteira da hero.
Quem não tem logo entra como `<strong>Nome da marca</strong>` — o CSS trata
os dois casos.

---

## Variáveis de ambiente

Todas estão documentadas em `server/.env.example`. As que importam:

| Variável          | Para que serve                                                   |
| ----------------- | ---------------------------------------------------------------- |
| `SITE_URL`        | endereço público real — vai no canonical, no og: e no sitemap     |
| `DATA_DIR`        | onde ficam `posts.json`, o HTML e as capas. **Precisa ser volume** |
| `ADMIN_PASSWORD`  | sem ela o `/admin` fica bloqueado                                 |
| `OPENAI_API_KEY`  | sem ela a geração falha (o site continua no ar)                   |
| `CRON_AGENDA`     | quando gerar. Padrão: terça, 9h de Brasília                       |
| `AUTO_PUBLICAR`   | `false` (padrão) = nasce rascunho                                 |
| `WHATSAPP`        | preenchido, as chamadas do blog abrem o WhatsApp com contexto     |
| `BASE_PATH`       | vazio num domínio próprio; `/arvisx` se o site ficar numa subpasta |

---

## Publicar

Veja o [DEPLOY.md](DEPLOY.md). Resumo: é uma imagem Docker só, com um volume
em `/app/data`.
