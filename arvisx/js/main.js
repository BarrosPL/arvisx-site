/* ==========================================================================
   ARVISX AI — comportamento do site.

   Sem framework e sem dependência: são cinco comportamentos pequenos e
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
