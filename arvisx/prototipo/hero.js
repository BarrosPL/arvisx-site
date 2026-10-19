/* ==========================================================================
   ARVISX AI — hero do protótipo: a onda de dados e o que a IA faz com ela.

   A base é sempre a mesma: um campo de pontos em perspectiva ondulando (os
   dados, em azul). Por cima, cada opção põe uma forma de "inteligência":

     onda    — só a onda, com uma frente dourada vindo do fundo
     orbe    — um orbe de IA flutuando; quando "fala", ondula a superfície
     rede    — uma rede neural: a onda dispara sinais, a rede processa, sai ouro
     varredura — um feixe analisa a onda e marca em dourado os pontos que
                 qualifica, como uma detecção

   Um seletor flutuante (só no protótipo) troca as opções; teclas 1–4 também.
   A escolha fica na URL (?hero=orbe). Movimento reduzido: quadro parado.
   ?movimento força o movimento numa máquina com ele desligado.
   ========================================================================== */

(function () {
  "use strict";

  var forcar = /[?&]movimento\b/.test(window.location.search);
  var semMovimento = !forcar && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hero = document.querySelector(".hero");
  var campo = document.querySelector(".hero-campo");
  var ancora = document.querySelector("[data-nucleo]");
  if (!hero || !campo || !ancora || !campo.getContext) return;

  var ctx = campo.getContext("2d");
  var AZUL = [78, 168, 255];
  var OURO = [212, 175, 55];
  var CLARO = [255, 241, 200];

  var W = 0;
  var H = 0;
  var caixa = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 };
  var textoFim = 0;
  var piso = 0;
  var celular = false;
  var ponteiro = { x: 0, y: 0, ativo: false };
  var mira = { x: 0, y: 0 };

  var medir = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var h = hero.getBoundingClientRect();
    var a = ancora.getBoundingClientRect();
    var texto = hero.querySelector(".hero-texto").getBoundingClientRect();
    var marcas = hero.querySelector(".marcas").getBoundingClientRect();

    W = h.width;
    H = h.height;
    campo.width = Math.round(W * dpr);
    campo.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    caixa.x = a.left - h.left;
    caixa.y = a.top - h.top;
    caixa.w = a.width;
    caixa.h = a.height;
    caixa.cx = caixa.x + caixa.w / 2;
    caixa.cy = caixa.y + caixa.h / 2;
    textoFim = texto.right - h.left;
    piso = marcas.top - h.top;
    celular = W < 1101;
  };

  var seguirPonteiro = function () {
    mira.x += ((ponteiro.ativo ? ponteiro.x : 0) - mira.x) * 0.05;
    mira.y += ((ponteiro.ativo ? ponteiro.y : 0) - mira.y) * 0.05;
  };

  var rgba = function (cor, a) {
    return "rgba(" + (cor[0] | 0) + ", " + (cor[1] | 0) + ", " + (cor[2] | 0) + ", " + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
  };

  var misturar = function (a, b, q) {
    return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
  };

  /* ================================ a onda ================================
     Campo de COLS × LINHAS pontos em perspectiva. `topoFrac` diz onde fica
     o horizonte dentro da área: as opções que põem algo acima da onda
     descem o horizonte para abrir espaço.

     Cada opção pode passar um `efeito` com:
       altura(x, z, t)  → deslocamento extra da superfície naquele ponto
       ponto(p)         → pode tingir (p.ouro, p.brilho) e anotar o ponto
     A onda devolve a geometria para a opção desenhar por cima. */

  var COLS = 64;
  var LINHAS = 26;
  var Z_PERTO = 1.25;
  var Z_FUNDO = 6.65;

  var geometria = function (topoFrac) {
    var esq = celular ? 0 : Math.max(0, textoFim - 120);
    var topo = celular ? caixa.y : caixa.y + caixa.h * 0.02;
    var base = celular ? caixa.y + caixa.h : piso - 8;
    var largura = W - esq;
    var horizonte = topo + (base - topo) * topoFrac;
    var camY = 1.05 + mira.y * 0.08;

    return {
      esq: esq,
      topo: topo,
      base: base,
      largura: largura,
      meio: esq + largura * (celular ? 0.5 : 0.56) + mira.x * 30,
      F: largura * (celular ? 0.5 : 0.42),
      horizonte: horizonte,
      camY: camY,
      Fv: ((base - 24 - horizonte) * Z_PERTO) / camY,
    };
  };

  var projetar = function (g, x, y, z) {
    return [g.meio + (x * g.F) / z, g.horizonte + ((g.camY - y) * g.Fv) / z];
  };

  var alturaBase = function (x, z, t) {
    return (
      0.17 * Math.sin(x * 1.25 + t * 0.85) +
      0.11 * Math.sin(z * 1.6 - t * 1.15) +
      0.06 * Math.sin((x - z) * 2.3 + t * 1.6)
    );
  };

  var colX = function (c) {
    return (c / (COLS - 1) - 0.5) * 7;
  };

  var linhaZ = function (r) {
    return Z_PERTO + r * ((Z_FUNDO - Z_PERTO) / LINHAS);
  };

  var p = { x: 0, z: 0, r: 0, c: 0, sx: 0, sy: 0, perto: 0, ouro: 0, brilho: 0 };

  var desenharOnda = function (t, g, efeito) {
    for (var r = LINHAS - 1; r >= 0; r--) {
      var z = linhaZ(r);
      var energiaLinha = 0;

      ctx.beginPath();
      for (var c = 0; c < COLS; c++) {
        var x = colX(c);
        var y = alturaBase(x, z, t) + (efeito && efeito.altura ? efeito.altura(x, z, t) : 0);
        var s = projetar(g, x, y, z);
        if (s[1] > g.base) continue;

        var some = celular ? 1 : Math.max(0, Math.min(1, (s[0] - g.esq) / 220));
        p.x = x; p.z = z; p.r = r; p.c = c;
        p.sx = s[0]; p.sy = s[1];
        p.perto = 1 / z;
        p.ouro = 0;
        p.brilho = 0;
        if (efeito && efeito.ponto) efeito.ponto(p, t);

        var alfa = (0.1 + p.perto * 0.75 + p.brilho * 0.6 + p.ouro * 0.5) * some;
        var tam = 0.7 + p.perto * 2.4 + p.ouro * 1.3 + p.brilho * 1.2;
        var cor = p.brilho > p.ouro ? misturar(AZUL, CLARO, p.brilho) : misturar(AZUL, OURO, p.ouro);
        ctx.fillStyle = rgba(cor, alfa);
        ctx.fillRect(s[0] - tam / 2, s[1] - tam / 2, tam, tam);
        energiaLinha = Math.max(energiaLinha, p.ouro * some);

        if (c === 0) ctx.moveTo(s[0], s[1]);
        else ctx.lineTo(s[0], s[1]);
      }
      ctx.strokeStyle = energiaLinha > 0.3 ? rgba(misturar(AZUL, OURO, 0.5), 0.05 + energiaLinha * 0.04) : rgba(AZUL, 0.05);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  /* ============================== 1. só a onda ============================= */

  var soOnda = {
    nome: "Onda",
    quadro: function (t) {
      seguirPonteiro();
      var g = geometria(0.12);
      var frente = 6.4 - ((t * 1.25) % 8);
      desenharOnda(t, g, {
        ponto: function (q) {
          q.ouro = Math.exp(-Math.pow(q.z - frente, 2) / 0.18);
        },
      });
    },
  };

  /* ============================== 2. orbe de IA =============================
     Um orbe de luz flutua sobre a onda, como um assistente de voz. Por
     dentro, três camadas de plasma (azul, ouro e um miolo claro) giram em
     sentidos diferentes. A cada "fala" ele pulsa e solta uma ondulação
     dourada que corre pela superfície. Embaixo dele, a onda fica iluminada. */

  var orbe = (function () {
    var ondas = [];
    var proxima = 0.4;
    var energia = 0;
    var CAMADAS = [
      { cor: AZUL, raio: 0.95, k: 3, vel: 0.9, fase: 0, alfa: 0.8 },
      { cor: [40, 90, 220], raio: 0.7, k: 2, vel: -0.7, fase: 3.3, alfa: 0.6 },
      { cor: OURO, raio: 0.72, k: 4, vel: -1.25, fase: 2.1, alfa: 0.85 },
      { cor: CLARO, raio: 0.26, k: 5, vel: 1.7, fase: 4.2, alfa: 0.3 },
    ];

    var chao = { x: 0.5, z: 2.7 };

    var desenharOrbe = function (cx, cy, R, t) {
      var halo = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 3.4);
      halo.addColorStop(0, rgba(OURO, 0.22 + energia * 0.2));
      halo.addColorStop(0.45, rgba(AZUL, 0.06));
      halo.addColorStop(1, rgba(AZUL, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(cx - R * 3.4, cy - R * 3.4, R * 6.8, R * 6.8);

      var fundo = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, 0, cx, cy, R);
      fundo.addColorStop(0, "#1b2232");
      fundo.addColorStop(1, "#090c12");
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = fundo;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";

      CAMADAS.forEach(function (L) {
        var ox = Math.cos(t * L.vel + L.fase) * R * 0.18;
        var oy = Math.sin(t * L.vel * 0.8 + L.fase) * R * 0.14;
        var rr = R * L.raio * (1 + energia * 0.15);
        ctx.beginPath();
        for (var i = 0; i <= 72; i++) {
          var th = (i / 72) * Math.PI * 2;
          var d = rr * (1 + 0.13 * Math.sin(L.k * th + t * L.vel * 1.4 + L.fase) + 0.06 * Math.sin((L.k + 2) * th - t * L.vel));
          var px = cx + ox + Math.cos(th) * d;
          var py = cy + oy + Math.sin(th) * d;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        var grad = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rr * 1.1);
        grad.addColorStop(0, rgba(L.cor, L.alfa * (0.8 + energia * 0.4)));
        grad.addColorStop(1, rgba(L.cor, 0));
        ctx.fillStyle = grad;
        ctx.fill();
      });

      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(OURO, 0.45 + energia * 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.86, Math.PI * 1.08, Math.PI * 1.45);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /* Anel fino girando, inclinado como as órbitas do símbolo. */
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * 1.55, R * 0.36, -0.2, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(OURO, 0.22);
      ctx.lineWidth = 1;
      ctx.stroke();
      var a = t * 0.9;
      var ex = Math.cos(a) * R * 1.55;
      var ey = Math.sin(a) * R * 0.36;
      ctx.beginPath();
      ctx.arc(cx + ex * Math.cos(-0.2) - ey * Math.sin(-0.2), cy + ex * Math.sin(-0.2) + ey * Math.cos(-0.2), 2.6, 0, Math.PI * 2);
      ctx.fillStyle = rgba(CLARO, 0.95);
      ctx.fill();
    };

    return {
      nome: "Onda + Orbe de IA",
      quadro: function (t) {
        seguirPonteiro();
        energia *= 0.95;

        if (t > proxima) {
          ondas.push(t);
          energia = 1;
          proxima = t + 2.4;
        }
        while (ondas.length && t - ondas[0] > 5.5) ondas.shift();

        var g = geometria(0.3);
        var cx0 = chao.x + mira.x * 0.5;
        var cz0 = chao.z;

        desenharOnda(t, g, {
          altura: function (x, z) {
            var d = Math.hypot(x - cx0, (z - cz0) * 1.2);
            var soma = 0;
            for (var i = 0; i < ondas.length; i++) {
              var idade = t - ondas[i];
              var raio = idade * 1.5;
              soma += 0.16 * Math.exp(-idade * 0.55) * Math.exp(-Math.pow(d - raio, 2) / 0.05);
            }
            return soma;
          },
          ponto: function (q) {
            var d = Math.hypot(q.x - cx0, (q.z - cz0) * 1.2);
            var luz = Math.exp(-(d * d) / 0.6) * 0.75;
            var anel = 0;
            for (var i = 0; i < ondas.length; i++) {
              var idade = t - ondas[i];
              anel = Math.max(anel, Math.exp(-idade * 0.5) * Math.exp(-Math.pow(d - idade * 1.5, 2) / 0.05));
            }
            q.ouro = Math.min(1, luz + anel);
          },
        });

        /* O orbe flutua acima do ponto do chão, com uma sombra de luz e um
           fio de luz até a superfície. */
        var flutua = Math.sin(t * 1.1) * 0.04;
        var noAr = projetar(g, cx0, 0.72 + flutua, cz0);
        var noChao = projetar(g, cx0, alturaBase(cx0, cz0, t), cz0);
        var R = Math.max(26, Math.min(caixa.w, caixa.h) * (celular ? 0.13 : 0.11));

        var feixe = ctx.createLinearGradient(0, noAr[1], 0, noChao[1]);
        feixe.addColorStop(0, rgba(OURO, 0.35));
        feixe.addColorStop(1, rgba(OURO, 0));
        ctx.fillStyle = feixe;
        ctx.fillRect(noAr[0] - 0.75, noAr[1], 1.5, noChao[1] - noAr[1]);

        var sombra = ctx.createRadialGradient(noChao[0], noChao[1], 0, noChao[0], noChao[1], R * 1.8);
        sombra.addColorStop(0, rgba(OURO, 0.18 + energia * 0.15));
        sombra.addColorStop(1, rgba(OURO, 0));
        ctx.save();
        ctx.translate(noChao[0], noChao[1]);
        ctx.scale(1, 0.32);
        ctx.translate(-noChao[0], -noChao[1]);
        ctx.fillStyle = sombra;
        ctx.beginPath();
        ctx.arc(noChao[0], noChao[1], R * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        desenharOrbe(noAr[0], noAr[1], R, t);
      },
    };
  })();

  /* ============================== 3. rede neural ============================
     Quatro camadas de neurônios acima da onda. Pontos da onda disparam
     sinais azuis para a primeira camada; cada neurônio que acende repassa
     para dois ou três da camada seguinte; na última, o sinal chega dourado.
     A cor de cada camada vai do azul (dado) ao ouro (decisão). */

  var rede = (function () {
    var CAMADAS = [7, 9, 7, 4];
    var nos = [];
    var sinais = [];
    var disparos = [];
    var proximo = 0;
    var ultimaArea = "";

    var corDaCamada = function (i) {
      return misturar(AZUL, OURO, i / (CAMADAS.length - 1));
    };

    var montar = function (g) {
      var esq = celular ? caixa.x + caixa.w * 0.06 : Math.max(g.esq + 170, caixa.x + caixa.w * 0.04);
      var dir = celular ? caixa.x + caixa.w * 0.94 : Math.min(W - 40, caixa.x + caixa.w * 1.02);
      var baixo = g.horizonte + 6;
      var alto = g.topo + (g.horizonte - g.topo) * 0.06;
      var area = [esq, dir, baixo, alto].map(Math.round).join(",");
      if (area === ultimaArea) return;
      ultimaArea = area;

      /* Cada camada é mais estreita que a de baixo: a rede é também um
         funil — muito dado entra, pouca decisão (dourada) sai. */
      var LARGURAS = [1, 0.8, 0.58, 0.34];
      var centro = (esq + dir) / 2;
      nos = CAMADAS.map(function (n, i) {
        var y = baixo - ((baixo - alto) * i) / (CAMADAS.length - 1);
        var meia = ((dir - esq) / 2) * 0.92 * LARGURAS[i];
        var lista = [];
        for (var k = 0; k < n; k++) {
          var q = n === 1 ? 0.5 : k / (n - 1);
          lista.push({ x: centro - meia + q * meia * 2, y: y, ativ: 0, fase: Math.random() * 6 });
        }
        return lista;
      });
      sinais = [];
    };

    var posicao = function (no, t) {
      return [no.x, no.y + Math.sin(t * 0.9 + no.fase) * 3];
    };

    var enviar = function (de, camada, alvo, t, atraso) {
      sinais.push({ de: de, camada: camada, alvo: alvo, nasceu: t + (atraso || 0), dura: 0.55 + Math.random() * 0.25 });
    };

    return {
      nome: "Onda + Rede neural",
      quadro: function (t) {
        seguirPonteiro();
        var g = geometria(0.5);
        montar(g);

        var candidatos = [];
        desenharOnda(t, g, {
          ponto: function (q) {
            for (var i = 0; i < disparos.length; i++) {
              var dsp = disparos[i];
              if (dsp.r === q.r && dsp.c === q.c) q.brilho = Math.max(0, 1 - (t - dsp.t) * 1.5);
            }
            if (q.r < 9 && q.c % 3 === 0 && q.sx > nos[0][0].x - 30 && q.sx < nos[0][nos[0].length - 1].x + 30) {
              candidatos.push({ r: q.r, c: q.c, sx: q.sx, sy: q.sy });
            }
          },
        });
        disparos = disparos.filter(function (d) { return t - d.t < 0.8; });

        if (t > proximo && candidatos.length && sinais.length < 70) {
          var origem = candidatos[(Math.random() * candidatos.length) | 0];
          var alvo = (Math.random() * CAMADAS[0]) | 0;
          disparos.push({ r: origem.r, c: origem.c, t: t });
          enviar([origem.sx, origem.sy], 0, alvo, t);
          proximo = t + 0.28 + Math.random() * 0.25;
        }

        /* Ligações: todas as de uma camada para a seguinte, bem apagadas. */
        ctx.lineWidth = 1;
        for (var i = 0; i < nos.length - 1; i++) {
          ctx.strokeStyle = rgba(misturar(corDaCamada(i), corDaCamada(i + 1), 0.5), 0.07);
          ctx.beginPath();
          for (var a = 0; a < nos[i].length; a++) {
            var pa = posicao(nos[i][a], t);
            for (var b = 0; b < nos[i + 1].length; b++) {
              var pb = posicao(nos[i + 1][b], t);
              ctx.moveTo(pa[0], pa[1]);
              ctx.lineTo(pb[0], pb[1]);
            }
          }
          ctx.stroke();
        }

        /* Sinais em trânsito: um traço curto com a ponta acesa. */
        for (var s = sinais.length - 1; s >= 0; s--) {
          var sinal = sinais[s];
          var k = (t - sinal.nasceu) / sinal.dura;
          if (k < 0) continue;
          var destino = nos[sinal.camada][sinal.alvo];
          var pd = posicao(destino, t);
          var po = sinal.de;

          if (k >= 1) {
            destino.ativ = 1;
            sinais.splice(s, 1);
            if (sinal.camada < CAMADAS.length - 1) {
              var saidas = 1 + ((Math.random() * 2.2) | 0);
              for (var n = 0; n < saidas; n++) {
                enviar(pd, sinal.camada + 1, (Math.random() * CAMADAS[sinal.camada + 1]) | 0, t, n * 0.06);
              }
            }
            continue;
          }

          var cor = misturar(corDaCamada(Math.max(0, sinal.camada - 1)), corDaCamada(sinal.camada), k);
          var cabeca = [po[0] + (pd[0] - po[0]) * k, po[1] + (pd[1] - po[1]) * k];
          var k0 = Math.max(0, k - 0.22);
          var cauda = [po[0] + (pd[0] - po[0]) * k0, po[1] + (pd[1] - po[1]) * k0];
          var grad = ctx.createLinearGradient(cauda[0], cauda[1], cabeca[0], cabeca[1]);
          grad.addColorStop(0, rgba(cor, 0));
          grad.addColorStop(1, rgba(cor, 0.95));
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(cauda[0], cauda[1]);
          ctx.lineTo(cabeca[0], cabeca[1]);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cabeca[0], cabeca[1], 1.8, 0, Math.PI * 2);
          ctx.fillStyle = rgba(misturar(cor, CLARO, 0.4), 1);
          ctx.fill();
        }

        /* Neurônios: anel fino, miolo que acende e um halo quando ativos. */
        for (var c = 0; c < nos.length; c++) {
          var corC = corDaCamada(c);
          for (var m = 0; m < nos[c].length; m++) {
            var no = nos[c][m];
            no.ativ *= 0.95;
            var pn = posicao(no, t);
            var raio = (celular ? 2.6 : 3.4) + no.ativ * 2.5;

            if (no.ativ > 0.05) {
              var halo = ctx.createRadialGradient(pn[0], pn[1], 0, pn[0], pn[1], raio * 5);
              halo.addColorStop(0, rgba(corC, 0.45 * no.ativ));
              halo.addColorStop(1, rgba(corC, 0));
              ctx.fillStyle = halo;
              ctx.fillRect(pn[0] - raio * 5, pn[1] - raio * 5, raio * 10, raio * 10);
            }

            ctx.beginPath();
            ctx.arc(pn[0], pn[1], raio, 0, Math.PI * 2);
            ctx.fillStyle = rgba(misturar([12, 16, 23], corC, 0.25 + no.ativ * 0.75), 1);
            ctx.fill();
            ctx.strokeStyle = rgba(corC, 0.5 + no.ativ * 0.5);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      },
    };
  })();

  /* =============================== 4. varredura =============================
     Um feixe atravessa a onda da esquerda para a direita. Por onde passa, a
     superfície acende; alguns pontos (sorteados de forma fixa) ficam
     dourados e ganham cantoneiras de detecção, ligados entre si por um fio.
     Ao recomeçar, as marcações se apagam. */

  var varredura = (function () {
    var CICLO = 6.2;
    var marcados = [];

    var escolhido = function (r, c) {
      var v = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
      return v - Math.floor(v) < 0.045 && r < 15;
    };

    var cantoneira = function (x, y, s, alfa) {
      var l = s * 0.42;
      ctx.strokeStyle = rgba(OURO, alfa);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s + l); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s + l, y - s);
      ctx.moveTo(x + s - l, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - s + l);
      ctx.moveTo(x + s, y + s - l); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - l, y + s);
      ctx.moveTo(x - s + l, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + s - l);
      ctx.stroke();
    };

    return {
      nome: "Onda + Varredura",
      quadro: function (t) {
        seguirPonteiro();
        var g = geometria(0.12);
        var fase = (t % CICLO) / CICLO;
        var xs = -3.8 + fase * 7.6;
        marcados = [];

        desenharOnda(t, g, {
          ponto: function (q) {
            var dx = q.x - xs;
            if (Math.abs(dx) < 0.16) q.brilho = 1 - Math.abs(dx) / 0.16;
            else if (dx < 0 && dx > -0.9) q.brilho = Math.max(q.brilho, 0.25 * (1 + dx / 0.9));

            if (escolhido(q.r, q.c) && dx < 0) {
              q.ouro = 1;
              var some = celular ? 1 : Math.max(0, Math.min(1, (q.sx - g.esq) / 220));
              if (some > 0.5) marcados.push({ x: q.sx, y: q.sy, perto: q.perto, idade: -dx, c: q.c });
            }
          },
        });

        /* O feixe: a linha de luz sobre a superfície, mais uma cortina que
           sobe dela. */
        var trilha = [];
        for (var r = 0; r < LINHAS; r++) {
          var z = linhaZ(r);
          var s = projetar(g, xs, alturaBase(xs, z, t), z);
          if (s[1] <= g.base) trilha.push(s);
        }
        if (trilha.length > 1) {
          for (var i = 0; i < trilha.length; i++) {
            var pt = trilha[i];
            var alto = 46 * (1 - i / trilha.length) + 10;
            var cortina = ctx.createLinearGradient(0, pt[1] - alto, 0, pt[1]);
            cortina.addColorStop(0, "rgba(160, 205, 255, 0)");
            cortina.addColorStop(1, "rgba(160, 205, 255, 0.10)");
            ctx.fillStyle = cortina;
            ctx.fillRect(pt[0] - 3, pt[1] - alto, 6, alto);
          }
          ctx.beginPath();
          ctx.moveTo(trilha[0][0], trilha[0][1]);
          for (var j = 1; j < trilha.length; j++) ctx.lineTo(trilha[j][0], trilha[j][1]);
          ctx.strokeStyle = "rgba(200, 228, 255, 0.85)";
          ctx.lineWidth = 1.4;
          ctx.shadowColor = "rgba(78, 168, 255, 0.9)";
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        /* Marcações: o fio liga os pontos na ordem em que foram achados; as
           cantoneiras nascem grandes e fecham sobre o ponto. */
        ctx.beginPath();
        for (var k = 0; k < marcados.length; k++) {
          var perto = null;
          var melhor = 170;
          for (var k2 = k + 1; k2 < marcados.length; k2++) {
            var d = Math.hypot(marcados[k].x - marcados[k2].x, marcados[k].y - marcados[k2].y);
            if (d < melhor) { melhor = d; perto = marcados[k2]; }
          }
          if (perto) {
            ctx.moveTo(marcados[k].x, marcados[k].y);
            ctx.lineTo(perto.x, perto.y);
          }
        }
        ctx.strokeStyle = rgba(OURO, 0.3);
        ctx.lineWidth = 1;
        ctx.stroke();

        marcados.forEach(function (m) {
          var fecha = Math.min(1, m.idade / 0.5);
          var tam = (5 + m.perto * 10) * (1.8 - 0.8 * fecha);
          cantoneira(m.x, m.y, tam, 0.35 + 0.55 * fecha);
        });
      },
    };
  })();

  /* ============================== motor e seletor ============================ */

  var MODOS = { onda: soOnda, orbe: orbe, rede: rede, varredura: varredura };
  var ORDEM = ["onda", "orbe", "rede", "varredura"];

  var atual = null;
  var nomeAtual = "";
  var rodando = false;
  var heroVisivel = true;
  var inicio = performance.now();

  var limpar = function () {
    ctx.clearRect(0, 0, W, H);
  };

  var quadro = function (agora) {
    if (!atual || !heroVisivel || document.hidden) {
      rodando = false;
      return;
    }
    limpar();
    atual.quadro((agora - inicio) / 1000);
    window.requestAnimationFrame(quadro);
  };

  var ligar = function () {
    if (rodando || semMovimento || !atual) return;
    rodando = true;
    window.requestAnimationFrame(quadro);
  };

  /* Sem movimento: roda alguns segundos de simulação de uma vez e mostra o
     último quadro, para a figura aparecer já "trabalhando". */
  var congelar = function () {
    if (!atual) return;
    for (var k = 0; k <= 90; k++) {
      limpar();
      atual.quadro(3 + k * 0.033);
    }
  };

  var botoes = [];

  var trocar = function (nome) {
    if (!MODOS[nome] || nome === nomeAtual) return;
    nomeAtual = nome;
    atual = MODOS[nome];
    ancora.dataset.modo = nome;
    inicio = performance.now();
    limpar();

    botoes.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.modo === nome));
    });

    var busca = window.location.search.replace(/[?&]hero=[^&]*/g, "").replace(/^&/, "?");
    var junta = busca ? busca + "&" : "?";
    window.history.replaceState(null, "", window.location.pathname + junta + "hero=" + nome + window.location.hash);

    if (semMovimento) congelar();
    else ligar();
  };

  var seletor = document.createElement("div");
  seletor.className = "seletor-prototipo";
  seletor.setAttribute("role", "group");
  seletor.setAttribute("aria-label", "Opções de animação da hero (protótipo)");
  seletor.innerHTML = "<span>Hero</span>";
  ORDEM.forEach(function (nome, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.dataset.modo = nome;
    b.innerHTML = "<b>" + (i + 1) + "</b> " + MODOS[nome].nome;
    b.addEventListener("click", function () { trocar(nome); });
    seletor.appendChild(b);
    botoes.push(b);
  });
  document.body.appendChild(seletor);

  document.addEventListener("keydown", function (evento) {
    var n = parseInt(evento.key, 10);
    if (n >= 1 && n <= ORDEM.length) trocar(ORDEM[n - 1]);
  });

  var preparar = function () {
    medir();
    if (semMovimento) congelar();
  };

  hero.addEventListener("pointermove", function (evento) {
    var a = ancora.getBoundingClientRect();
    ponteiro.x = Math.max(-1, Math.min(1, (evento.clientX - (a.left + a.width / 2)) / (a.width / 2 || 1)));
    ponteiro.y = Math.max(-1, Math.min(1, (evento.clientY - (a.top + a.height / 2)) / (a.height / 2 || 1)));
    ponteiro.ativo = true;
  });

  hero.addEventListener("pointerleave", function () {
    ponteiro.ativo = false;
  });

  medir();
  if ("ResizeObserver" in window) new ResizeObserver(preparar).observe(hero);
  else window.addEventListener("resize", preparar);

  if (!semMovimento) {
    new IntersectionObserver(function (e) {
      heroVisivel = e[0].isIntersecting;
      if (heroVisivel) ligar();
    }).observe(hero);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) ligar();
    });
  }

  var pedido = new URLSearchParams(window.location.search).get("hero");
  trocar(MODOS[pedido] ? pedido : "rede");
})();
