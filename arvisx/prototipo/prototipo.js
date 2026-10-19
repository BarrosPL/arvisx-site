/* ==========================================================================
   ARVISX AI — comportamento do protótipo.

   Sem framework. Cada bloco confere se a sua peça existe e tudo é
   progressivo: sem JS a página fica completa, só que parada.

   Movimento reduzido é respeitado: com ele ligado, o núcleo vira um quadro
   estático e nada se mexe. Para avaliar o protótipo numa máquina com o
   movimento desligado, abra a página com ?movimento no fim do endereço.
   ========================================================================== */

(function () {
  "use strict";

  var raiz = document.documentElement;
  raiz.classList.add("js");

  var forcar = /[?&]movimento\b/.test(window.location.search);
  if (forcar) raiz.classList.add("forcar-movimento");

  var semMovimento = !forcar && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------ menu celular ------------------------------ */

  var menu = document.querySelector(".menu");
  var links = document.getElementById("links");

  if (menu && links) {
    var alternar = function (abrir) {
      links.classList.toggle("aberto", abrir);
      menu.setAttribute("aria-expanded", String(abrir));
      menu.setAttribute("aria-label", abrir ? "Fechar menu" : "Abrir menu");
    };

    menu.addEventListener("click", function () {
      alternar(!links.classList.contains("aberto"));
    });

    links.addEventListener("click", function (evento) {
      if (evento.target.closest("a")) alternar(false);
    });

    document.addEventListener("keydown", function (evento) {
      if (evento.key === "Escape" && links.classList.contains("aberto")) {
        alternar(false);
        menu.focus();
      }
    });
  }

  /* ------------------------- topo: fundo e progresso ------------------------ */

  var topo = document.getElementById("topo");

  /* ------------------------------ etiquetas ---------------------------------
     Cada etiqueta vira duas camadas: o texto real, escondido mas lido pelo
     leitor de tela, e uma cópia visual que "decifra" — letras aleatórias
     que assentam da esquerda para a direita. A fonte é mono, então a
     largura não pula durante o efeito. */

  var GLIFOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#_";

  var etiquetas = Array.prototype.map.call(document.querySelectorAll("[data-decifrar]"), function (el) {
    var texto = el.textContent.trim();
    el.textContent = "";

    var lido = document.createElement("span");
    lido.className = "sr";
    lido.textContent = texto;

    var visto = document.createElement("span");
    visto.setAttribute("aria-hidden", "true");
    visto.textContent = texto;

    el.appendChild(lido);
    el.appendChild(visto);
    return { el: el, visto: visto, texto: texto };
  });

  var decifrar = function (etiqueta) {
    if (semMovimento || etiqueta.feito) return;
    etiqueta.feito = true;

    var texto = etiqueta.texto;
    var duracao = 520 + texto.length * 14;
    var inicio = null;

    var passo = function (agora) {
      if (inicio === null) inicio = agora;
      var p = Math.min(1, (agora - inicio) / duracao);
      var prontos = Math.floor(p * texto.length);
      var saida = "";

      for (var i = 0; i < texto.length; i++) {
        var c = texto[i];
        saida += i < prontos || c === " " ? c : GLIFOS[(Math.random() * GLIFOS.length) | 0];
      }

      etiqueta.visto.textContent = saida;
      if (p < 1) window.requestAnimationFrame(passo);
    };

    window.requestAnimationFrame(passo);
  };

  /* ------------------------- entrada ao rolar a página ----------------------
     Um observador só, para tudo o que reage a entrar na tela: blocos que
     aparecem (.revelar), etiquetas que decifram e seções que ligam a sua
     animação (.ativo). */

  var blocos = document.querySelectorAll(".revelar");
  var ativaveis = document.querySelectorAll("[data-agentes], [data-passos]");

  blocos.forEach(function (bloco) {
    var irmaos = Array.prototype.filter.call(bloco.parentNode.children, function (el) {
      return el.classList.contains("revelar");
    });
    var i = irmaos.indexOf(bloco);
    if (i > 0) bloco.style.transitionDelay = Math.min(i, 6) * 80 + "ms";
  });

  document.querySelectorAll(".agente").forEach(function (agente, i) {
    agente.style.setProperty("--atraso", (i * 0.7).toFixed(1) + "s");
  });

  if (semMovimento || !("IntersectionObserver" in window)) {
    blocos.forEach(function (el) { el.classList.add("visivel"); });
    ativaveis.forEach(function (el) { el.classList.add("ativo"); });
  } else {
    var observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          var el = entrada.target;
          if (el.classList.contains("revelar")) el.classList.add("visivel");
          if (el.matches("[data-agentes], [data-passos]")) el.classList.add("ativo");
          if (el.etiqueta) decifrar(el.etiqueta);
          observador.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
    );

    blocos.forEach(function (el) { observador.observe(el); });
    ativaveis.forEach(function (el) { observador.observe(el); });
    etiquetas.forEach(function (etiqueta) {
      etiqueta.el.etiqueta = etiqueta;
      observador.observe(etiqueta.el);
    });
  }

  /* -------------------------------- esteira --------------------------------- */

  document.querySelectorAll("[data-esteira]").forEach(function (esteira) {
    var lista = esteira.querySelector("ul");
    if (!lista || semMovimento) return;
    var copia = lista.cloneNode(true);
    copia.setAttribute("aria-hidden", "true");
    esteira.appendChild(copia);
  });

  /* -------------------------------- holofote -------------------------------- */

  document.querySelectorAll("[data-luz]").forEach(function (el) {
    el.addEventListener("pointermove", function (evento) {
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", evento.clientX - r.left + "px");
      el.style.setProperty("--my", evento.clientY - r.top + "px");
    });
  });

  /* ---------------------------- fluxo: as fichas ----------------------------
     Uma ficha desce o trilho parando em cada etapa. Ao chegar, a etapa
     acende (com a varredura). Da etapa da IA em diante a ficha é dourada:
     o lead foi qualificado. */

  var fluxo = document.querySelector("[data-fluxo]");

  if (fluxo && !semMovimento) {
    var trilho = fluxo.querySelector(".fluxo-trilho");
    var etapas = trilho.querySelectorAll(".etapa");
    var fluxoVisivel = false;

    var centro = function (i) {
      return etapas[i].offsetTop + etapas[i].offsetHeight / 2;
    };

    var acenderEtapa = function (etapa) {
      etapa.classList.remove("viva");
      void etapa.offsetWidth;
      etapa.classList.add("viva");
      window.clearTimeout(etapa.apagar);
      etapa.apagar = window.setTimeout(function () {
        etapa.classList.remove("viva");
      }, 900);
    };

    var novaFicha = function () {
      var ficha = document.createElement("i");
      ficha.className = "ficha";
      ficha.setAttribute("aria-hidden", "true");
      ficha.style.transform = "translateY(" + (centro(0) - 30) + "px)";
      trilho.appendChild(ficha);

      var i = 0;
      var avancar = function () {
        if (i >= etapas.length) {
          ficha.style.opacity = "0";
          window.setTimeout(function () { ficha.remove(); }, 400);
          return;
        }
        ficha.style.opacity = "1";
        ficha.style.transform = "translateY(" + centro(i) + "px)";
        window.setTimeout(function () {
          acenderEtapa(etapas[i]);
          if (i >= 2) ficha.classList.add("ouro");
          i++;
          window.setTimeout(avancar, 160);
        }, 560);
      };

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(avancar);
      });
    };

    var cicloFluxo = function () {
      if (fluxoVisivel && !document.hidden) novaFicha();
      window.setTimeout(cicloFluxo, 1500);
    };

    new IntersectionObserver(function (entradas) {
      fluxoVisivel = entradas[0].isIntersecting;
    }).observe(fluxo);

    cicloFluxo();
  }

  /* ---------------------------------- rota ---------------------------------- */

  var rota = document.querySelector(".rota-mapa");
  if (rota && semMovimento && rota.pauseAnimations) {
    rota.pauseAnimations();
    rota.setCurrentTime(3.2);
  }

  /* ----------------------------------- fio -----------------------------------
     Uma linha vertical na margem esquerda, do fim da hero até o contato.
     Cada etiqueta de seção ganha um nó no fio e um ramo até ela. A parte
     acesa acompanha a rolagem: o lead descendo a página. */

  var fio = document.querySelector(".fio");
  var principal = document.querySelector("main");
  var hero = document.querySelector(".hero");
  var NS = "http://www.w3.org/2000/svg";

  var fioPartes = null;

  var novo = function (tag, atributos, pai) {
    var el = document.createElementNS(NS, tag);
    Object.keys(atributos).forEach(function (k) { el.setAttribute(k, atributos[k]); });
    pai.appendChild(el);
    return el;
  };

  var montarFio = function () {
    if (!fio || getComputedStyle(fio).display === "none") {
      fioPartes = null;
      return;
    }

    var caixa = principal.getBoundingClientRect();
    var alturaTotal = principal.offsetHeight;
    var secao = document.querySelector(".secao");
    var x = parseFloat(getComputedStyle(secao).paddingLeft) / 2;

    var nos = Array.prototype.map.call(
      principal.querySelectorAll("section:not(.hero) .etiqueta"),
      function (el) {
        var r = el.getBoundingClientRect();
        return { y: r.top + r.height / 2 - caixa.top, xFim: r.left - caixa.left - 14 };
      },
    );

    if (!nos.length) return;

    var y0 = hero.offsetHeight;
    var yN = nos[nos.length - 1].y;

    fio.setAttribute("height", alturaTotal);
    fio.setAttribute("viewBox", "0 0 " + caixa.width + " " + alturaTotal);
    fio.textContent = "";

    var defs = novo("defs", {}, fio);
    var grad = novo("linearGradient", { id: "fio-grad", gradientUnits: "userSpaceOnUse", x1: 0, y1: y0, x2: 0, y2: yN }, defs);
    novo("stop", { offset: "0", "stop-color": "#4ea8ff" }, grad);
    novo("stop", { offset: "0.45", "stop-color": "#d4af37" }, grad);
    novo("stop", { offset: "1", "stop-color": "#f1d47c" }, grad);

    novo("line", { class: "fio-base", x1: x, y1: y0, x2: x, y2: yN }, fio);
    var luz = novo("line", { class: "fio-luz", x1: x, y1: y0, x2: x, y2: y0 }, fio);

    var marcados = nos.map(function (no) {
      var ramo = no.xFim > x + 12
        ? novo("line", { class: "fio-ramo", x1: x + 5, y1: no.y, x2: no.xFim, y2: no.y }, fio)
        : null;
      var circulo = novo("circle", { class: "fio-no", cx: x, cy: no.y, r: 4.5 }, fio);
      return { y: no.y, ramo: ramo, circulo: circulo };
    });

    var cabeca = novo("circle", { class: "fio-cabeca", cx: x, cy: y0, r: 3.5 }, fio);

    fioPartes = { y0: y0, yN: yN, luz: luz, cabeca: cabeca, nos: marcados, topo: caixa.top + window.scrollY };
  };

  var atualizarRolagem = function () {
    var y = window.scrollY;
    var total = document.documentElement.scrollHeight - window.innerHeight;

    if (topo) {
      topo.classList.toggle("rolado", y > 30);
      topo.style.setProperty("--progresso", total > 0 ? (y / total).toFixed(4) : 0);
    }

    if (!fioPartes) return;
    var p = fioPartes;
    var ponta = Math.max(p.y0, Math.min(p.yN, y + window.innerHeight * 0.6 - p.topo));

    p.luz.setAttribute("y2", ponta);
    p.cabeca.setAttribute("cy", ponta);
    p.nos.forEach(function (no) {
      var aceso = no.y <= ponta + 1;
      no.circulo.classList.toggle("aceso", aceso);
      if (no.ramo) no.ramo.classList.toggle("aceso", aceso);
    });
  };

  var agendado = false;
  var aoRolar = function () {
    if (agendado) return;
    agendado = true;
    window.requestAnimationFrame(function () {
      agendado = false;
      atualizarRolagem();
    });
  };

  var remontar = function () {
    montarFio();
    atualizarRolagem();
  };

  window.addEventListener("scroll", aoRolar, { passive: true });
  window.addEventListener("load", remontar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remontar);
  if ("ResizeObserver" in window && principal) new ResizeObserver(remontar).observe(principal);
  remontar();

  /* --------------------------------- núcleo ----------------------------------
     O canvas da hero. Leads azuis chegam espalhados pelas bordas, são puxados
     em espiral para o núcleo e, ao entrar, saem dourados por faixas
     ordenadas. O símbolo da marca fica no centro, entre duas órbitas
     inclinadas com contas que passam por trás e pela frente dele. */

  var campo = document.querySelector(".hero-campo");
  var ancora = document.querySelector("[data-nucleo]");

  if (!campo || !ancora || !campo.getContext) return;

  var ctx = campo.getContext("2d");
  var simbolo = new Image();
  simbolo.src = "simbolo.webp";

  var AZUL = "78, 168, 255";
  var OURO = "212, 175, 55";

  var W = 0;
  var H = 0;
  var nucleo = { x: 0, y: 0, r: 100 };
  var zona = { xMin: 0, yMin: 0, yMax: 0, celular: false };
  var faixas = [];
  var entradas = [];
  var saidas = [];
  var brilho = 0;
  var relogio = 0;
  var ponteiro = { x: -9999, y: -9999 };
  var desvio = { x: 0, y: 0 };

  var medir = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var caixa = hero.getBoundingClientRect();
    var a = ancora.getBoundingClientRect();

    W = caixa.width;
    H = caixa.height;
    campo.width = Math.round(W * dpr);
    campo.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    nucleo.x = a.left - caixa.left + a.width / 2;
    nucleo.y = a.top - caixa.top + a.height / 2;
    nucleo.r = Math.max(52, Math.min(a.width, a.height) * 0.2);

    zona.celular = W < 1101;
    zona.xMin = zona.celular ? 0 : a.left - caixa.left - 40;
    zona.yMin = zona.celular ? Math.max(a.top - caixa.top, nucleo.y - nucleo.r * 3.2) : 0;
    /* No computador os leads nascem acima da faixa de marcas, para não
       riscarem os logos. */
    var marcas = hero.querySelector(".marcas");
    var piso = marcas ? marcas.getBoundingClientRect().top - caixa.top : H;
    zona.yMax = zona.celular ? nucleo.y + nucleo.r * 3.2 : piso;

    /* Faixas de saída: curvas que partem da borda direita do núcleo e
       abrem em leque até sair do quadro. */
    faixas = [-2, -1, 0, 1, 2].map(function (k) {
      var abertura = k * nucleo.r * 0.42;
      var x0 = nucleo.x + nucleo.r * 0.98;
      return {
        p0: [x0, nucleo.y + abertura * 0.4],
        p1: [x0 + nucleo.r * 1.4, nucleo.y + abertura * 0.5],
        p2: [x0 + (W - x0) * 0.55, nucleo.y + abertura * 1.6],
        p3: [W + 40, nucleo.y + abertura * 2.4],
      };
    });
  };

  var bezier = function (f, t) {
    var u = 1 - t;
    var a = u * u * u;
    var b = 3 * u * u * t;
    var c = 3 * u * t * t;
    var d = t * t * t;
    return [
      a * f.p0[0] + b * f.p1[0] + c * f.p2[0] + d * f.p3[0],
      a * f.p0[1] + b * f.p1[1] + c * f.p2[1] + d * f.p3[1],
    ];
  };

  var sorteio = function (min, max) {
    return min + Math.random() * (max - min);
  };

  var nascer = function () {
    var x;
    var y;
    var lado = Math.random();

    if (zona.celular) {
      if (lado < 0.4) { x = -10; y = sorteio(zona.yMin, zona.yMax); }
      else if (lado < 0.7) { x = sorteio(0, W); y = zona.yMin; }
      else { x = sorteio(0, W); y = zona.yMax; }
    } else {
      if (lado < 0.45) { x = sorteio(zona.xMin, W); y = -10; }
      else if (lado < 0.9) { x = sorteio(zona.xMin, W); y = zona.yMax; }
      else { x = W + 10; y = sorteio(0, H * 0.3); }
    }

    var dx = nucleo.x - x;
    var dy = nucleo.y - y;
    var d = Math.hypot(dx, dy) || 1;
    var v = sorteio(0.6, 1.4);

    return { x: x, y: y, vx: (dx / d) * v, vy: (dy / d) * v, giro: Math.random() < 0.5 ? 1 : -1, rastro: [] };
  };

  var passo = function () {
    relogio++;
    brilho *= 0.94;

    desvio.x += ((ponteiro.x > -999 ? (ponteiro.x - nucleo.x) * 0.03 : 0) - desvio.x) * 0.05;
    desvio.y += ((ponteiro.y > -999 ? (ponteiro.y - nucleo.y) * 0.03 : 0) - desvio.y) * 0.05;
    desvio.x = Math.max(-14, Math.min(14, desvio.x));
    desvio.y = Math.max(-14, Math.min(14, desvio.y));

    var cx = nucleo.x + desvio.x;
    var cy = nucleo.y + desvio.y;
    var alvo = Math.round(Math.max(55, Math.min(140, (W * (zona.yMax - zona.yMin)) / 9000)));

    while (entradas.length < alvo) entradas.push(nascer());

    for (var i = entradas.length - 1; i >= 0; i--) {
      var p = entradas[i];
      var dx = cx - p.x;
      var dy = cy - p.y;
      var d = Math.hypot(dx, dy) || 1;

      /* Em vez de força solta (que deixa o lead preso em órbita), cada lead
         persegue uma velocidade-alvo: um pouco para dentro e um pouco de
         lado. Perto do núcleo as duas crescem — entra em espiral e sempre
         chega. */
      var rx = dx / d;
      var ry = dy / d;
      var perto = Math.min(1, (nucleo.r * 2.4) / d);
      var dentro = 0.8 + 1.5 * perto;
      var lado = (0.3 + 1.5 * perto) * p.giro;
      p.vx += (rx * dentro - ry * lado - p.vx) * 0.05;
      p.vy += (ry * dentro + rx * lado - p.vy) * 0.05;

      /* No computador, nada invade a coluna do texto. */
      if (!zona.celular && p.x < zona.xMin) p.vx += 0.08;

      var pdx = p.x - ponteiro.x;
      var pdy = p.y - ponteiro.y;
      var pd = Math.hypot(pdx, pdy);
      if (pd < 110 && pd > 0) {
        p.vx += (pdx / pd) * 0.35;
        p.vy += (pdy / pd) * 0.35;
      }

      var v = Math.hypot(p.vx, p.vy);
      if (v > 3.4) {
        p.vx = (p.vx / v) * 3.4;
        p.vy = (p.vy / v) * 3.4;
      }

      p.rastro.push(p.x, p.y);
      if (p.rastro.length > 16) p.rastro.splice(0, 2);
      p.x += p.vx;
      p.y += p.vy;

      if (d < nucleo.r * 0.6) {
        entradas.splice(i, 1);
        brilho = Math.min(1, brilho + 0.18);
        if (saidas.length < 70) {
          saidas.push({ faixa: faixas[(Math.random() * faixas.length) | 0], t: 0, vel: sorteio(0.0045, 0.0075), rastro: [] });
        }
      }
    }

    for (var j = saidas.length - 1; j >= 0; j--) {
      var s = saidas[j];
      s.t += s.vel;
      var pos = bezier(s.faixa, s.t * s.t * (3 - 2 * s.t) * 0.35 + s.t * 0.65);
      s.rastro.push(pos[0], pos[1]);
      if (s.rastro.length > 28) s.rastro.splice(0, 2);
      if (s.t >= 1) saidas.splice(j, 1);
    }
  };

  var tracarRastro = function (rastro, cor, largura, alfa) {
    if (rastro.length < 4) return;
    ctx.beginPath();
    ctx.moveTo(rastro[0], rastro[1]);
    for (var k = 2; k < rastro.length; k += 2) ctx.lineTo(rastro[k], rastro[k + 1]);
    ctx.strokeStyle = "rgba(" + cor + ", " + alfa + ")";
    ctx.lineWidth = largura;
    ctx.stroke();
  };

  /* Órbitas: elipses inclinadas, com contas. Profundidade pelo seno do
     ângulo — a metade de baixo passa na frente do símbolo. */
  var ORBITAS = [
    { rx: 1.6, ry: 0.42, inclina: -0.18, contas: 3, vel: 0.0045 },
    { rx: 1.3, ry: 0.64, inclina: 0.42, contas: 2, vel: -0.0065 },
  ];

  var contas = function (cx, cy, frente) {
    ORBITAS.forEach(function (o) {
      var cos = Math.cos(o.inclina);
      var sen = Math.sin(o.inclina);
      for (var k = 0; k < o.contas; k++) {
        var ang = relogio * o.vel + (k / o.contas) * Math.PI * 2;
        var prof = Math.sin(ang);
        if ((prof >= 0) !== frente) continue;
        var ex = Math.cos(ang) * o.rx * nucleo.r;
        var ey = prof * o.ry * nucleo.r;
        var x = cx + ex * cos - ey * sen;
        var y = cy + ex * sen + ey * cos;
        var tam = 2 + (prof + 1) * 1.4;
        ctx.beginPath();
        ctx.arc(x, y, tam, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(241, 212, 124, " + (0.45 + (prof + 1) * 0.27) + ")";
        ctx.shadowColor = "rgba(" + OURO + ", 0.9)";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });
  };

  var desenhar = function () {
    ctx.clearRect(0, 0, W, H);

    var cx = nucleo.x + desvio.x;
    var cy = nucleo.y + desvio.y;
    var r = nucleo.r;

    ctx.setLineDash([2, 7]);
    faixas.forEach(function (f) {
      ctx.beginPath();
      ctx.moveTo(f.p0[0], f.p0[1]);
      ctx.bezierCurveTo(f.p1[0], f.p1[1], f.p2[0], f.p2[1], f.p3[0], f.p3[1]);
      ctx.strokeStyle = "rgba(" + OURO + ", 0.16)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.setLineDash([]);

    entradas.forEach(function (p) {
      tracarRastro(p.rastro, AZUL, 1, 0.28);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + AZUL + ", 0.85)";
      ctx.fill();
    });

    var halo = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.6);
    halo.addColorStop(0, "rgba(" + OURO + ", " + (0.16 + brilho * 0.16) + ")");
    halo.addColorStop(1, "rgba(" + OURO + ", 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - r * 2.6, cy - r * 2.6, r * 5.2, r * 5.2);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(11, 15, 21, 0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(" + OURO + ", " + (0.35 + brilho * 0.5) + ")";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -relogio * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.16, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(" + OURO + ", 0.3)";
    ctx.stroke();
    ctx.setLineDash([]);

    ORBITAS.forEach(function (o) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, o.rx * r, o.ry * r, o.inclina, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(" + OURO + ", 0.22)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    contas(cx, cy, false);

    if (simbolo.complete && simbolo.naturalWidth) {
      var largura = r * 1.5;
      var altura = (largura * simbolo.naturalHeight) / simbolo.naturalWidth;
      ctx.drawImage(simbolo, cx - largura / 2, cy - altura / 2 - r * 0.04, largura, altura);
    }

    contas(cx, cy, true);

    saidas.forEach(function (s) {
      tracarRastro(s.rastro, OURO, 1.6, 0.55);
      var n = s.rastro.length;
      if (n < 2) return;
      ctx.beginPath();
      ctx.arc(s.rastro[n - 2], s.rastro[n - 1], 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(241, 212, 124, 1)";
      ctx.shadowColor = "rgba(" + OURO + ", 1)";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };

  var rodando = false;
  var heroVisivel = true;

  var quadro = function () {
    if (!heroVisivel || document.hidden) {
      rodando = false;
      return;
    }
    passo();
    desenhar();
    window.requestAnimationFrame(quadro);
  };

  var ligar = function () {
    if (rodando || semMovimento) return;
    rodando = true;
    window.requestAnimationFrame(quadro);
  };

  /* Sem movimento: simula alguns segundos de uma vez e congela o quadro,
     para o núcleo aparecer já povoado. */
  var congelar = function () {
    entradas = [];
    saidas = [];
    for (var k = 0; k < 260; k++) passo();
    desenhar();
  };

  var preparar = function () {
    medir();
    if (semMovimento) congelar();
  };

  preparar();
  simbolo.addEventListener("load", function () {
    if (semMovimento) desenhar();
  });

  if ("ResizeObserver" in window) new ResizeObserver(preparar).observe(hero);
  else window.addEventListener("resize", preparar);

  hero.addEventListener("pointermove", function (evento) {
    var caixa = hero.getBoundingClientRect();
    ponteiro.x = evento.clientX - caixa.left;
    ponteiro.y = evento.clientY - caixa.top;
  });

  hero.addEventListener("pointerleave", function () {
    ponteiro.x = -9999;
    ponteiro.y = -9999;
  });

  if (!semMovimento) {
    new IntersectionObserver(function (entradasVistas) {
      heroVisivel = entradasVistas[0].isIntersecting;
      if (heroVisivel) ligar();
    }).observe(hero);

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) ligar();
    });

    var heroEtiqueta = etiquetas[0];
    if (heroEtiqueta) decifrar(heroEtiqueta);
    ligar();
  }
})();
