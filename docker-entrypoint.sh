#!/bin/sh
# ==========================================================================
# O DATA_DIR é um volume montado de fora do container. O EasyPanel usa bind
# mount numa pasta do host criada como root, então o usuário node não
# conseguiria escrever nela — e sem escrita o servidor não sobe.
#
# Solução padrão: o container começa como root só para acertar a dona da
# pasta e imediatamente larga o privilégio. O node nunca roda como root.
# ==========================================================================
set -e

DIR="${DATA_DIR:-/app/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DIR"
  chown -R node:node "$DIR"
  exec su-exec node "$@"
fi

exec "$@"
