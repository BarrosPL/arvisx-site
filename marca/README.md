# Material de origem da marca

Nada aqui é servido pelo site. O `Dockerfile` copia apenas `server/` e
`arvisx/`, então esta pasta fica de fora da imagem — ela existe para permitir
refazer os assets sem precisar caçar os arquivos originais de novo.

## `arvisx-brand-board.png`

O manual da marca ARVISX AI, em 1448×1086. É a fonte de tudo que está em
`arvisx/img/`: o logo horizontal, a versão compacta, o símbolo isolado e a
paleta. Os recortes usados no site saíram daqui.

| Região do board | Vira |
| --- | --- |
| Painel "LOGO HORIZONTAL" | `arvisx-logo.png` |
| Painel "SÍMBOLO" | `arvisx-simbolo.png` |
| Lockup grande do topo (só o wordmark) + símbolo | `arvisx-marca*.png` |
| Faixa "USO EM FUNDO ESCURO" | versões brancas |

## `arvisx-marca.png`, `arvisx-logo-branco.png`, `arvisx-simbolo*.png`

Variações da marca que o site não usa hoje. A navbar e o rodapé usam
`arvisx-marca-branca.png`, a faixa dourada usa `arvisx-marca-escura.png` e o
`arvisx-logo.png` aparece só nos dados estruturados — todas em
`arvisx/img/`. Estas ficaram aqui por serem úteis em peça gráfica, e por
serem a base de `img/blog/padrao.jpg` e de `img/og-arvisx.jpg`.

## `logos-originais/`

Os logos do ecossistema como chegaram, antes do tratamento. As versões que o
site usa estão em `arvisx/img/clientes/`, com fundo removido, margem aparada
e largura normalizada em 520px — e, no caso da Daiana e do Renan, repintadas
no dourado da família. O tratamento está descrito em
[`arvisx/img/CREDITOS.md`](../arvisx/img/CREDITOS.md).
