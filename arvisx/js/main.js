/* ==========================================================================
   ARVISX AI — comportamento do site.

   Sem framework e sem dependência: são seis comportamentos pequenos e
   independentes, cada um protegido por uma checagem de existência para a
   mesma folha servir a home, o funil, o índice do blog e o artigo.

   Tudo o que este arquivo faz é progressivo: sem JS a página continua
   completa e legível.
   ========================================================================== */

(function () {
  "use strict";

  /* Avisa o CSS que o script assumiu. Só a partir daqui os blocos com
     .revelar podem nascer invisíveis — sem isso, quem tem JS desligado
     ficaria com a página em branco. */
  document.documentElement.classList.add("js");

  var semAnimacao = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------- menu mobile ------------------------------ */

  var botaoMenu = document.querySelector(".menu-mobile");
  var links = document.getElementById("nav-links");

  if (botaoMenu && links) {
    var alternar = function (abrir) {
      links.classList.toggle("aberto", abrir);
      botaoMenu.setAttribute("aria-expanded", String(abrir));
      botaoMenu.textContent = abrir ? "✕" : "☰";
    };

    botaoMenu.addEventListener("click", function () {
      alternar(!links.classList.contains("aberto"));
    });

    /* Clicar num link fecha o menu — as âncoras são da mesma página. */
    links.addEventListener("click", function (evento) {
      if (evento.target.closest("a")) alternar(false);
    });

    document.addEventListener("keydown", function (evento) {
      if (evento.key === "Escape" && links.classList.contains("aberto")) {
        alternar(false);
        botaoMenu.focus();
      }
    });
  }

  /* --------------------------- navbar ao rolar ---------------------------- */

  var nav = document.getElementById("nav");

  if (nav) {
    var marcarNav = function () {
      nav.classList.toggle("encolhida", window.scrollY > 40);
    };

    marcarNav();
    window.addEventListener("scroll", marcarNav, { passive: true });
  }

  /* ------------------------- revelar ao entrar na tela --------------------- */

  var blocos = document.querySelectorAll(".revelar");

  if (blocos.length) {
    if (semAnimacao || !("IntersectionObserver" in window)) {
      blocos.forEach(function (bloco) {
        bloco.classList.add("visivel");
      });
    } else {
      var observador = new IntersectionObserver(
        function (entradas) {
          entradas.forEach(function (entrada) {
            if (!entrada.isIntersecting) return;
            entrada.target.classList.add("visivel");
            observador.unobserve(entrada.target);
          });
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
      );

      /* Um atraso curto por posição dentro do mesmo grid dá o efeito em
         cascata sem precisar escrever o índice no HTML. */
      blocos.forEach(function (bloco) {
        var irmaos = Array.prototype.slice.call(bloco.parentNode.children);
        var i = irmaos.indexOf(bloco);
        if (i > 0) bloco.style.transitionDelay = Math.min(i, 6) * 70 + "ms";
        observador.observe(bloco);
      });
    }
  }

  /* ------------------------------- esteiras -------------------------------
     A animação de correr desloca -100% da primeira <ul>. Para a emenda ser
     invisível, a lista é clonada aqui em vez de duplicada na mão no HTML:
     assim o conteúdo aparece uma única vez para leitores de tela e para
     quem lê o código. */

  document.querySelectorAll("[data-esteira]").forEach(function (esteira) {
    var lista = esteira.querySelector("ul");
    if (!lista || semAnimacao) return;

    var copia = lista.cloneNode(true);
    copia.setAttribute("aria-hidden", "true");
    copia.querySelectorAll("a").forEach(function (a) {
      a.setAttribute("tabindex", "-1");
    });
    esteira.appendChild(copia);
  });

  /* ---------------------------------- elo ----------------------------------
     Traça um fio de cada entrada até o núcleo e do núcleo até cada saída, a
     partir da posição real das etiquetas — por isso é refeito sempre que a
     figura muda de tamanho. Depois, de tempos em tempos, um lead sai de uma
     entrada, acende o núcleo e segue para uma saída. Fora da tela, ou com a
     aba escondida, a animação para. */

  var elo = document.querySelector("[data-elo]");

  if (elo) {
    var NS = "http://www.w3.org/2000/svg";
    var fios = elo.querySelector(".elo-fios");
    var nucleo = elo.querySelector(".elo-hub");
    var entradas = elo.querySelectorAll(".elo-entradas li");
    var saidas = elo.querySelectorAll(".elo-saidas li");
    var fiosEntrada = [];
    var fiosSaida = [];

    var curva = function (x1, y1, x2, y2) {
      var meio = (x2 - x1) * 0.5;
      return "M" + x1 + " " + y1 +
        " C" + (x1 + meio) + " " + y1 + " " + (x2 - meio) + " " + y2 + " " + x2 + " " + y2;
    };

    var novoFio = function (d) {
      var fio = document.createElementNS(NS, "path");
      fio.setAttribute("d", d);
      fio.setAttribute("class", "elo-fio");
      fios.appendChild(fio);
      return fio;
    };

    /* Os fios chegam ao núcleo em leque — cada um num ponto da borda, a
       14° do vizinho — em vez de todos no mesmo pixel. */
    var naBorda = function (cx, cy, raio, lado, i, total) {
      var angulo = ((i - (total - 1) / 2) * 14 * Math.PI) / 180;
      return [cx + lado * raio * Math.cos(angulo), cy + raio * Math.sin(angulo)];
    };

    var tracar = function () {
      var caixa = elo.getBoundingClientRect();
      var n = nucleo.getBoundingClientRect();
      var raio = n.width / 2;
      var cx = n.left + raio - caixa.left;
      var cy = n.top + raio - caixa.top;

      fios.setAttribute("viewBox", "0 0 " + caixa.width + " " + caixa.height);
      fios.textContent = "";

      fiosEntrada = Array.prototype.map.call(entradas, function (li, i) {
        var r = li.getBoundingClientRect();
        var borda = naBorda(cx, cy, raio, -1, i, entradas.length);
        return novoFio(curva(r.right - caixa.left, r.top + r.height / 2 - caixa.top, borda[0], borda[1]));
      });

      fiosSaida = Array.prototype.map.call(saidas, function (li, i) {
        var r = li.getBoundingClientRect();
        var borda = naBorda(cx, cy, raio, 1, i, saidas.length);
        return novoFio(curva(borda[0], borda[1], r.left - caixa.left, r.top + r.height / 2 - caixa.top));
      });
    };

    /* Acende por um tempo. Se o mesmo elemento for aceso de novo antes de
       apagar, o prazo recomeça em vez de o primeiro timer cortar o segundo. */
    var acender = function (el, classe, ms) {
      el.classList.add(classe);
      window.clearTimeout(el.eloApagar);
      el.eloApagar = window.setTimeout(function () {
        el.classList.remove(classe);
      }, ms);
    };

    /* O lead é um traço curto correndo sobre uma cópia do fio, feito com
       stroke-dasharray: o deslocamento leva o traço de antes do começo até
       depois do fim. `chegou` dispara quando a ponta alcança o destino. */
    var correr = function (fio, duracao, chegou) {
      var total = fio.getTotalLength();
      var traco = Math.min(48, total * 0.3);
      var cometa = fio.cloneNode(false);
      var avisou = false;
      var inicio = null;

      cometa.setAttribute("class", "elo-cometa");
      cometa.style.strokeDasharray = traco + " " + (total + traco);
      cometa.style.strokeDashoffset = traco;
      fios.appendChild(cometa);

      var passo = function (agora) {
        if (inicio === null) inicio = agora;
        var t = Math.min(1, (agora - inicio) / duracao);
        var suave = (1 - Math.cos(Math.PI * t)) / 2;
        var deslocamento = traco - suave * (total + traco);
        cometa.style.strokeDashoffset = deslocamento;

        if (!avisou && traco - deslocamento >= total) {
          avisou = true;
          if (chegou) chegou();
        }

        if (t < 1) window.requestAnimationFrame(passo);
        else if (cometa.parentNode) cometa.parentNode.removeChild(cometa);
      };

      window.requestAnimationFrame(passo);
    };

    var sortear = function (lista) {
      return Math.floor(Math.random() * lista.length);
    };

    var lead = function () {
      var i = sortear(entradas);
      var j = sortear(saidas);

      acender(entradas[i], "aceso", 900);
      correr(fiosEntrada[i], 1300, function () {
        acender(nucleo, "recebe", 450);
        var fio = fiosSaida[j];
        if (!fio) return;
        correr(fio, 1200, function () {
          acender(saidas[j], "aceso", 1400);
        });
      });
    };

    var visivel = false;

    var ciclo = function () {
      if (visivel && !document.hidden) lead();
      window.setTimeout(ciclo, 1100 + Math.random() * 900);
    };

    var agendado = false;
    var retracar = function () {
      if (agendado) return;
      agendado = true;
      window.requestAnimationFrame(function () {
        agendado = false;
        tracar();
      });
    };

    tracar();

    /* A troca da fonte de reserva pela Archivo muda a largura das
       etiquetas; os fios precisam acompanhar. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(retracar);

    if ("ResizeObserver" in window) new ResizeObserver(retracar).observe(elo);
    else window.addEventListener("resize", retracar);

    if (!semAnimacao) {
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entradasVistas) {
          visivel = entradasVistas[0].isIntersecting;
        }).observe(elo);
      } else {
        visivel = true;
      }

      window.setTimeout(ciclo, 500);
    }
  }

  /* -------------------------- fluxo do pipeline ---------------------------
     Percorre as etapas destacando uma de cada vez, para o cartão parecer
     uma operação em andamento em vez de uma lista parada. */

  var pipeline = document.querySelector("[data-pipeline]");

  if (pipeline && !semAnimacao) {
    var etapas = pipeline.querySelectorAll(".pipe-row");
    var atual = 0;

    if (etapas.length) {
      window.setInterval(function () {
        etapas[atual].classList.remove("ativa");
        atual = (atual + 1) % etapas.length;
        etapas[atual].classList.add("ativa");
      }, 1600);
    }
  }
})();
