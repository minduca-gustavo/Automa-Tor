// ==UserScript==
// @name         PJe-Calc — Gravador de Telas
// @namespace    trt15.sc-bauru.pjc
// @version      2.0
// @description  Grava campos e vocabulários das telas do PJe-Calc enquanto você navega. A sessão sobrevive à troca de página; cada tela vira uma seção do registro.
// @match        *://*/pjecalc/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

/*
 * Como usar
 *   1. Clique em "Iniciar captura". O estado da tela atual é registrado.
 *   2. Navegue à vontade — trocar de página NÃO interrompe a gravação. Cada
 *      tela vira uma seção própria, nomeada pelo título do PJe-Calc.
 *   3. Clique em "Parar e baixar" (em qualquer página) para salvar o JSON.
 *
 * Persistência: a sessão fica em GM_setValue, o armazenamento do Tampermonkey,
 * que sobrevive a recarga e vale para todas as abas do mesmo script. Se o
 * @grant não estiver disponível, cai para localStorage automaticamente.
 *
 * Cada seção guarda a UNIÃO de tudo que apareceu naquela tela: campo que some
 * permanece com o que já se viu dele, e as opções de um combo vão se somando ao
 * longo dos cliques. É isso que revela o vocabulário inteiro de um formulário
 * adaptativo.
 *
 * Compatibilidade: o PJe-Calc carrega Prototype.js, que sobrescreve
 * NodeList.prototype.forEach. Aqui só há laços for comuns, sem element.closest
 * e sem CSS.escape.
 */

(function () {
  "use strict";

  var CHAVE = "pjecalc_gravador_sessao";
  var sessao = null;          // null = parado
  var observador = null, timer = null, pendente = null;
  var painel, botaoIniciar, botaoParar, contador, etiqueta;

  // ---------------------------------------------------------- persistência ---

  var temGM = (typeof GM_setValue === "function" && typeof GM_getValue === "function");

  function guardar(v) {
    var txt = JSON.stringify(v);
    if (temGM) GM_setValue(CHAVE, txt);
    else localStorage.setItem(CHAVE, txt);
  }

  function recuperar() {
    var txt = temGM ? GM_getValue(CHAVE, "") : localStorage.getItem(CHAVE);
    if (!txt) return null;
    try { return JSON.parse(txt); } catch (e) { return null; }
  }

  function esquecer() {
    if (temGM) GM_deleteValue(CHAVE);
    else localStorage.removeItem(CHAVE);
  }

  // Grava com folga: salvar a cada amostra encareceria a navegação sem ganho,
  // já que o risco real é a troca de página, não o clique.
  var salvamentoPendente = null;
  function salvarLogo() {
    if (salvamentoPendente) return;
    salvamentoPendente = setTimeout(function () {
      salvamentoPendente = null;
      if (sessao) guardar(sessao);
    }, 400);
  }

  // ------------------------------------------------------------ utilidades ---

  function lista(seletor, raiz) {
    var n = (raiz || document).querySelectorAll(seletor), a = [], i;
    for (i = 0; i < n.length; i++) a.push(n[i]);
    return a;
  }

  function trim(s) {
    return String(s == null ? "" : s).replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
  }

  function curto(nome) {
    var p = String(nome || "").split(":");
    return p[p.length - 1];
  }

  function visivel(el) {
    if (!el) return false;
    if (el.offsetWidth || el.offsetHeight) return true;
    var r = el.getClientRects();
    return !!(r && r.length);
  }

  function subir(el, niveis) {
    var p = el, i;
    for (i = 0; i < niveis && p && p.parentNode; i++) p = p.parentNode;
    return p;
  }

  function rotulo(el, labels) {
    var i, p;
    if (el.id) {
      for (i = 0; i < labels.length; i++) {
        if (labels[i].htmlFor === el.id) return trim(labels[i].textContent);
      }
    }
    p = subir(el, 2);
    return p ? trim(p.textContent).slice(0, 60) : "";
  }

  /* Nome da seção. A barra do PJe-Calc marca a tela com .textoTitulo (e a
     .menuImage* indica o módulo); junto dão um rótulo estável como
     "Cálculo > Parâmetros de Atualização". Os alternativos existem porque nem
     toda tela do sistema monta essa barra. */
  function nomeDaTela() {
    var i, el, partes = [], vistos = {};
    var candidatos = lista("[class*=textoTitulo]").concat(lista("[class*=menuImage]"));
    for (i = 0; i < candidatos.length; i++) {
      el = candidatos[i];
      if (!visivel(el)) continue;
      var t = trim(el.textContent);
      if (t && t.length < 80 && !vistos[t]) { partes.push(t); vistos[t] = true; }
    }
    if (partes.length) return partes.join(" > ").slice(0, 100);

    var b = document.getElementById("barraTitulo");
    if (b && trim(b.textContent)) return trim(b.textContent).slice(0, 100);
    var h = document.querySelector("h1, h2, .rich-panel-header");
    if (h && trim(h.textContent)) return trim(h.textContent).slice(0, 80);
    return location.pathname.split("/").pop() || "tela";
  }

  // ------------------------------------------------------------- varredura ---

  function varrer() {
    var campos = {}, labels = lista("label"), i, j, el, nome, o, opcoes;

    var selects = lista("select");
    for (i = 0; i < selects.length; i++) {
      el = selects[i];
      if (!visivel(el)) continue;
      opcoes = [];
      for (j = 0; j < el.options.length; j++) {
        o = el.options[j];
        if (String(o.value).indexOf("NoSelectionConverter") >= 0) continue;
        opcoes.push({ valor: o.value, texto: trim(o.text) });
      }
      campos[curto(el.name || el.id)] = {
        tipo: "select", rotulo: rotulo(el, labels),
        opcoes: opcoes, selecionados: el.value ? [el.value] : []
      };
    }

    var radios = lista("input[type=radio]");
    for (i = 0; i < radios.length; i++) {
      el = radios[i];
      if (!visivel(el)) continue;
      nome = curto(el.name);
      if (!campos[nome]) {
        campos[nome] = { tipo: "radio", rotulo: "", opcoes: [], selecionados: [] };
      }
      campos[nome].opcoes.push({ valor: el.value, texto: rotulo(el, labels) });
      if (el.checked) campos[nome].selecionados.push(el.value);
    }

    var checks = lista("input[type=checkbox]");
    for (i = 0; i < checks.length; i++) {
      el = checks[i];
      if (!visivel(el)) continue;
      campos[curto(el.name || el.id)] = {
        tipo: "checkbox", rotulo: rotulo(el, labels),
        estados: [String(!!el.checked)]
      };
    }

    var textos = lista("input[type=text]").concat(lista("textarea"));
    for (i = 0; i < textos.length; i++) {
      el = textos[i];
      if (!visivel(el)) continue;
      campos[curto(el.name || el.id)] = {
        tipo: "texto", rotulo: rotulo(el, labels),
        exemplos: el.value ? [el.value] : []
      };
    }

    return campos;
  }

  // ------------------------------------------------------------------ união ---

  function juntarEmLista(destino, origem, chave) {
    var vistos = {}, i, novos = 0;
    for (i = 0; i < destino.length; i++) vistos[destino[i][chave]] = true;
    for (i = 0; i < origem.length; i++) {
      if (!vistos[origem[i][chave]]) {
        destino.push(origem[i]);
        vistos[origem[i][chave]] = true;
        novos++;
      }
    }
    return novos;
  }

  function juntarSimples(destino, origem) {
    var i, novos = 0;
    for (i = 0; i < origem.length; i++) {
      if (destino.indexOf(origem[i]) < 0) { destino.push(origem[i]); novos++; }
    }
    return novos;
  }

  function secaoAtual() {
    var nome = nomeDaTela();
    if (!sessao.secoes[nome]) {
      sessao.secoes[nome] = {
        url: location.pathname,
        primeiraVez: new Date().toISOString(),
        campos: {},
        mudancas: 0
      };
      sessao.ordem.push(nome);
    }
    return sessao.secoes[nome];
  }

  function fundir(secao, campos) {
    var novidades = 0, nome, novo, atual;
    for (nome in campos) {
      if (!campos.hasOwnProperty(nome)) continue;
      novo = campos[nome];
      atual = secao.campos[nome];
      if (!atual) { secao.campos[nome] = novo; novidades++; continue; }
      if (novo.rotulo && !atual.rotulo) atual.rotulo = novo.rotulo;
      if (novo.opcoes) {
        novidades += juntarEmLista(atual.opcoes || (atual.opcoes = []), novo.opcoes, "valor");
      }
      if (novo.selecionados) {
        novidades += juntarSimples(atual.selecionados || (atual.selecionados = []), novo.selecionados);
      }
      if (novo.estados) {
        novidades += juntarSimples(atual.estados || (atual.estados = []), novo.estados);
      }
      if (novo.exemplos && novo.exemplos.length) {
        novidades += juntarSimples(atual.exemplos || (atual.exemplos = []), novo.exemplos);
      }
    }
    return novidades;
  }

  function amostrar() {
    if (!sessao) return;
    var secao = secaoAtual();
    var n = fundir(secao, varrer());
    sessao.amostras++;
    if (n > 0) {
      secao.mudancas++;
      salvarLogo();
      atualizar(true);
    } else {
      atualizar(false);
    }
  }

  // ------------------------------------------------------------------ painel ---

  function estilo(el, css) {
    var k;
    for (k in css) if (css.hasOwnProperty(k)) el.style[k] = css[k];
  }

  function criarPainel() {
    painel = document.createElement("div");
    estilo(painel, {
      position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647",
      background: "#ffffff", border: "1px solid #b9c4cd", borderRadius: "3px",
      boxShadow: "0 2px 10px rgba(0,0,0,.18)", padding: "10px 12px",
      font: "13px system-ui, Segoe UI, Roboto, sans-serif", color: "#16212b",
      minWidth: "220px", maxWidth: "260px"
    });

    var titulo = document.createElement("div");
    titulo.textContent = "Gravador PJe-Calc";
    estilo(titulo, {
      fontWeight: "600", marginBottom: "8px", fontSize: "11.5px",
      letterSpacing: ".05em", textTransform: "uppercase", color: "#5d6d7b"
    });
    painel.appendChild(titulo);

    botaoIniciar = document.createElement("button");
    botaoIniciar.textContent = "Iniciar captura";
    botaoParar = document.createElement("button");
    botaoParar.textContent = "Parar e baixar";

    var botoes = [botaoIniciar, botaoParar], i, b;
    for (i = 0; i < botoes.length; i++) {
      b = botoes[i];
      estilo(b, {
        display: "block", width: "100%", marginBottom: "6px", padding: "7px 10px",
        font: "inherit", cursor: "pointer", borderRadius: "2px",
        border: "1px solid #b9c4cd", background: "#f7f9fa"
      });
      painel.appendChild(b);
    }

    etiqueta = document.createElement("div");
    estilo(etiqueta, {
      fontSize: "11px", color: "#16212b", marginTop: "2px",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
    });
    painel.appendChild(etiqueta);

    contador = document.createElement("div");
    estilo(contador, {
      fontSize: "11.5px", color: "#5d6d7b", marginTop: "3px",
      fontFamily: "ui-monospace, Consolas, monospace"
    });
    painel.appendChild(contador);

    botaoIniciar.addEventListener("click", iniciar);
    botaoParar.addEventListener("click", parar);
    document.body.appendChild(painel);
  }

  function atualizar(piscar) {
    if (!sessao) {
      botaoIniciar.disabled = false;
      botaoParar.disabled = true;
      estilo(botaoIniciar, { background: "#1f4b73", borderColor: "#1f4b73", color: "#fff" });
      estilo(botaoParar, { background: "#f7f9fa", borderColor: "#b9c4cd", color: "#16212b" });
      etiqueta.textContent = "";
      contador.textContent = "parado";
      return;
    }
    botaoIniciar.disabled = true;
    botaoParar.disabled = false;
    estilo(botaoIniciar, { background: "#f7f9fa", borderColor: "#b9c4cd", color: "#16212b" });
    estilo(botaoParar, { background: "#9b2c2c", borderColor: "#9b2c2c", color: "#fff" });

    var nome = nomeDaTela();
    etiqueta.textContent = nome;
    etiqueta.title = nome;

    var totalCampos = 0, s, k, c;
    for (k in sessao.secoes) {
      if (!sessao.secoes.hasOwnProperty(k)) continue;
      s = sessao.secoes[k];
      for (c in s.campos) if (s.campos.hasOwnProperty(c)) totalCampos++;
    }
    contador.textContent = sessao.ordem.length + " telas · " + totalCampos + " campos";

    if (piscar) {
      estilo(painel, { borderColor: "#2f6b4f" });
      setTimeout(function () { estilo(painel, { borderColor: "#b9c4cd" }); }, 400);
    }
  }

  // ------------------------------------------------------------- gravação ---

  function ligarSensores() {
    // O RichFaces repinta trechos da árvore por AJAX; o observador pega isso.
    // O intervalo cobre repintura que só troca valores, sem mexer na estrutura.
    observador = new MutationObserver(function () { agendar(); });
    observador.observe(document.body, { childList: true, subtree: true, attributes: true });
    timer = setInterval(amostrar, 1500);
    document.addEventListener("change", agendar, true);
    window.addEventListener("beforeunload", function () {
      if (sessao) guardar(sessao);
    });
  }

  function agendar() {
    if (!sessao) return;
    if (pendente) clearTimeout(pendente);
    pendente = setTimeout(function () { pendente = null; amostrar(); }, 250);
  }

  function iniciar() {
    sessao = {
      gravador: "PJe-Calc 2.0",
      inicio: new Date().toISOString(),
      ordem: [],
      secoes: {},
      amostras: 0
    };
    guardar(sessao);
    ligarSensores();
    amostrar();
  }

  function retomar(anterior) {
    sessao = anterior;
    ligarSensores();
    amostrar();
  }

  function parar() {
    if (!sessao) return;
    if (observador) { observador.disconnect(); observador = null; }
    if (timer) { clearInterval(timer); timer = null; }
    sessao.fim = new Date().toISOString();

    var txt = JSON.stringify(sessao, null, 1);
    var base = (sessao.ordem.length === 1 ? sessao.ordem[0] : "sessao");
    var nome = "pjecalc-" + base.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()
      .replace(/^-+|-+$/g, "").slice(0, 45) + ".json";

    var a = document.createElement("a");
    a.href = "data:application/json;charset=utf-8," + encodeURIComponent(txt);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    var telas = sessao.ordem.length;
    sessao = null;
    esquecer();
    atualizar(false);
    contador.textContent = telas + " telas · " + txt.length + " bytes";
  }

  // ---------------------------------------------------------------- partida ---

  function partir() {
    criarPainel();
    var anterior = recuperar();
    if (anterior && anterior.secoes) retomar(anterior);
    else atualizar(false);
  }

  if (document.body) partir();
  else window.addEventListener("DOMContentLoaded", partir);
})();