/* ==========================================================================
   ARVISX AI — opções de animação da hero (protótipo).

   Quatro propostas que ocupam a coluna da direita da hero, trocadas por um
   seletor flutuante que só existe no protótipo:

     funil  — quadro de CRM com cartões de lead andando sozinhos pelas etapas
     elo    — os dois anéis entrelaçados do símbolo, em 3D, feitos de pontos
     globo  — esfera de pontos com arcos de conexão (azul sai, dourado chega)
     onda   — campo de pontos em perspectiva ondulando, com pulsos dourados

   A escolhida fica na URL (?hero=elo) para dar para mandar o link.
   Movimento reduzido: cada opção desenha um quadro parado. ?movimento força.
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
  var AZUL = "78, 168, 255";
  var OURO = "212, 175, 55";

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

  var sorteio = function (min, max) {
    return min + Math.random() * (max - min);
  };

  /* O ponteiro vira um desvio suave (-1 a 1) em relação ao centro da
     figura; as opções 3D usam isso para girar na direção do mouse. */
  var seguirPonteiro = function () {
    var alvoX = ponteiro.ativo ? ponteiro.x : 0;
    var alvoY = ponteiro.ativo ? ponteiro.y : 0;
    mira.x += (alvoX - mira.x) * 0.05;
    mira.y += (alvoY - mira.y) * 0.05;
  };

  /* ================================ funil =================================
     Um quadro de CRM em HTML: quatro colunas com as etapas do fluxo e
     cartões de lead que avançam sozinhos. Na coluna da IA o cartão ganha o
     selo e o brilho; na última, fica dourado e sai. As colunas usam os nomes
     de etapa que já existem no quadro ARVISX FLOW da página. */

  var funil = (function () {
    var COLUNAS = ["WhatsApp & Instagram", "IA de Qualificação", "SDR & Agendamento", "Proposta & Follow-up"];
    var ESTADOS = ["", "qualificado", "agendado", "ganho"];
    var MAX = 3;

    var ICONES = {
      whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.9-.4L3 21l1.6-4.6A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>',
      instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5.2"/><circle cx="12" cy="12" r="4.1"/></svg>',
    };

    var raiz = null;
    var listas = [];
    var tempo = null;
    var visivel = true;
    var observador = null;

    var novoCartao = function (estado) {
      var el = document.createElement("div");
      var canal = Math.random() < 0.55 ? "whatsapp" : "instagram";
      el.className = "qc-cartao";
      el.innerHTML =
        '<span class="qc-canal ' + canal + '">' + ICONES[canal] + "</span>" +
        '<span class="qc-linhas"><i style="width:' + Math.round(sorteio(55, 92)) + '%"></i>' +
        '<i style="width:' + Math.round(sorteio(28, 62)) + '%"></i></span>' +
        '<b class="qc-selo">IA</b>';
      if (estado) el.classList.add(estado);
      return el;
    };

    /* FLIP: mede todos os cartões antes da mudança, aplica a mudança e
       anima cada um do lugar antigo para o novo. Assim os vizinhos também
       deslizam, em vez de pular. */
    var comFlip = function (mudar) {
      var antes = new Map();
      raiz.querySelectorAll(".qc-cartao").forEach(function (c) {
        antes.set(c, c.getBoundingClientRect());
      });
      mudar();
      raiz.querySelectorAll(".qc-cartao").forEach(function (c) {
        var a = antes.get(c);
        if (!a || !c.animate) return;
        var d = c.getBoundingClientRect();
        var dx = a.left - d.left;
        var dy = a.top - d.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        c.animate(
          [{ transform: "translate(" + dx + "px, " + dy + "px)" }, { transform: "translate(0, 0)" }],
          { duration: 700, easing: "cubic-bezier(0.6, 0, 0.2, 1)" },
        );
      });
    };

    var tique = function () {
      if (!visivel || document.hidden) return;

      var ultima = listas[COLUNAS.length - 1];
      if (ultima.children.length >= MAX) {
        var saindo = ultima.lastElementChild;
        saindo.classList.add("saindo");
        window.setTimeout(function () {
          comFlip(function () { saindo.remove(); });
        }, 450);
        return;
      }

      /* Avança o cartão mais antigo de uma coluna que tenha vaga à frente.
         Colunas mais adiantadas têm preferência: o funil esvazia de trás
         para a frente, como numa operação de verdade. */
      var candidatas = [];
      for (var c = COLUNAS.length - 2; c >= 0; c--) {
        if (listas[c].children.length && listas[c + 1].children.length < MAX) candidatas.push(c);
      }

      comFlip(function () {
        if (candidatas.length) {
          var col = Math.random() < 0.6 ? candidatas[0] : candidatas[(Math.random() * candidatas.length) | 0];
          var cartao = listas[col].lastElementChild;
          ESTADOS.forEach(function (e) { if (e) cartao.classList.remove(e); });
          cartao.classList.add(ESTADOS[col + 1]);
          listas[col + 1].prepend(cartao);
        }

        if (listas[0].children.length < MAX && Math.random() < 0.7) {
          var novo = novoCartao("");
          novo.classList.add("entrando");
          listas[0].prepend(novo);
          window.setTimeout(function () { novo.classList.remove("entrando"); }, 50);
        }
      });
    };

    return {
      nome: "Funil vivo",
      montar: function () {
        raiz = document.createElement("div");
        raiz.className = "quadro-crm";
        raiz.innerHTML =
          '<div class="qc-topo"><span>ARVISX FLOW / 01</span><b>OPERAÇÃO ATIVA <i></i></b></div>' +
          '<div class="qc-colunas">' +
          COLUNAS.map(function (nome, i) {
            return '<div class="qc-coluna" data-col="' + i + '"><p>' + nome.replace("&", "&amp;") + '</p><div class="qc-lista"></div></div>';
          }).join("") +
          "</div>";
        ancora.appendChild(raiz);
        listas = Array.prototype.slice.call(raiz.querySelectorAll(".qc-lista"));

        [[2, ""], [2, "qualificado"], [1, "agendado"], [1, "ganho"]].forEach(function (par, i) {
          for (var k = 0; k < par[0]; k++) listas[i].appendChild(novoCartao(par[1]));
        });

        if (!semMovimento) {
          observador = new IntersectionObserver(function (e) { visivel = e[0].isIntersecting; });
          observador.observe(raiz);
          tempo = window.setInterval(tique, 1150);
        }
      },
      desmontar: function () {
        window.clearInterval(tempo);
        if (observador) observador.disconnect();
        if (raiz) raiz.remove();
        raiz = null;
      },
    };
  })();

  /* ================================= elo ==================================
     Os dois anéis do símbolo como um elo de corrente em 3D: cada anel é
     uma nuvem de pontos sobre um toro, e os dois se atravessam. Uma faixa
     de luz corre por cada anel. Gira devagar e inclina na direção do mouse. */

  var elo = (function () {
    var pontos = [];
    var giro = { y: 0.6, x: -0.5 };

    var montarPontos = function () {
      var N = 2200;
      for (var anel = 0; anel < 2; anel++) {
        for (var i = 0; i < N; i++) {
          var u = (i / N) * Math.PI * 2 + sorteio(-0.004, 0.004);
          var v = Math.random() * Math.PI * 2;
          var raio = 1 + 0.045 * Math.cos(v);
          var px = raio * Math.cos(u);
          var py = raio * Math.sin(u);
          var pz = 0.045 * Math.sin(v);
          /* Anel 0 no plano XY, à esquerda; anel 1 girado 90° em X, à
             direita. O anel 1 fura o disco do anel 0 uma vez: estão presos. */
          if (anel === 0) pontos.push({ x: px - 0.5, y: py, z: pz, u: u, anel: 0 });
          else pontos.push({ x: px + 0.5, y: -pz, z: py, u: u, anel: 1 });
        }
      }
    };

    return {
      nome: "Elo 3D",
      iniciar: function () {
        if (!pontos.length) montarPontos();
      },
      quadro: function (t) {
        seguirPonteiro();
        giro.y += ((t * 0.32 + mira.x * 0.9) - giro.y) * 0.08;
        giro.x += ((-0.55 + mira.y * 0.45 + Math.sin(t * 0.4) * 0.08) - giro.x) * 0.08;

        var cx = caixa.cx;
        var cy = caixa.cy;
        var S = Math.min(caixa.w, caixa.h) * (celular ? 0.3 : 0.27);
        var D = 4.2;
        var cosY = Math.cos(giro.y);
        var senY = Math.sin(giro.y);
        var cosX = Math.cos(giro.x);
        var senX = Math.sin(giro.x);

        var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 2.2);
        halo.addColorStop(0, "rgba(" + OURO + ", 0.14)");
        halo.addColorStop(1, "rgba(" + OURO + ", 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(cx - S * 2.2, cy - S * 2.2, S * 4.4, S * 4.4);

        ctx.globalCompositeOperation = "lighter";

        for (var i = 0; i < pontos.length; i++) {
          var p = pontos[i];
          var x1 = p.x * cosY - p.z * senY;
          var z1 = p.x * senY + p.z * cosY;
          var y2 = p.y * cosX - z1 * senX;
          var z2 = p.y * senX + z1 * cosX;
          var f = D / (D - z2);
          var sx = cx + x1 * S * f;
          var sy = cy + y2 * S * f;
          var prof = (z2 + 1.6) / 3.2;

          /* A faixa de luz: um pico estreito que corre ao longo do anel. */
          var fase = Math.cos(p.u - t * 1.3 - p.anel * Math.PI);
          var luz = fase > 0.92 ? Math.pow((fase - 0.92) / 0.08, 2) : 0;

          var alfa = 0.1 + prof * 0.42 + luz * 0.7;
          var tam = 0.7 + prof * 1.1 + luz * 1.5;

          ctx.fillStyle = luz > 0.3
            ? "rgba(255, 238, 190, " + alfa.toFixed(2) + ")"
            : "rgba(" + OURO + ", " + alfa.toFixed(2) + ")";
          ctx.fillRect(sx - tam / 2, sy - tam / 2, tam, tam);
        }

        ctx.globalCompositeOperation = "source-over";
      },
    };
  })();

  /* ================================ globo =================================
     Esfera de pontos girando. Arcos sobem de um ponto a outro: nascem
     azuis, chegam dourados, e o ponto de chegada solta uma onda. */

  var globo = (function () {
    var pontos = [];
    var visto = [];
    var arcos = [];
    var proximo = 0;
    var ang = { y: 0, x: 0.38 };

    var girar = function (v) {
      var cosY = Math.cos(ang.y);
      var senY = Math.sin(ang.y);
      var cosX = Math.cos(ang.x);
      var senX = Math.sin(ang.x);
      var x1 = v[0] * cosY - v[2] * senY;
      var z1 = v[0] * senY + v[2] * cosY;
      return [x1, v[1] * cosX - z1 * senX, v[1] * senX + z1 * cosX];
    };

    var novoArco = function (t) {
      var frente = [];
      for (var i = 0; i < visto.length; i++) if (visto[i] > 0.35) frente.push(i);
      if (frente.length < 2) return;

      var a = pontos[frente[(Math.random() * frente.length) | 0]];
      var b = null;
      for (var k = 0; k < 30 && !b; k++) {
        var c = pontos[frente[(Math.random() * frente.length) | 0]];
        var dot = a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
        if (dot < 0.93 && dot > 0.55) b = c;
      }
      if (!b) return;

      var dist = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
      var altura = 0.05 + dist * 0.16;
      var amostras = [];
      for (var s = 0; s <= 36; s++) {
        var q = s / 36;
        var m = [a[0] * (1 - q) + b[0] * q, a[1] * (1 - q) + b[1] * q, a[2] * (1 - q) + b[2] * q];
        var n = Math.hypot(m[0], m[1], m[2]) || 1;
        var e = (1 + altura * Math.sin(Math.PI * q)) / n;
        amostras.push([m[0] * e, m[1] * e, m[2] * e]);
      }
      arcos.push({ amostras: amostras, nasceu: t, dura: 2.6 });
    };

    return {
      nome: "Globo",
      iniciar: function () {
        if (pontos.length) return;
        var N = 1700;
        var dourado = Math.PI * (3 - Math.sqrt(5));
        for (var i = 0; i < N; i++) {
          var y = 1 - (2 * (i + 0.5)) / N;
          var r = Math.sqrt(1 - y * y);
          pontos.push([Math.cos(i * dourado) * r, y, Math.sin(i * dourado) * r]);
          visto.push(0);
        }
      },
      quadro: function (t) {
        seguirPonteiro();
        ang.y += ((t * 0.14 + mira.x * 0.5) - ang.y) * 0.06;
        ang.x += ((0.38 + mira.y * 0.25) - ang.x) * 0.06;

        var cx = caixa.cx;
        var cy = caixa.cy;
        var R = Math.min(caixa.w, caixa.h) * (celular ? 0.44 : 0.4);

        var atm = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.35);
        atm.addColorStop(0, "rgba(" + AZUL + ", 0.10)");
        atm.addColorStop(1, "rgba(" + AZUL + ", 0)");
        ctx.fillStyle = atm;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2);
        ctx.fill();

        var miolo = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, 0, cx, cy, R);
        miolo.addColorStop(0, "rgba(21, 28, 40, 0.9)");
        miolo.addColorStop(1, "rgba(9, 12, 18, 0.9)");
        ctx.fillStyle = miolo;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();

        for (var i = 0; i < pontos.length; i++) {
          var p = girar(pontos[i]);
          visto[i] = p[2];
          if (p[2] < 0) continue;
          var alfa = 0.1 + p[2] * 0.6;
          var tam = 0.9 + p[2] * 1;
          ctx.fillStyle = "rgba(150, 185, 230, " + alfa.toFixed(2) + ")";
          ctx.fillRect(cx + p[0] * R - tam / 2, cy + p[1] * R - tam / 2, tam, tam);
        }

        if (t > proximo && arcos.length < 8) {
          novoArco(t);
          proximo = t + sorteio(0.3, 0.6);
        }

        for (var k = arcos.length - 1; k >= 0; k--) {
          var arco = arcos[k];
          var idade = (t - arco.nasceu) / arco.dura;
          if (idade >= 1) { arcos.splice(k, 1); continue; }

          var cabeca = Math.min(1, idade * 1.7);
          var cauda = Math.max(0, (idade - 0.4) * 1.7);
          var total = arco.amostras.length - 1;
          var ini = Math.floor(cauda * total);
          var fim = Math.floor(cabeca * total);

          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          for (var s = ini; s < fim; s++) {
            var a = girar(arco.amostras[s]);
            var b = girar(arco.amostras[s + 1]);
            var q = s / total;
            var r = Math.round(78 + (212 - 78) * q);
            var g = Math.round(168 + (175 - 168) * q);
            var bl = Math.round(255 + (55 - 255) * q);
            var frente = a[2] > -0.15 ? 1 : 0.25;
            ctx.strokeStyle = "rgba(" + r + ", " + g + ", " + bl + ", " + (0.9 * frente).toFixed(2) + ")";
            ctx.beginPath();
            ctx.moveTo(cx + a[0] * R, cy + a[1] * R);
            ctx.lineTo(cx + b[0] * R, cy + b[1] * R);
            ctx.stroke();
          }

          if (cabeca >= 1) {
            var chegada = girar(arco.amostras[total]);
            if (chegada[2] > 0) {
              var onda = (idade - 1 / 1.7) / (1 - 1 / 1.7);
              ctx.beginPath();
              ctx.arc(cx + chegada[0] * R, cy + chegada[1] * R, 2 + onda * 14, 0, Math.PI * 2);
              ctx.strokeStyle = "rgba(" + OURO + ", " + (0.8 * (1 - onda)).toFixed(2) + ")";
              ctx.lineWidth = 1.2;
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(cx + chegada[0] * R, cy + chegada[1] * R, 2.4, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(241, 212, 124, 1)";
              ctx.fill();
            }
          }

          var saida = girar(arco.amostras[0]);
          if (saida[2] > 0 && cauda === 0) {
            ctx.beginPath();
            ctx.arc(cx + saida[0] * R, cy + saida[1] * R, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(" + AZUL + ", 1)";
            ctx.fill();
          }
        }
      },
    };
  })();

  /* ================================= onda =================================
     Um campo de pontos em perspectiva, como um terreno de dados ondulando.
     De tempos em tempos uma frente dourada vem do fundo até a frente. No
     computador o campo some antes de chegar na coluna do texto. */

  var onda = (function () {
    var COLS = 64;
    var LINHAS = 26;

    return {
      nome: "Onda de dados",
      quadro: function (t) {
        seguirPonteiro();

        var esq = celular ? 0 : Math.max(0, textoFim - 120);
        var dir = W;
        var topo = celular ? caixa.y : caixa.y + caixa.h * 0.05;
        var base = celular ? caixa.y + caixa.h : piso - 8;
        var largura = dir - esq;
        var meio = esq + largura * (celular ? 0.5 : 0.56) + mira.x * 30;
        var F = largura * (celular ? 0.5 : 0.42);
        var horizonte = topo + (base - topo) * 0.12;
        var camY = 1.05 + mira.y * 0.08;
        /* Escala vertical calculada para a fileira mais próxima cair perto
           do pé da área: o campo ocupa a coluna inteira, não uma faixa. */
        var Fv = ((base - 24 - horizonte) * 1.25) / camY;
        var frente = 6.4 - ((t * 1.25) % 8);

        for (var r = LINHAS - 1; r >= 0; r--) {
          var z = 1.25 + r * (5.4 / LINHAS);
          var brilhoLinha = Math.exp(-Math.pow(z - frente, 2) / 0.18);

          ctx.beginPath();
          for (var c = 0; c < COLS; c++) {
            var x = (c / (COLS - 1) - 0.5) * 7;
            var y =
              0.17 * Math.sin(x * 1.25 + t * 0.85) +
              0.11 * Math.sin(z * 1.6 - t * 1.15) +
              0.06 * Math.sin((x - z) * 2.3 + t * 1.6);
            var sx = meio + (x * F) / z;
            var sy = horizonte + ((camY - y) * Fv) / z;
            if (sy > base) continue;

            var some = celular ? 1 : Math.max(0, Math.min(1, (sx - esq) / 220));
            var perto = 1 / z;
            var alfa = (0.1 + perto * 0.75) * some;
            var tam = 0.7 + perto * 2.4;

            if (brilhoLinha > 0.05) {
              ctx.fillStyle = "rgba(241, 212, 124, " + Math.min(1, alfa + brilhoLinha * 0.8 * some).toFixed(2) + ")";
              tam += brilhoLinha * 1.2;
            } else {
              ctx.fillStyle = "rgba(" + AZUL + ", " + alfa.toFixed(2) + ")";
            }
            ctx.fillRect(sx - tam / 2, sy - tam / 2, tam, tam);

            if (c === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.strokeStyle = brilhoLinha > 0.05
            ? "rgba(" + OURO + ", " + (0.08 + brilhoLinha * 0.35).toFixed(2) + ")"
            : "rgba(" + AZUL + ", 0.05)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      },
    };
  })();

  /* ============================== motor e seletor ============================ */

  var MODOS = { funil: funil, elo: elo, globo: globo, onda: onda };
  var ORDEM = ["funil", "elo", "globo", "onda"];

  var atual = null;
  var nomeAtual = "";
  var rodando = false;
  var heroVisivel = true;
  var inicio = performance.now();

  var limpar = function () {
    ctx.clearRect(0, 0, W, H);
  };

  var quadro = function (agora) {
    if (!atual || !atual.quadro || !heroVisivel || document.hidden) {
      rodando = false;
      return;
    }
    limpar();
    atual.quadro((agora - inicio) / 1000);
    window.requestAnimationFrame(quadro);
  };

  var ligar = function () {
    if (rodando || semMovimento || !atual || !atual.quadro) return;
    rodando = true;
    window.requestAnimationFrame(quadro);
  };

  /* Sem movimento, um quadro parado num instante em que a figura já está
     formada (e, no globo, com arcos no ar). */
  var congelar = function () {
    limpar();
    if (!atual || !atual.quadro) return;
    for (var k = 0; k <= 40; k++) {
      if (k === 40) limpar();
      atual.quadro(4 + k * 0.05);
    }
  };

  var botoes = [];

  var trocar = function (nome) {
    if (!MODOS[nome] || nome === nomeAtual) return;
    if (atual && atual.desmontar) atual.desmontar();

    nomeAtual = nome;
    atual = MODOS[nome];
    ancora.dataset.modo = nome;
    limpar();
    if (atual.montar) atual.montar();
    if (atual.iniciar) atual.iniciar();

    botoes.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.modo === nome));
    });

    var url = new URL(window.location.href);
    url.searchParams.set("hero", nome);
    window.history.replaceState(null, "", url.toString().replace("movimento=&", "movimento&").replace(/movimento=$/, "movimento"));

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
    if (evento.target.closest && evento.target.closest("input, textarea")) return;
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
  trocar(MODOS[pedido] ? pedido : ORDEM[0]);
})();
