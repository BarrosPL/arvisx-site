/* ==========================================================================
   ARVISX AI — comportamento do protótipo.

   Sem framework. Cada bloco confere se a sua peça existe e tudo é
   progressivo: sem JS a página fica completa, só que parada.

   Movimento reduzido é respeitado: com ele ligado, a onda da hero vira um
   quadro estático e nada se mexe. Para avaliar o protótipo numa máquina com o
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

  /* A etiqueta da hero decifra logo na entrada, sem esperar a rolagem. A
     animação da hero em si mora em hero.js. */
  if (!semMovimento && etiquetas[0]) decifrar(etiquetas[0]);
})();
