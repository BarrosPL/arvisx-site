/* ==========================================================================
   ARVISX AI — comportamento das páginas editoriais.

   Carrega depois de main.js no índice do blog, nos artigos e no guia de
   funil. Dois comportamentos, ambos opcionais:

   1. filtro por categoria no índice do blog;
   2. marcação do item ativo no sumário lateral do artigo.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------- filtro de categorias ---------------------------- */

  var barra = document.querySelector("[data-filtros]");
  var grade = document.querySelector("[data-posts]");

  if (barra && grade) {
    var contador = document.querySelector("[data-contador]");
    var cartoes = Array.prototype.slice.call(grade.querySelectorAll("article"));
    var vazio = grade.querySelector(".blog-vazio");

    var filtrar = function (categoria) {
      var visiveis = 0;

      cartoes.forEach(function (cartao) {
        var combina = categoria === "todos" || cartao.dataset.categoria === categoria;
        cartao.hidden = !combina;
        if (combina) visiveis++;
      });

      if (vazio) vazio.hidden = visiveis > 0;

      if (contador) {
        contador.textContent = visiveis + (visiveis === 1 ? " conteúdo" : " conteúdos");
      }
    };

    barra.addEventListener("click", function (evento) {
      var botao = evento.target.closest("button[data-categoria]");
      if (!botao) return;

      barra.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("ativo", b === botao);
        b.setAttribute("aria-pressed", String(b === botao));
      });

      filtrar(botao.dataset.categoria);
    });
  }

  /* ------------------------- sumário do artigo ---------------------------- */

  var indice = document.querySelector("[data-indice]");

  if (indice && "IntersectionObserver" in window) {
    var itens = Array.prototype.slice.call(indice.querySelectorAll("a[href^='#']"));

    var secoes = itens
      .map(function (item) {
        return document.getElementById(decodeURIComponent(item.hash.slice(1)));
      })
      .filter(Boolean);

    if (secoes.length) {
      /* Guarda quais seções estão na tela e destaca sempre a primeira delas,
         para o sumário não ficar piscando entre duas ao rolar devagar. */
      var naTela = new Set();

      var observador = new IntersectionObserver(
        function (entradas) {
          entradas.forEach(function (entrada) {
            if (entrada.isIntersecting) naTela.add(entrada.target.id);
            else naTela.delete(entrada.target.id);
          });

          var ativa = secoes
            .map(function (secao) {
              return secao.id;
            })
            .find(function (id) {
              return naTela.has(id);
            });

          itens.forEach(function (item) {
            item.classList.toggle("ativo", ativa !== undefined && item.hash === "#" + ativa);
          });
        },
        { rootMargin: "-120px 0px -55% 0px" },
      );

      secoes.forEach(function (secao) {
        observador.observe(secao);
      });
    }
  }
})();
