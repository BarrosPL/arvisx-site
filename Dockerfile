# ==========================================================================
# ARVISX AI — imagem única com o site estático e o servidor do blog.
# Sem etapa de build: o site é HTML/CSS/JS puro e o servidor não tem
# dependência nativa, então a imagem sai pequena e sobe rápido.
# ==========================================================================

FROM node:20-alpine

# su-exec larga o privilégio de root no entrypoint.
RUN apk add --no-cache su-exec

ENV NODE_ENV=production
WORKDIR /app

# As dependências primeiro, para o cache de camadas só quebrar quando o
# package.json mudar.
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Código do servidor, seed dos posts e o site.
COPY server/src ./server/src
COPY server/seed ./server/seed
COPY arvisx ./arvisx

# Conteúdo gerado. Precisa ser um VOLUME no EasyPanel — sem isso os posts
# criados pela IA somem a cada redeploy.
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data && chown -R node:node /app/data

ENV PORT=3000
EXPOSE 3000

# O container sobe como root apenas para o entrypoint acertar a dona do
# volume; ele troca para o usuário node antes de executar o CMD.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null || exit 1

WORKDIR /app/server
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
