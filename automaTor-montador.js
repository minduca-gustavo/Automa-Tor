/*
 * pjc-montador.js — converte uma Ficha de Liquidação (JSON) em arquivo .pjc
 * importável pelo PJe-Calc.
 *
 * Divisão de responsabilidades:
 *   LLM        → lê a sentença e preenche a Ficha (nomes, datas ISO, valores)
 *   este módulo→ ids, internalRef, epoch, forma canônica, escape, zip, validação
 *   PJe-Calc   → apura os valores (o arquivo entra sem nenhum valor calculado)
 *
 * Funciona em navegador (extensão) e em Node. No navegador o DOMParser e o
 * XMLSerializer são nativos; em Node injete os de @xmldom/xmldom via
 * configurarDom(). O deflate também é injetado — CompressionStream no
 * navegador, zlib.deflateRawSync em Node.
 *
 * Regras de formato descobertas por engenharia reversa e confirmadas por
 * importação real (variantes D, E, F e G):
 *   - o arquivo dispensa todo dado calculado; o PJe-Calc reconstrói
 *   - os ids são livres, desde que todo internalRef aponte para um id existente
 *   - cada objeto é declarado uma única vez; as demais menções são internalRef
 *   - hash e usuarioCriador são dispensáveis
 *   - datas são epoch em ms, à meia-noite de America/Sao_Paulo
 *   - o .pjc é um zip de uma entrada só, de mesmo nome do arquivo externo
 */

(function (raiz, definir) {
  if (typeof module === "object" && module.exports) module.exports = definir();
  else raiz.PjcMontador = definir();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var Dom = {
    parser: typeof DOMParser !== "undefined" ? new DOMParser() : null,
    serializer: typeof XMLSerializer !== "undefined" ? new XMLSerializer() : null
  };

  function configurarDom(parser, serializer) {
    Dom.parser = parser;
    Dom.serializer = serializer;
  }

  // ---------------------------------------------------------------- datas ---

  var TZ = "America/Sao_Paulo";

  function deslocamentoMs(instante) {
    // Offset do fuso no instante dado, obtido do ICU — cobre o horário de
    // verão histórico, que valeu no Brasil até 2019 e afeta contratos antigos.
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    var p = {};
    fmt.formatToParts(new Date(instante)).forEach(function (x) { p[x.type] = x.value; });
    var local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return local - instante;
  }

  function paraEpoch(iso) {
    if (iso === null || iso === undefined || iso === "") return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
    if (!m) throw new ErroDeFicha("data fora do formato AAAA-MM-DD: " + iso);
    var utc = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var ts = utc;
    for (var i = 0; i < 3; i++) ts = utc - deslocamentoMs(ts);
    return ts;
  }

  function deEpoch(ms) {
    if (ms === null || ms === "null" || ms === undefined) return null;
    var d = new Date(+ms + deslocamentoMs(+ms));
    return d.toISOString().slice(0, 10);
  }

  // ------------------------------------------------------------ utilidades ---

  function ErroDeFicha(msg) {
    this.name = "ErroDeFicha";
    this.message = msg;
  }
  ErroDeFicha.prototype = Object.create(Error.prototype);

  function filho(no, nome) {
    for (var i = 0; i < no.childNodes.length; i++) {
      var c = no.childNodes[i];
      if (c.nodeType === 1 && c.nodeName === nome) return c;
    }
    return null;
  }

  function caminho(no, expr) {
    var partes = expr.split("/");
    var atual = no;
    for (var i = 0; i < partes.length && atual; i++) atual = filho(atual, partes[i]);
    return atual;
  }

  function texto(no, expr, valor) {
    var alvo = expr ? caminho(no, expr) : no;
    if (!alvo) return null;
    if (valor === undefined) return alvo.textContent;
    while (alvo.firstChild) alvo.removeChild(alvo.firstChild);
    alvo.appendChild(alvo.ownerDocument.createTextNode(
      valor === null ? "null" : String(valor)));
    return alvo;
  }

  function limpar(no) {
    while (no.firstChild) no.removeChild(no.firstChild);
    return no;
  }

  /* Todo objeto novo precisa de <id> próprio. Emitir <id>0</id> em vários
     fragmentos fazia a renumeração mapear todos para o MESMO número: o
     deserializador então lia várias ocorrências como um só objeto e a coleção
     chegava truncada ao PJe-Calc — foi assim que um histórico salarial com duas
     competências virou nenhuma. Este contador dá a cada fragmento um id
     provisório único, bem acima dos ids do esqueleto; a renumeração final
     recompacta tudo. */
  var proximoIdNovo = 900000;

  function idNovo() {
    return String(proximoIdNovo++);
  }

  function fragmento(doc, xml) {
    var d = Dom.parser.parseFromString("<raiz>" + xml + "</raiz>", "text/xml");
    return doc.importNode(d.documentElement.firstChild, true);
  }

  /* Clonar um molde copia junto os ids da verba que lhe deu origem. Com quatro
     verbas saídas do mesmo molde, quatro objetos distintos passavam a declarar
     o mesmo id — e o deserializador, que resolve objeto por id, lia os quatro
     como um só. Todo clone recebe ids próprios aqui, com as referências
     internas ao próprio fragmento acompanhando a troca. */
  function reidentificar(no) {
    var mapa = {}, i, n, v;
    var nos = no.getElementsByTagName("*");
    var todos = [no];
    for (i = 0; i < nos.length; i++) todos.push(nos[i]);

    for (i = 0; i < todos.length; i++) {
      n = todos[i];
      if (n.nodeName === "id") {
        v = (n.textContent || "").trim();
        if (/^\d+$/.test(v) && mapa[v] === undefined) mapa[v] = idNovo();
      }
    }
    for (i = 0; i < todos.length; i++) {
      n = todos[i];
      if (n.nodeName === "id" || n.nodeName === "internalRef") {
        v = (n.textContent || "").trim();
        if (mapa[v] !== undefined) n.textContent = mapa[v];
      }
    }
    return no;
  }

  // -------------------------------------------------------------- validação ---

  // Vocabulários extraídos dos formulários do PJe-Calc (Cálculo > Verbas > Novo),
  // não inferidos. Alterar só contra nova evidência de tela.
  /* Vocabulários e sinônimos vêm de automaTor-vocabulario.js, gerado a partir
     das capturas de tela do PJe-Calc. Manter lista aqui dentro foi o que
     deixou passar destinoDoFgts="CONTA_VINCULADA": duas fontes de verdade,
     uma delas desatualizada. */
  var VOCABULARIO = (typeof PJC_VOCABULARIO !== "undefined") ? PJC_VOCABULARIO : {};
  var SINONIMOS = (typeof PJC_SINONIMOS !== "undefined") ? PJC_SINONIMOS : {};
  var CAMPO_VOC = (typeof PJC_CAMPO_PARA_VOCABULARIO !== "undefined")
    ? PJC_CAMPO_PARA_VOCABULARIO : {};

  function listaDe(nome) {
    var chave = CAMPO_VOC[nome] || nome;
    return VOCABULARIO[chave] || [];
  }

  function semAcento(t) {
    return String(t).normalize ? String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                               : String(t);
  }

  function padronizar(valor, lista) {
    if (valor === null || valor === undefined) return valor;
    var v = semAcento(valor).toUpperCase().replace(/[\s-]+/g, "_");
    var valores = listaDe(lista);
    if (valores.indexOf(v) >= 0) return v;
    var alvo = SINONIMOS[v];
    if (alvo && valores.indexOf(alvo) >= 0) return alvo;
    return valor;
  }

  function exigir(cond, msg) {
    if (!cond) throw new ErroDeFicha(msg);
  }

  function exigirVocabulario(campo, valor, lista) {
    exigir(listaDe(lista).indexOf(valor) >= 0,
      campo + ": \"" + valor + "\" não pertence ao vocabulário (" +
      listaDe(lista).join(", ") + ")");
  }

  /* Acumula TODOS os problemas antes de falhar. Uma Ficha recém-gerada costuma
     ter vários; devolver um por vez transformaria a correção em dezenas de
     idas e vindas com a LLM. */
  function validarFicha(ficha) {
    var erros = [], avisos = [];

    // Preenche o que o PJe-Calc já traria pronto na tela. Roda antes das
    // exigências para que a Ficha só seja cobrada do que a decisão determina.
    if (typeof pjcAplicarPadroes === "function") {
      avisos = avisos.concat(pjcAplicarPadroes(ficha));
    }

    function checar(cond, msg) { if (!cond) erros.push(msg); return !!cond; }

    // Padroniza em cima do próprio objeto: o resto da montagem lê o valor já
    // canônico, e a divergência vira aviso em vez de rodada de correção.
    function checarVocabulario(dono, campo, lista, rotulo) {
      var valor = dono ? dono[campo] : undefined;
      if (valor === undefined || valor === null) return;
      var bom = padronizar(valor, lista);
      var valores = listaDe(lista);
      if (!valores.length) return;          // vocabulário não capturado: não barra
      if (valores.indexOf(bom) < 0) {
        erros.push(rotulo + ": \"" + valor + "\" não pertence ao vocabulário (" +
          valores.join(", ") + ")");
        return;
      }
      if (bom !== valor) {
        avisos.push(rotulo + ": \"" + valor + "\" interpretado como \"" + bom + "\"");
        dono[campo] = bom;
      }
    }

    function dataValida(campo, v) {
      if (!v) return null;
      try { return paraEpoch(v); } catch (e) { erros.push(campo + ": " + e.message); return null; }
    }

    if (!ficha || typeof ficha !== "object") throw new ErroDeFicha("Ficha vazia ou inválida");
    checar(ficha.anexo, "anexo: informe a versão do Anexo Técnico (ex.: \"PJC-1.1\")");

    var p = ficha.processo || {};
    if (checar(p.numeroCNJ, "processo.numeroCNJ é obrigatório")) {
      checar(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(p.numeroCNJ),
        "processo.numeroCNJ fora do padrão CNJ 0000000-00.0000.0.00.0000");
    }

    var c = ficha.contrato || {};
    checar(c.admissao, "contrato.admissao é obrigatório");
    checar(c.dataLiquidacao, "contrato.dataLiquidacao é obrigatório");
    var eAdm = dataValida("contrato.admissao", c.admissao);
    var eDem = dataValida("contrato.demissao", c.demissao);
    dataValida("contrato.dataLiquidacao", c.dataLiquidacao);
    if (eAdm && eDem) checar(eDem >= eAdm, "contrato.demissao anterior à admissão");
    checarVocabulario(c, "regime", "regime", "contrato.regime");
    checarVocabulario(c, "prazoAvisoPrevio", "prazoAvisoPrevio", "contrato.prazoAvisoPrevio");

    var u = ficha.atualizacao || {};
    checarVocabulario(u, "indiceTrabalhista", "indice", "atualizacao.indiceTrabalhista");
    checarVocabulario(u, "juros", "juros", "atualizacao.juros");
    (u.combinacoesDeIndice || []).forEach(function (x, i) {
      checarVocabulario(x, "indice", "indice", "atualizacao.combinacoesDeIndice[" + i + "].indice");
      dataValida("atualizacao.combinacoesDeIndice[" + i + "].apartirDe", x.apartirDe);
    });
    (u.combinacoesDeJuros || []).forEach(function (x, i) {
      checarVocabulario(x, "juros", "juros", "atualizacao.combinacoesDeJuros[" + i + "].juros");
      dataValida("atualizacao.combinacoesDeJuros[" + i + "].apartirDe", x.apartirDe);
    });

    if (ficha.encargos && typeof ficha.encargos.fgts === "string") {
      avisos.push("encargos.fgts veio como texto (\"" + ficha.encargos.fgts +
        "\") e foi lido como destino do depósito");
      ficha.encargos.fgts = { destino: ficha.encargos.fgts };
    }
    if (ficha.encargos && ficha.encargos.fgts) {
      checarVocabulario(ficha.encargos.fgts, "destino", "destinoDoFgts", "encargos.fgts.destino");
    }

    if (!checar(Array.isArray(ficha.verbas) && ficha.verbas.length > 0,
        "a Ficha precisa de ao menos uma verba")) {
      throw new ErroDeFicha(montarRelatorio(erros));
    }

    var nomes = {};
    ficha.verbas.forEach(function (v, i) {
      var onde = "verbas[" + i + "]" + (v.nome ? " (" + v.nome + ")" : "");
      if (checar(v.nome, onde + ": nome é obrigatório")) {
        checar(!nomes[v.nome], onde + ": nome repetido — os reflexos referenciam a verba pelo nome");
        nomes[v.nome] = true;
      }
      checarVocabulario(v, "tipo", "tipoVerba", onde + ".tipo");
      checar(v.tipo, onde + ": tipo é obrigatório");
      checar(v.assuntoCnj, onde + ": assuntoCnj é obrigatório");
      checarVocabulario(v, "natureza", "natureza", onde + ".natureza");
      checarVocabulario(v, "caracteristica", "caracteristica", onde + ".caracteristica");
      checarVocabulario(v, "ocorrenciaDePagamento", "ocorrenciaDePagamento", onde + ".ocorrenciaDePagamento");
      if (v.valorPago) checarVocabulario(v.valorPago, "tipo", "valorPago", onde + ".valorPago.tipo");
      if (v.periodo) {
        var pi = dataValida(onde + ".periodo.inicio", v.periodo.inicio);
        dataValida(onde + ".periodo.fim", v.periodo.fim);
        if (pi && eAdm && pi < eAdm) avisos.push(onde + ": período começa antes da admissão");
      }

      if (v.tipo === "CALCULADA") {
        if (checar(v.base && v.base.tipo,
            onde + ": verba CALCULADA exige base.tipo — sem ela o PJe-Calc não sabe sobre o que calcular")) {
          checarVocabulario(v.base, "tipo", "base", onde + ".base.tipo");
        }
        checar(v.divisor && v.divisor.tipo, onde + ": verba CALCULADA exige divisor.tipo");
        if (v.divisor) checarVocabulario(v.divisor, "tipo", "divisor", onde + ".divisor.tipo");
        checar(v.multiplicador != null, onde + ": verba CALCULADA exige multiplicador");
        if (checar(v.quantidade && v.quantidade.tipo, onde + ": verba CALCULADA exige quantidade.tipo")) {
          checarVocabulario(v.quantidade, "tipo", "quantidade", onde + ".quantidade.tipo");
        }
      } else if (v.tipo === "INFORMADA") {
        checar(typeof v.valor === "number",
          onde + ": verba INFORMADA exige valor numérico. Se o título não fixou " +
          "quantia — saldo de salário, diferenças, verbas apuradas por dias —, " +
          "a verba é CALCULADA, com base, divisor, multiplicador e quantidade");
      } else if (v.tipo === "REFLEXO") {
        checar(Array.isArray(v.baseVerbas) && v.baseVerbas.length,
          onde + ": verba REFLEXO exige baseVerbas — a lista de verbas sobre as quais ela repercute");
        checarVocabulario(v, "comportamento", "comportamentoDoReflexo", onde + ".comportamento");
      }

      if (!v.fonte) avisos.push(onde + ": sem fonte nos autos");
    });

    ficha.verbas.forEach(function (v, i) {
      var onde = "verbas[" + i + "]" + (v.nome ? " (" + v.nome + ")" : "");
      (v.baseVerbas || []).forEach(function (n) {
        checar(nomes[n], onde + ": baseVerbas aponta para \"" + n + "\", que não existe na Ficha");
      });
      if (v.base && Array.isArray(v.base.historicos)) {
        v.base.historicos.forEach(function (n) {
          var achou = (ficha.historicosSalariais || []).some(function (h) { return h.nome === n; });
          checar(achou, onde + ": base.historicos cita \"" + n + "\", ausente de historicosSalariais");
        });
      }
      if (v.quantidade && v.quantidade.tipo === "IMPORTADA_DO_CARTAO") {
        var ok = (ficha.cartoesDePonto || []).some(function (k) { return k.nome === v.quantidade.cartao; });
        checar(ok, onde + ": quantidade importada do cartão \"" + v.quantidade.cartao +
          "\", que não está em cartoesDePonto");
      }
      if (v.base && v.base.tipo === "HISTORICO_SALARIAL" &&
          !(ficha.historicosSalariais || []).length) {
        checar(false, onde + ": base HISTORICO_SALARIAL exige ao menos um item em historicosSalariais");
      }
    });

    /* O esqueleto nasce neutro: o que a Ficha não informa fica zerado, nunca
       herda o caso anterior. Em troca, o que o cálculo precisa tem de vir
       declarado — daí as duas exigências abaixo. */
    var usaMaior = ficha.verbas.some(function (v) {
      return v.base && v.base.tipo === "MAIOR_REMUNERACAO";
    });
    if (usaMaior) {
      checar(typeof c.maiorRemuneracao === "number" || typeof c.ultimaRemuneracao === "number",
        "contrato.maiorRemuneracao é obrigatório: há verba com base MAIOR_REMUNERACAO " +
        "e nenhuma remuneração informada — o cálculo sairia sobre zero");
    }

    var usaHistorico = ficha.verbas.some(function (v) {
      return v.base && v.base.tipo === "HISTORICO_SALARIAL";
    });
    if (usaHistorico) {
      checar((ficha.historicosSalariais || []).length > 0,
        "há verba com base HISTORICO_SALARIAL e historicosSalariais está vazio — " +
        "informe a rubrica e suas ocorrências mensais");
    }
    if (!(ficha.historicosSalariais || []).length) {
      avisos.push("Ficha sem histórico salarial: o PJe-Calc não terá evolução " +
        "salarial para reger as verbas mês a mês. Confira na importação se " +
        "isso corresponde ao título.");
    }

    if (erros.length) throw new ErroDeFicha(montarRelatorio(erros));
    return avisos;
  }

  function montarRelatorio(erros) {
    if (erros.length === 1) return erros[0];
    return erros.length + " problemas na Ficha:\n" +
      erros.map(function (e, i) { return "  " + (i + 1) + ". " + e; }).join("\n");
  }

  // -------------------------------------------------------------- montagem ---

  function aplicarCalculo(doc, ficha) {
    var C = doc.documentElement;
    var c = ficha.contrato || {};
    texto(C, "dataAdmissao", paraEpoch(c.admissao));
    texto(C, "dataDemissao", paraEpoch(c.demissao));
    texto(C, "dataAjuizamento", paraEpoch(c.ajuizamento));
    texto(C, "dataDeLiquidacao", paraEpoch(c.dataLiquidacao));
    texto(C, "dataCriacao", paraEpoch(c.dataLiquidacao));
    if (c.cargaHorariaPadrao) texto(C, "valorCargaHorariaPadrao", c.cargaHorariaPadrao);
    if (c.regime) texto(C, "regimeDoContrato", c.regime);
    if (c.ultimaRemuneracao != null) texto(C, "valorUltimaRemuneracao", c.ultimaRemuneracao);
    var maior = c.maiorRemuneracao != null ? c.maiorRemuneracao : c.ultimaRemuneracao;
    if (maior != null) texto(C, "valorMaiorRemuneracao", maior);
    if (c.sabadoDiaUtil != null) texto(C, "sabadoDiaUtil", !!c.sabadoDiaUtil);
    if (c.projetaAvisoIndenizado != null) texto(C, "projetaAvisoIndenizado", !!c.projetaAvisoIndenizado);
    if (c.prescricaoQuinquenal != null) texto(C, "prescricaoQuinquenal", !!c.prescricaoQuinquenal);
    if (c.prescricaoFgts != null) texto(C, "prescricaoFgts", !!c.prescricaoFgts);
    if (c.limitarAvos != null) texto(C, "limitarAvosAoPeriodoDoCalculo", !!c.limitarAvos);
    if (c.zeraValorNegativo != null) texto(C, "zeraValorNegativo", !!c.zeraValorNegativo);
    if (c.consideraFeriadoEstadual != null) {
      texto(C, "consideraFeriadoEstadual", !!c.consideraFeriadoEstadual);
    }
    if (c.consideraFeriadoMunicipal != null) {
      texto(C, "consideraFeriadoMunicipal", !!c.consideraFeriadoMunicipal);
    }
    if (c.prazoAvisoPrevio) texto(C, "apuracaoPrazoDoAvisoPrevio", c.prazoAvisoPrevio);
    if (c.inicioCalculo) texto(C, "dataInicioCalculo", paraEpoch(c.inicioCalculo));
    if (c.terminoCalculo) texto(C, "dataTerminoCalculo", paraEpoch(c.terminoCalculo));
    if (c.setor) texto(C, "idSetor", c.setor);

    // nunca reaproveitar estado de validação de outro cálculo
    texto(C, "hashCodeLiquidacao", "");
    texto(C, "hashCalculoCorreto", "false");
    texto(C, "hashAtualizacaoCorreto", "false");
    texto(C, "validado", "false");

    var g = filho(C, "gprec");
    if (g) {
      texto(g, "dataCalculo", paraEpoch(c.dataLiquidacao));
      texto(g, "nomeBeneficiario", (ficha.processo.reclamante || {}).nome || "");
    }
    var de = filho(C, "dadosEstruturados");
    if (de) {
      texto(de, "dataLiquidacao", paraEpoch(c.dataLiquidacao));
      texto(de, "hashLiquidacao", "");
    }
  }

  function aplicarProcesso(doc, ficha) {
    var P = caminho(doc.documentElement, "processo/Processo");
    var p = ficha.processo;
    var m = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/.exec(p.numeroCNJ);
    var ident = caminho(P, "identificador/IdentificadorDoProcesso");
    texto(ident, "numero", String(+m[1]));
    texto(ident, "digito", m[2]);
    texto(ident, "ano", m[3]);
    texto(ident, "justica", m[4]);
    texto(ident, "regiao", String(+m[5]));
    texto(ident, "vara", String(+m[6]));

    if (p.valorDaCausa != null) texto(P, "valorDaCausa", p.valorDaCausa);
    texto(P, "dataAutuacao", paraEpoch(p.dataAutuacao || (ficha.contrato || {}).ajuizamento));

    var rte = caminho(P, "reclamante/Reclamante");
    texto(rte, "nome", (p.reclamante || {}).nome || "");
    var rdo = caminho(P, "reclamado/Reclamado");
    texto(rdo, "nome", (p.reclamado || {}).nome || "");

    var lista = limpar(caminho(P, "advogadosReclamante/List"));
    (p.advogadosReclamante || []).forEach(function (a) {
      lista.appendChild(fragmento(doc,
        "<Advogado><id /><nome>" + escaparTexto(a.nome) + "</nome>" +
        "<tipoDocumento>CPF</tipoDocumento><numeroDocumento />" +
        "<numeroOAB>" + escaparTexto(a.oab || "") + "</numeroOAB>" +
        "<tipo>RECLAMANTE</tipo><processo><Processo><internalRef>@PROC@</internalRef>" +
        "</Processo></processo></Advogado>"));
    });
    var refProc = texto(P, "id");
    Array.prototype.slice.call(P.getElementsByTagName("internalRef")).forEach(function (r) {
      if (r.textContent === "@PROC@") r.textContent = refProc;
    });

    if (p.municipio) {
      var mun = caminho(doc.documentElement, "municipio/Municipio");
      if (mun) texto(mun, "externalRef", p.municipio);
    }
  }

  function aplicarAtualizacao(doc, ficha) {
    var A = caminho(doc.documentElement, "parametrosDeAtualizacao/ParametrosDeAtualizacao");
    var u = ficha.atualizacao;
    if (!A || !u) return;
    var idA = texto(A, "id");

    if (u.indiceTrabalhista) texto(A, "indiceTrabalhista", u.indiceTrabalhista);
    if (u.juros) texto(A, "juros", u.juros);
    if (u.baseDeJurosDasVerbas) texto(A, "baseDeJurosDasVerbas", u.baseDeJurosDasVerbas);

    var ci = u.combinacoesDeIndice || [];
    texto(A, "combinarOutroIndice", ci.length > 0);
    if (ci.length) {
      texto(A, "outroIndiceTrabalhista", ci[0].indice);
      texto(A, "apartirDeOutroIndice", paraEpoch(ci[0].apartirDe));
    }
    var setI = limpar(caminho(A, "listaDeCombinacaoDeIndices/Set"));
    ci.forEach(function (x) {
      setI.appendChild(fragmento(doc,
        "<CombinacaoDeIndice><id>" + idNovo() + "</id><versao>0</versao>" +
        "<outroIndiceTrabalhista>" + x.indice + "</outroIndiceTrabalhista>" +
        "<apartirDeOutroIndice>" + paraEpoch(x.apartirDe) + "</apartirDeOutroIndice>" +
        "<parametrosDeAtualizacao><ParametrosDeAtualizacao><internalRef>" + idA +
        "</internalRef></ParametrosDeAtualizacao></parametrosDeAtualizacao></CombinacaoDeIndice>"));
    });

    var cj = u.combinacoesDeJuros || [];
    texto(A, "combinarOutroJuros", cj.length > 0);
    var setJ = limpar(caminho(A, "listaDeCombinacaoDeJuros/Set"));
    cj.forEach(function (x) {
      setJ.appendChild(fragmento(doc,
        "<CombinacaoDeJuros><id>" + idNovo() + "</id><versao>0</versao>" +
        "<outroJuros>" + x.juros + "</outroJuros>" +
        "<apartirDeOutroJuros>" + paraEpoch(x.apartirDe) + "</apartirDeOutroJuros>" +
        "<parametrosDeAtualizacao><ParametrosDeAtualizacao><internalRef>" + idA +
        "</internalRef></ParametrosDeAtualizacao></parametrosDeAtualizacao></CombinacaoDeJuros>"));
    });
  }

  function aplicarPeriodos(doc, ficha) {
    var c = ficha.contrato || {};
    var ini = paraEpoch(c.admissao), fim = paraEpoch(c.demissao || c.dataLiquidacao);
    var f = caminho(doc.documentElement, "fgts/Fgts");
    if (f) {
      texto(f, "periodoInicial", ini);
      texto(f, "periodoFinal", fim);
      var e = (ficha.encargos || {}).fgts || {};
      if (e.destino) texto(f, "destinoDoFgts", e.destino);
      if (e.multa != null) texto(f, "multa", !!e.multa);
    }
    ["inss/Inss/inssSobreSalariosDevidos/InssSobreSalariosDevidos",
     "inss/Inss/inssSobreSalariosPagos/InssSobreSalariosPagos"].forEach(function (cam) {
      var n = caminho(doc.documentElement, cam);
      if (n) {
        texto(n, "dataInicioPeriodo", ini);
        texto(n, "dataTerminoPeriodo", fim);
      }
    });
    var i = caminho(doc.documentElement, "irpf/Irpf");
    if (i) {
      texto(i, "dataInicioAnosAnteriores", ini);
      texto(i, "dataFimAnosAnteriores", fim);
      texto(i, "dataInicioAnoRecebimento", paraEpoch(
        String(new Date(paraEpoch(c.dataLiquidacao)).getFullYear()) + "-01-01"));
    }
  }

  function aplicarColecoes(doc, ficha, base) {
    var C = doc.documentElement;

    var hs = limpar(caminho(C, "historicosSalariais/Set"));
    (ficha.historicosSalariais || []).forEach(function (h) {
      var no = reidentificar(fragmento(doc, base.moldes.historicoSalarial));
      texto(no, "nome", h.nome);
      texto(no, "tipoVariacaoParcela", h.variacao || "VARIAVEL");
      texto(no, "incidenciaFGTS", h.incidenciaFGTS !== false);
      texto(no, "incidenciaINSS", h.incidenciaINSS !== false);
      var lista = limpar(caminho(no, "ocorrencias/List"));
      (h.ocorrencias || []).forEach(function (o) {
        lista.appendChild(fragmento(doc,
          "<OcorrenciaDoHistoricoSalarial><id>" + idNovo() + "</id><versao>0</versao>" +
          "<dataOcorrencia>" + paraEpoch(o.data) + "</dataOcorrencia>" +
          "<valor>" + o.valor + "</valor>" +
          "<recolhidoFGTS>" + (o.recolhidoFGTS === true) + "</recolhidoFGTS>" +
          "<recolhidoINSS>" + (o.recolhidoINSS === true) + "</recolhidoINSS>" +
          "<incidenciaFGTS>" + (h.incidenciaFGTS !== false) + "</incidenciaFGTS>" +
          "<incidenciaINSS>" + (h.incidenciaINSS !== false) + "</incidenciaINSS>" +
          "<historicoSalarial><HistoricoSalarial><internalRef>" + texto(no, "id") +
          "</internalRef></HistoricoSalarial></historicoSalarial>" +
          "</OcorrenciaDoHistoricoSalarial>"));
      });
      hs.appendChild(no);
    });

    var cp = limpar(caminho(C, "cartoesDePonto/Set"));
    (ficha.cartoesDePonto || []).forEach(function (k) {
      var no = reidentificar(fragmento(doc, base.moldes.cartaoDePonto));
      texto(no, "nome", k.nome);
      var lista = limpar(caminho(no, "ocorrencias/List"));
      (k.ocorrencias || []).forEach(function (o) {
        lista.appendChild(fragmento(doc,
          "<OcorrenciaDoCartaoDePonto><id>" + idNovo() + "</id>" +
          "<dataOcorrencia>" + paraEpoch(o.data) + "</dataOcorrencia>" +
          "<valor>" + o.valor + "</valor><versao>0</versao>" +
          "<cartaoDePonto><CartaoDePonto><internalRef>" + texto(no, "id") +
          "</internalRef></CartaoDePonto></cartaoDePonto>" +
          "</OcorrenciaDoCartaoDePonto>"));
      });
      cp.appendChild(no);
    });

    var ft = limpar(caminho(C, "faltas/Set"));
    (ficha.faltas || []).forEach(function (x) {
      var no = reidentificar(fragmento(doc, base.moldes.falta));
      texto(no, "dataInicioPeriodoFalta", paraEpoch(x.inicio));
      texto(no, "dataTerminoPeriodoFalta", paraEpoch(x.termino || x.inicio));
      if (filho(no, "justificada")) texto(no, "justificada", !!x.justificada);
      ft.appendChild(no);
    });
  }

  function moldeDaVerba(base, v) {
    if (v.tipo === "INFORMADA") return base.moldes.informada;
    if (v.tipo === "REFLEXO") return base.moldes.reflexo;
    return (v.base || {}).tipo === "HISTORICO_SALARIAL"
      ? base.moldes.calculadaHistorico
      : base.moldes.calculadaTabelada;
  }

  function aplicarVerbas(doc, ficha, base) {
    var C = doc.documentElement;
    var alvo = limpar(caminho(C, "verbas/Set"));
    var c = ficha.contrato || {};
    var nos = {};

    ficha.verbas.forEach(function (v, ordem) {
      var no = reidentificar(fragmento(doc, moldeDaVerba(base, v)));
      texto(no, "nome", v.nome);
      texto(no, "descricao", v.descricao || v.nome);
      texto(no, "ordem", ordem + 1);
      texto(no, "ativo", "true");
      texto(no, "periodoInicial", paraEpoch((v.periodo || {}).inicio || c.admissao));
      texto(no, "periodoFinal", paraEpoch((v.periodo || {}).fim || c.demissao));
      texto(no, "tipoVariacaoParcela", v.variacao || "VARIAVEL");
      if (v.ocorrenciaDePagamento) texto(no, "ocorrenciaDePagamento", v.ocorrenciaDePagamento);
      if (v.caracteristica) texto(no, "caracteristica", v.caracteristica);
      texto(no, "assuntoCnj/AssuntoCnj/externalRef", v.assuntoCnj);

      var salarial = v.natureza !== "INDENIZATORIA";
      texto(no, "incidenciaINSS", v.incidenciaINSS != null ? !!v.incidenciaINSS : salarial);
      texto(no, "incidenciaIRPF", v.incidenciaIRPF != null ? !!v.incidenciaIRPF : salarial);
      texto(no, "incidenciaFGTS", v.incidenciaFGTS != null ? !!v.incidenciaFGTS : salarial);

      if (v.tipo === "INFORMADA") {
        texto(no, "formula/FormulaInformada/constante/Constante/valor", v.valor);
      } else if (v.tipo === "CALCULADA") {
        var F = caminho(no, "formula/FormulaCalculada");
        texto(F, "baseTabelada/BaseTabelada/tipo", v.base.tipo);
        if (v.divisor) {
          texto(F, "divisor/Divisor/tipo", v.divisor.tipo);
          texto(F, "divisor/Divisor/outroValor",
            v.divisor.tipo === "OUTRO_VALOR" ? v.divisor.valor : null);
        }
        if (v.multiplicador != null) {
          texto(F, "multiplicador/Multiplicador/outroValor", v.multiplicador);
        }
        if (v.quantidade) {
          texto(F, "quantidade/Quantidade/tipo", v.quantidade.tipo);
          // AVOS e APURADA são contados pelo sistema: o campo fica nulo, como
          // no .PJC de referência. Zero ali é lido como quantidade zero.
          var qtdFixa = (v.quantidade.tipo === "INFORMADA");
          texto(F, "quantidade/Quantidade/valorInformado",
            qtdFixa ? v.quantidade.valor : null);
        }
      } else {
        if (v.comportamento) texto(no, "comportamentoDoReflexo", v.comportamento);
      }

      // o molde vem com os vínculos da verba original; todos são refeitos
      ["historicosDaVerbaDoValorDevido", "historicosDaVerbaDoValorPago",
       "cartoesDePontoDaVerbaQuantidade", "cartoesDePontoDaVerbaDivisor",
       "valesTransportesDoValorDevido", "valesTransportesDoValorPago"
      ].forEach(function (nome) {
        var lista = caminho(no, nome + "/List");
        if (lista) limpar(lista);
      });

      // O molde traz o "valor pago" da verba original, às vezes apontando para
      // HISTORICO_SALARIAL sem o vínculo correspondente — o PJe-Calc acusa erro
      // ao regerar. Por padrão o pago é zerado e informado; só a Ficha o ativa.
      var vp = caminho(no, "formula/FormulaCalculada/valorPago/ValorPago") ||
               caminho(no, "formula/FormulaInformada/valorPago/ValorPago") ||
               caminho(no, "formula/FormulaReflexo/valorPago/ValorPago");
      if (vp) {
        var pago = v.valorPago || {};
        texto(vp, "tipo", pago.tipo || "INFORMADO");
        texto(vp, "valorInformado", pago.valor != null ? pago.valor : 0);
        texto(vp, "baseTabelada", pago.base || null);
        texto(vp, "quantidade", pago.quantidade != null ? pago.quantidade : 1);
      }

      nos[v.nome] = no;
      alvo.appendChild(no);
    });

    // segunda passada: reflexos e quantidades apontam para verbas já criadas
    ficha.verbas.forEach(function (v) {
      var no = nos[v.nome];
      if (v.tipo === "REFLEXO") {
        var itens = limpar(caminho(no, "formula/FormulaReflexo/baseVerba/BaseVerba/itens/List"));
        var idFormula = texto(no, "formula/FormulaReflexo/id");
        v.baseVerbas.forEach(function (nome) {
          var alvoVerba = nos[nome];
          // O item aponta para a verba-base E de volta para a fórmula que o
          // contém. Sem esse retorno o vínculo fica de mão única e a tela de
          // edição do reflexo abre com a verba-base em branco.
          itens.appendChild(fragmento(doc,
            "<ItemBaseVerba><id>" + idNovo() + "</id>" +
            "<integralizar>" + (v.integralizar || "SIM") + "</integralizar>" +
            "<verbaDeCalculo><" + alvoVerba.nodeName + "><internalRef>" +
            texto(alvoVerba, "id") + "</internalRef></" + alvoVerba.nodeName +
            "></verbaDeCalculo>" +
            "<formula><FormulaReflexo><internalRef>" + idFormula +
            "</internalRef></FormulaReflexo></formula>" +
            "</ItemBaseVerba>"));
        });
      }
      if (v.tipo === "CALCULADA" && (v.base || {}).tipo === "HISTORICO_SALARIAL") {
        var historicos = caminho(doc.documentElement, "historicosSalariais/Set");
        var quais = v.base.historicos;
        var listaH = limpar(caminho(no, "historicosDaVerbaDoValorDevido/List"));
        for (var h = 0; h < historicos.childNodes.length; h++) {
          var hn = historicos.childNodes[h];
          if (hn.nodeType !== 1) continue;
          if (quais && quais.indexOf(texto(hn, "nome")) < 0) continue;
          listaH.appendChild(fragmento(doc,
            "<HistoricoSalarialDaVerba><id>" + idNovo() + "</id>" +
            "<tipoVinculoHistorico>BASE</tipoVinculoHistorico>" +
            "<aplicarProporcionalidade>false</aplicarProporcionalidade>" +
            "<verbaDeCalculo><" + no.nodeName + "><internalRef>" + texto(no, "id") +
            "</internalRef></" + no.nodeName + "></verbaDeCalculo>" +
            "<historicoSalarial><HistoricoSalarial><internalRef>" + texto(hn, "id") +
            "</internalRef></HistoricoSalarial></historicoSalarial>" +
            "</HistoricoSalarialDaVerba>"));
        }
      }
      if (v.tipo === "CALCULADA" && v.quantidade &&
          v.quantidade.tipo === "IMPORTADA_DO_CARTAO") {
        var cartoes = caminho(doc.documentElement, "cartoesDePonto/Set");
        var achado = null;
        for (var i = 0; i < cartoes.childNodes.length; i++) {
          var k = cartoes.childNodes[i];
          if (k.nodeType === 1 && texto(k, "nome") === v.quantidade.cartao) achado = k;
        }
        var lista = limpar(caminho(no, "cartoesDePontoDaVerbaQuantidade/List"));
        lista.appendChild(fragmento(doc,
          "<CartaoDePontoDaVerba><id>" + idNovo() + "</id><versao>0</versao>" +
          "<cartaoDePonto><CartaoDePonto><internalRef>" + texto(achado, "id") +
          "</internalRef></CartaoDePonto></cartaoDePonto>" +
          "<verbaDeCalculo><" + no.nodeName + "><internalRef>" + texto(no, "id") +
          "</internalRef></" + no.nodeName + "></verbaDeCalculo>" +
          "</CartaoDePontoDaVerba>"));
      }
    });
  }

  // ------------------------------------------------------------ renumeração ---

  function renumerar(doc, base) {
    // Bijeção global: números repetidos entre tipos diferentes continuam
    // repetidos, preservando as igualdades do grafo. A variante D provou que o
    // PJe-Calc aceita qualquer numeração desde que nenhum internalRef fique órfão.
    var antigos = [];
    var nos = doc.getElementsByTagName("*");
    var i, n, v;
    for (i = 0; i < nos.length; i++) {
      n = nos[i];
      if (n.nodeName === "id" || n.nodeName === "internalRef") {
        v = (n.textContent || "").trim();
        if (/^\d+$/.test(v) && antigos.indexOf(v) < 0) antigos.push(v);
      }
    }
    antigos.sort(function (a, b) { return +a - +b; });
    var mapa = {};
    antigos.forEach(function (a, k) { mapa[a] = String(base + k); });

    for (i = 0; i < nos.length; i++) {
      n = nos[i];
      if (n.nodeName === "id" || n.nodeName === "internalRef") {
        v = (n.textContent || "").trim();
        if (mapa[v] !== undefined) n.textContent = mapa[v];
      }
    }
    return mapa;
  }

  function conferirGrafo(doc) {
    var ids = {}, orfaos = [];
    var nos = doc.getElementsByTagName("*"), i, v;
    for (i = 0; i < nos.length; i++) {
      if (nos[i].nodeName === "id") {
        v = (nos[i].textContent || "").trim();
        if (/^\d+$/.test(v)) ids[v] = true;
      }
    }
    for (i = 0; i < nos.length; i++) {
      if (nos[i].nodeName === "internalRef") {
        v = (nos[i].textContent || "").trim();
        if (/^\d+$/.test(v) && !ids[v] && orfaos.indexOf(v) < 0) orfaos.push(v);
      }
    }
    return orfaos;
  }

  // ------------------------------------------------------------ serialização ---

  function escaparTexto(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function paraAscii(xml) {
    // O próprio PJe-Calc grava ASCII puro e escapa os acentos como referências
    // numéricas (T&#205;QUETE). Reproduzir isso dispensa lidar com ISO-8859-1
    // no navegador, onde TextEncoder só produz UTF-8.
    return xml.replace(/[\u0080-\uFFFF]/g, function (c) {
      return "&#" + c.charCodeAt(0) + ";";
    });
  }

  function montarXml(ficha, base, opcoes) {
    opcoes = opcoes || {};
    proximoIdNovo = 900000;
    exigir(Dom.parser && Dom.serializer,
      "DOMParser/XMLSerializer indisponíveis — chame configurarDom()");
    exigir(base && base.baseXml, "insumo pjc-base.json ausente ou inválido");
    var avisos = validarFicha(ficha);

    var doc = Dom.parser.parseFromString(base.baseXml, "text/xml");
    aplicarCalculo(doc, ficha);
    aplicarProcesso(doc, ficha);
    aplicarAtualizacao(doc, ficha);
    aplicarPeriodos(doc, ficha);
    aplicarColecoes(doc, ficha, base);
    aplicarVerbas(doc, ficha, base);
    renumerar(doc, opcoes.primeiroId || 1);

    var orfaos = conferirGrafo(doc);
    exigir(orfaos.length === 0,
      "grafo inconsistente: internalRef sem id correspondente (" + orfaos.join(", ") + ")");

    var corpo = Dom.serializer.serializeToString(doc.documentElement);
    return {
      xml: '<?xml version="1.0" encoding="ISO-8859-1"?>' + paraAscii(corpo),
      avisos: avisos
    };
  }

  // ------------------------------------------------------------------- zip ---

  var TABELA_CRC = (function () {
    var t = new Int32Array(256), c, i, k;
    for (i = 0; i < 256; i++) {
      c = i;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = -1;
    for (var i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }

  function bytesAscii(s) {
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xFF;
    return b;
  }

  function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
  function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

  /**
   * Monta o zip de uma entrada só, com o mesmo nome do arquivo externo — que é
   * exatamente o layout do export do PJe-Calc.
   * deflateRaw: função síncrona (Uint8Array) => Uint8Array (zlib.deflateRawSync
   * em Node; no navegador use CompressionStream('deflate-raw') e a variante
   * assíncrona empacotarAsync).
   */
  function empacotar(xml, nomeArquivo, deflateRaw, metodo) {
    if (metodo === undefined) metodo = 8;          // 8 = deflate, 0 = armazenado
    var dados = bytesAscii(xml);
    var comprimido = metodo === 0 ? dados : deflateRaw(dados);
    var nome = bytesAscii(nomeArquivo);
    var crc = crc32(dados);
    var cab = [].concat(
      u16(20), u16(0), u16(metodo), u16(0), u16(0),
      u32(crc), u32(comprimido.length), u32(dados.length),
      u16(nome.length), u16(0));

    var local = [].concat(u32(0x04034b50), cab);
    var central = [].concat(u32(0x02014b50), u16(20), cab,
      u16(0),   // comentário
      u16(0),   // disco inicial
      u16(0),   // atributos internos
      u32(0),   // atributos externos
      u32(0));  // deslocamento do cabeçalho local
    var deslocamentoCentral = local.length + nome.length + comprimido.length;
    var tamCentral = central.length + nome.length;
    var fim = [].concat(u32(0x06054b50), u16(0), u16(0), u16(1), u16(1),
      u32(tamCentral), u32(deslocamentoCentral), u16(0));

    var total = deslocamentoCentral + tamCentral + fim.length;
    var saida = new Uint8Array(total);
    var p = 0;
    function por(arr) {
      for (var i = 0; i < arr.length; i++) saida[p++] = arr[i] & 0xFF;
    }
    por(local); saida.set(nome, p); p += nome.length;
    saida.set(comprimido, p); p += comprimido.length;
    por(central); saida.set(nome, p); p += nome.length;
    por(fim);
    return saida;
  }

  function nomeDoArquivo(ficha) {
    var num = ficha.processo.numeroCNJ.replace(/\D/g, "");
    var d = new Date(paraEpoch(ficha.contrato.dataLiquidacao));
    function dd(n) { return (n < 10 ? "0" : "") + n; }
    return "PROCESSO_" + num + "_CALCULO_0_DATA_" +
      dd(d.getUTCDate()) + dd(d.getUTCMonth() + 1) + d.getUTCFullYear() +
      "_HORA_000000.PJC";
  }

  return {
    configurarDom: configurarDom,
    validarFicha: validarFicha,
    montarXml: montarXml,
    empacotar: empacotar,
    nomeDoArquivo: nomeDoArquivo,
    paraEpoch: paraEpoch,
    deEpoch: deEpoch,
    VOCABULARIO: VOCABULARIO,
    listaDe: listaDe,
    ErroDeFicha: ErroDeFicha
  };
});