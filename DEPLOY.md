# Publicar a ARVISX AI

O projeto inteiro cabe em **uma imagem Docker**: o site estático e o servidor
do blog no mesmo container. Não há etapa de build de front-end, nem banco de
dados, nem dependência nativa.

A única coisa que precisa de atenção é o **volume**. Todo o conteúdo gerado
pela IA vive em `DATA_DIR` — `posts.json`, o HTML e as capas baixadas do
Commons. Sem volume, cada redeploy apaga os posts e as imagens.

---

## 1. EasyPanel (recomendado)

### Criar o serviço

1. **Create → App**, apontando para o repositório.
2. Em **Build**, escolha `Dockerfile` (a raiz do repositório já tem um).
3. Em **Domains**, aponte o domínio e deixe o EasyPanel emitir o certificado.
   A porta do container é `3000`.

### Volume (o passo que não pode ser pulado)

Em **Volumes**, adicione:

| Campo       | Valor       |
| ----------- | ----------- |
| Tipo        | **Volume**  |
| Nome        | `arvisx-data` |
| Mount path  | `/app/data` |

Use **Volume**, não Bind Mount. Bind Mount cria a pasta no host como root e o
processo (que roda como `node`) não consegue escrever nela. Se ainda assim
precisar de bind mount, rode antes no host:

```bash
chown -R 1000:1000 /caminho/da/pasta
```

O servidor checa a permissão no boot e falha com uma mensagem explícita em
vez de subir quebrado.

### Environment

```
SITE_URL=https://arvisx.ai
BASE_PATH=
DATA_DIR=/app/data

ADMIN_USER=arvisx
ADMIN_PASSWORD=<uma senha longa>

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

CRON_AGENDA=0 9 * * 2
CRON_ATIVO=true
TZ_AGENDA=America/Sao_Paulo
AUTO_PUBLICAR=false

INSTAGRAM=https://instagram.com/arvisxai
TIKTOK=https://tiktok.com/@arvisxai
WHATSAPP=
```

`SITE_URL` precisa bater com o endereço real. Ele vai nas tags `canonical`,
`og:` e no `sitemap.xml` — errado, o Google indexa o endereço errado.

### Deploy

Clique em **Deploy**. O healthcheck bate em `/healthz`; quando ficar verde,
o site está no ar.

---

## 2. Docker Compose (VPS sem painel)

```bash
export ADMIN_PASSWORD='uma senha longa'
export OPENAI_API_KEY='sk-...'

docker compose up -d --build
```

Sobe em `http://SEU-IP:3000`. Ponha um Nginx ou Caddy na frente para o
domínio e o HTTPS. O `docker-compose.yml` já declara o volume nomeado.

---

## 3. Só o site, sem blog automático

Se por enquanto você quer apenas as páginas no ar, a pasta `arvisx/` é HTML
puro: sirva ela em qualquer hospedagem estática (Netlify, Vercel, Cloudflare
Pages, S3, um Nginx). O blog em `arvisx/blog/` já vem gerado e funciona —
só não se atualiza sozinho.

Para gerar posts novos nesse cenário, rode `npm run render:site` na sua
máquina e publique a pasta de novo.

---

## Depois de subir

### Conferir

- `https://SEU-DOMINIO/` — a home
- `https://SEU-DOMINIO/blog/` — o índice, com os posts que vieram no seed
- `https://SEU-DOMINIO/admin` — pede usuário e senha
- `https://SEU-DOMINIO/healthz` — deve responder `{"ok":true,"posts":6}`

### Testar a geração antes de esperar a terça

No `/admin`, clique em **Gerar post agora**. Em cerca de meio minuto o post
aparece em "Aguardando aprovação". Se der erro, a mensagem vermelha diz o
motivo — quase sempre chave da OpenAI ausente, sem crédito ou modelo que a
conta não tem.

### Registrar o sitemap

No Google Search Console, envie:

```
https://SEU-DOMINIO/blog/sitemap.xml
```

O `robots.txt` é servido pelo próprio servidor e já aponta para ele, além de
bloquear o `/admin`.

---

## Manutenção

**Backup.** O texto é um arquivo só; as capas, uma pasta:

```bash
docker compose cp arvisx:/app/data/posts.json ./backup-posts.json
docker compose cp arvisx:/app/data/img/blog ./backup-capas
```

Restaurar é copiar de volta e reiniciar — o servidor detecta o `posts.json`
novo pelo mtime e regera o HTML.

**Trocar a capa de um post.** Substitua `/app/data/img/blog/<slug>.jpg` e
clique em **Regerar HTML** no painel. O nome do arquivo é sempre o slug.

**Mudou o CSS ou o `render.js`?** O HTML é regerado a cada boot, então um
redeploy basta. Sem redeploy, use **Regerar HTML** no painel.

**Desligar a geração temporariamente.** `CRON_ATIVO=false`. O site continua
no ar normalmente; só nenhum post novo é criado.

---

## Se algo der errado

| Sintoma                              | Causa provável                                                        |
| ------------------------------------ | --------------------------------------------------------------------- |
| Container reinicia em laço no boot   | `DATA_DIR` sem permissão de escrita — veja a seção do volume           |
| Posts somem a cada deploy            | Falta o volume em `/app/data`                                          |
| `/admin` responde 503                | `ADMIN_PASSWORD` vazia                                                 |
| "Não deu para gerar"                 | Chave da OpenAI ausente, sem crédito, ou modelo indisponível na conta  |
| "as pautas repetem assuntos"         | Semana sem notícia nova no tema; tente de novo ou escreva um post à mão |
| Links do blog apontam para o domínio errado | `SITE_URL` diferente do endereço real                           |
