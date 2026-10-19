/* ==========================================================================
   ARVISX AI — a onda de dados da hero (só na home).

   Um campo de pontos em perspectiva ondulando, como um terreno de dados.
   De tempos em tempos uma frente dourada vem do fundo até a frente: o dado
   azul que vira conversão. Segue o mouse de leve. No computador o campo some
   antes de chegar na coluna do texto; no celular ocupa a área abaixo dele.

   Movimento reduzido: um quadro parado. ?movimento na URL força o movimento
   numa máquina com ele desligado.
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

  var W = 0;
  var H = 0;
  var caixa = { y: 0, h: 0 };
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

    caixa.y = a.top - h.top;
    caixa.h = a.height;
    textoFim = texto.right - h.left;
    piso = marcas.top - h.top;
    celular = W < 1101;
  };

  var rgba = function (cor, a) {
    return "rgba(" + (cor[0] | 0) + ", " + (cor[1] | 0) + ", " + (cor[2] | 0) + ", " + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
  };

  var misturar = function (a, b, q) {
    return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
  };

  /* Campo de COLS × LINHAS pontos. x vai de -3,5 a 3,5; z é a distância
     até a câmera, da fileira mais próxima (Z_PERTO) à do fundo. */
  var COLS = 64;
  var LINHAS = 26;
  var Z_PERTO = 1.25;
  var Z_FUNDO = 6.65;

  var geometria = function () {
    var esq = celular ? 0 : Math.max(0, textoFim - 120);
    var topo = celular ? caixa.y : caixa.y + caixa.h * 0.02;
    var base = celular ? caixa.y + caixa.h : piso - 8;
    var largura = W - esq;
    var horizonte = topo + (base - topo) * 0.12;
    var camY = 1.05 + mira.y * 0.08;

    return {
      esq: esq,
      base: base,
      meio: esq + largura * (celular ? 0.5 : 0.56) + mira.x * 30,
      F: largura * (celular ? 0.5 : 0.42),
      horizonte: horizonte,
      camY: camY,
      /* Escala vertical calculada para a fileira mais próxima cair perto do
         pé da área: o campo ocupa a coluna inteira, não uma faixa. */
      Fv: ((base - 24 - horizonte) * Z_PERTO) / camY,
    };
  };

  var altura = function (x, z, t) {
    return (
      0.17 * Math.sin(x * 1.25 + t * 0.85) +
      0.11 * Math.sin(z * 1.6 - t * 1.15) +
      0.06 * Math.sin((x - z) * 2.3 + t * 1.6)
    );
  };

  var desenhar = function (t) {
    mira.x += ((ponteiro.ativo ? ponteiro.x : 0) - mira.x) * 0.05;
    mira.y += ((ponteiro.ativo ? ponteiro.y : 0) - mira.y) * 0.05;

    var g = geometria();
    var frente = 6.4 - ((t * 1.25) % 8);

    ctx.clearRect(0, 0, W, H);

    for (var r = LINHAS - 1; r >= 0; r--) {
      var z = Z_PERTO + r * ((Z_FUNDO - Z_PERTO) / LINHAS);
      var ouro = Math.exp(-Math.pow(z - frente, 2) / 0.18);
      var perto = 1 / z;

      ctx.beginPath();
      for (var c = 0; c < COLS; c++) {
        var x = (c / (COLS - 1) - 0.5) * 7;
        var sx = g.meio + (x * g.F) / z;
        var sy = g.horizonte + ((g.camY - altura(x, z, t)) * g.Fv) / z;
        if (sy > g.base) continue;

        var some = celular ? 1 : Math.max(0, Math.min(1, (sx - g.esq) / 220));
        var alfa = (0.1 + perto * 0.75 + ouro * 0.5) * some;
        var tam = 0.7 + perto * 2.4 + ouro * 1.3;

        ctx.fillStyle = rgba(misturar(AZUL, OURO, ouro), alfa);
        ctx.fillRect(sx - tam / 2, sy - tam / 2, tam, tam);

        if (c === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = ouro > 0.3 ? rgba(misturar(AZUL, OURO, 0.5), 0.05 + ouro * 0.04) : rgba(AZUL, 0.05);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  /* --------------------------------- laço ---------------------------------- */

  var rodando = false;
  var heroVisivel = true;
  var inicio = performance.now();

  var quadro = function (agora) {
    if (!heroVisivel || document.hidden) {
      rodando = false;
      return;
    }
    desenhar((agora - inicio) / 1000);
    window.requestAnimationFrame(quadro);
  };

  var ligar = function () {
    if (rodando || semMovimento) return;
    rodando = true;
    window.requestAnimationFrame(quadro);
  };

  /* Sem movimento, um quadro parado com a frente dourada no meio do campo. */
  var preparar = function () {
    medir();
    if (semMovimento) desenhar(2.2);
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

  preparar();
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

    ligar();
  }
})();
