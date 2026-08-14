/*
 * capturar-tela-pjecalc.js  (v2)
 *
 * Cole no console do PJe-Calc (F12 > Console), com o formulário aberto, e
 * pressione Enter.
 *
 *   capturar("verba calculada, base salário mínimo")
 *   ... clica nas opções, a tela muda ...
 *   capturar("verba informada, 13º salário")
 *   copiar()          // ou baixar()
 *
 * v2: escrito sem forEach em NodeList, sem element.closest e sem CSS.escape.
 * O PJe-Calc carrega Prototype.js junto do RichFaces, e o Prototype substitui
 * NodeList.prototype.forEach por um método que espera a assinatura do each()
 * dele — daí o "this.each is not a function". Aqui só há laços for comuns.
 */

(function () {
  var W = window;
  W.__pjc = W.__pjc || { tela: location.pathname, capturas: [] };

  function lista(seletor) {
    var n = document.querySelectorAll(seletor), a = [], i;
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

  var LABELS = null;

  function rotulo(el) {
    var i, p;
    if (el.id) {
      if (!LABELS) LABELS = lista("label");
      for (i = 0; i < LABELS.length; i++) {
        if (LABELS[i].htmlFor === el.id) return trim(LABELS[i].textContent);
      }
    }
    p = subir(el, 2);
    return p ? trim(p.textContent).slice(0, 60) : "";
  }

  W.capturar = function (etiqueta) {
    LABELS = null;
    var campos = {}, i, j, el, nome, opts, o;

    var selects = lista("select");
    for (i = 0; i < selects.length; i++) {
      el = selects[i];
      if (!visivel(el)) continue;
      opts = [];
      for (j = 0; j < el.options.length; j++) {
        o = el.options[j];
        if (String(o.value).indexOf("NoSelectionConverter") >= 0) continue;
        opts.push({ valor: o.value, texto: trim(o.text) });
      }
      campos[curto(el.name || el.id)] = {
        tipo: "select", opcoes: opts, selecionado: el.value
      };
    }

    var radios = lista("input[type=radio]");
    for (i = 0; i < radios.length; i++) {
      el = radios[i];
      if (!visivel(el)) continue;
      nome = curto(el.name);
      if (!campos[nome]) campos[nome] = { tipo: "radio", opcoes: [], selecionado: null };
      campos[nome].opcoes.push({ valor: el.value, texto: rotulo(el) });
      if (el.checked) campos[nome].selecionado = el.value;
    }

    var checks = lista("input[type=checkbox]");
    for (i = 0; i < checks.length; i++) {
      el = checks[i];
      if (!visivel(el)) continue;
      campos[curto(el.name || el.id)] = {
        tipo: "checkbox", rotulo: rotulo(el), marcado: !!el.checked
      };
    }

    var textos = lista("input[type=text]").concat(lista("textarea"));
    for (i = 0; i < textos.length; i++) {
      el = textos[i];
      if (!visivel(el)) continue;
      campos[curto(el.name || el.id)] = {
        tipo: "texto", rotulo: rotulo(el), valor: el.value
      };
    }

    var barra = document.getElementById("barraTitulo");
    W.__pjc.capturas.push({
      etiqueta: etiqueta || "sem etiqueta",
      titulo: barra ? trim(barra.textContent) : "",
      campos: campos
    });

    var n = 0, k;
    for (k in campos) if (campos.hasOwnProperty(k)) n++;
    console.log("capturado: " + (etiqueta || "sem etiqueta") + " (" + n +
      " campos). Total de capturas: " + W.__pjc.capturas.length);
    return campos;
  };

  W.copiar = function () {
    var txt = JSON.stringify(W.__pjc, null, 1);
    try {
      copy(txt);   // função do console do navegador
      console.log("copiado para a área de transferência: " + txt.length + " bytes");
    } catch (e) {
      console.log("copy() indisponível — use baixar(), ou copie o JSON abaixo:");
      console.log(txt);
    }
    return txt.length;
  };

  W.baixar = function (nomeArquivo) {
    var txt = JSON.stringify(W.__pjc, null, 1);
    var a = document.createElement("a");
    a.href = "data:application/json;charset=utf-8," + encodeURIComponent(txt);
    a.download = nomeArquivo || "capturas-pjecalc.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log("baixado: " + a.download + " (" + txt.length + " bytes)");
  };

  W.limpar = function () {
    W.__pjc = { tela: location.pathname, capturas: [] };
    console.log("capturas zeradas");
  };

  console.log('pronto. use capturar("rótulo"), depois copiar() ou baixar().');
})();