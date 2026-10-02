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

  /* Carimbo de versão. Vai para o campo de comentários do PJC e é exposto em
     PjcMontador.VERSAO, para que o painel possa exibi-lo. Sem ele, um arquivo
     gerado por código antigo é indistinguível de um gerado pelo atual — e já
     custou duas rodadas de diagnóstico. */
  var VERSAO = "automaTor 0.9";

  var Dom = {
    parser: typeof DOMParser !== "undefined" ? new DOMParser() : null,
    serializer: typeof XMLSerializer !== "undefined" ? new XMLSerializer() : null
  };

  function configurarDom(parser, serializer) {
    Dom.parser = parser;
    Dom.serializer = serializer;
  }

  // ---------------------------------------------------------------- datas ---

  /* O PJe-Calc grava as datas como meia-noite em UTC-03:00 FIXO, sem horário de
     verão. Confirmado no arquivo de referência: 01/01/2010 está gravado como
     1262314800000, que em fuso real é 01:00 (-02:00, horário de verão) e em
     -03:00 fixo é exatamente 00:00.

     Usar o fuso real deslocava as competências de novembro a fevereiro dos anos
     com horário de verão — o sistema as lia como 23:00 do dia anterior, ou seja,
     do mês anterior, e a competência sumia da tela. Era a causa dos "buracos" no
     histórico, e explica por que 2020/21 e 2021/22 escapavam: o horário de verão
     acabou em 2019. */
  var DESLOCAMENTO_FIXO = -3 * 60 * 60 * 1000;

  function paraEpoch(iso) {
    if (iso === null || iso === undefined || iso === "") return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
    if (!m) throw new ErroDeFicha("data fora do formato AAAA-MM-DD: " + iso);
    return Date.UTC(+m[1], +m[2] - 1, +m[3]) - DESLOCAMENTO_FIXO;
  }

  function deEpoch(ms) {
    if (ms === null || ms === "null" || ms === undefined) return null;
    return new Date(+ms + DESLOCAMENTO_FIXO).toISOString().slice(0, 10);
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
    /* descartavel: campo opcional com padrão seguro. Valor fora do vocabulário
       é removido e o padrão do perfil assume — derrubar a Ficha inteira por
       causa de um rótulo que a LLM inventou custa uma rodada e não protege
       nada, já que o campo tem default conferido. */
    function checarVocabulario(dono, campo, lista, rotulo, descartavel) {
      var valor = dono ? dono[campo] : undefined;
      if (valor === undefined || valor === null) return;
      var bom = padronizar(valor, lista);
      var valores = listaDe(lista);
      if (!valores.length) return;          // vocabulário não capturado: não barra
      if (valores.indexOf(bom) < 0) {
        if (descartavel) {
          avisos.push(rotulo + ": \"" + valor + "\" fora do vocabulário — " +
            "campo ignorado, o padrão da verba assume");
          delete dono[campo];
          return;
        }
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
      checarVocabulario(ficha.encargos.fgts, "destino", "destinoDoFgts", "encargos.fgts.destino", true);
    }

    if (!checar(Array.isArray(ficha.verbas) && ficha.verbas.length > 0,
        "a Ficha precisa de ao menos uma verba")) {
      throw new ErroDeFicha(montarRelatorio(erros));
    }

    /* Problema numa verba não derruba a Ficha inteira: a verba é descartada e
       vai para as pendências, como acontece com a que não tem modelo na
       biblioteca. O servidor recebe o arquivo com o que deu para lançar e a
       lista do que falta — melhor que ficar sem arquivo nenhum. */
    var descartadas = [];
    function problemaNaVerba(v, msg) {
      descartadas.push({ nome: v.nome || "(sem nome)", motivo: msg });
      v.__descartar = true;
    }

    var nomes = {};
    ficha.verbas.forEach(function (v, i) {
      var onde = "verbas[" + i + "]" + (v.nome ? " (" + v.nome + ")" : "");
      if (!v.nome) { problemaNaVerba(v, "sem nome"); return; }
      if (nomes[v.nome]) { problemaNaVerba(v, "nome repetido"); return; }
      nomes[v.nome] = true;

      checarVocabulario(v, "tipo", "tipoVerba", onde + ".tipo");
      if (!v.tipo) { problemaNaVerba(v, "sem tipo"); return; }
      if (!v.assuntoCnj) { problemaNaVerba(v, "sem assuntoCnj"); return; }
      checarVocabulario(v, "natureza", "natureza", onde + ".natureza");
      checarVocabulario(v, "caracteristica", "caracteristica", onde + ".caracteristica", true);
      checarVocabulario(v, "ocorrenciaDePagamento", "ocorrenciaDePagamento", onde + ".ocorrenciaDePagamento", true);
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
        if (typeof v.valor !== "number") problemaNaVerba(v, "verba INFORMADA sem valor");
        checar(true,
          onde + ": verba INFORMADA exige valor numérico. Se o título não fixou " +
          "quantia — saldo de salário, diferenças, verbas apuradas por dias —, " +
          "a verba é CALCULADA, com base, divisor, multiplicador e quantidade");
      } else if (v.tipo === "REFLEXO") {
        if (!(Array.isArray(v.baseVerbas) && v.baseVerbas.length)) {
          problemaNaVerba(v, "reflexo sem baseVerbas");
        }
        checarVocabulario(v, "comportamento", "comportamentoDoReflexo", onde + ".comportamento", true);
      }

      if (!v.fonte) avisos.push(onde + ": sem fonte nos autos");
    });

    ficha.verbas.forEach(function (v, i) {
      var onde = "verbas[" + i + "]" + (v.nome ? " (" + v.nome + ")" : "");
      (v.baseVerbas || []).forEach(function (n) {
        if (!nomes[n]) problemaNaVerba(v, "baseVerbas aponta para \"" + n + "\", ausente da Ficha");
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

    if (descartadas.length) {
      ficha.verbas = ficha.verbas.filter(function (v) { return !v.__descartar; });
      descartadas.forEach(function (d) {
        avisos.push('verba NÃO lançada: "' + d.nome + '" — ' + d.motivo);
      });
      pendenciasDaFicha = descartadas.map(function (d) { return d.nome; });
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
    // O cálculo nasce de arquivo, não da consulta ao PJe.
    texto(C, "processoInformadoManualmente", "true");

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

  /* Busca a verba na biblioteca — o conjunto de verbas conferidas por
     calculista, guardadas inteiras. Copiar a verba pronta é o que impede o
     vazamento de campo alheio: só o que a Ficha manda trocar é trocado.

     Casa por nome normalizado, e também por prefixo: o PJe-Calc grava o
     reflexo como "MULTA ... SOBRE X SOBRE X" (o rótulo do modelo mais a verba
     base), enquanto a Ficha traz "MULTA ... SOBRE X". */
  function chaveDeBusca(nome) {
    var t = String(nome || "");
    if (t.normalize) t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return t.toUpperCase().split(/\s+/).join(" ").trim();
  }

  function moldeDaVerba(base, v) {
    var biblioteca = base.biblioteca || {};
    var alvo = chaveDeBusca(v.nome);

    if (biblioteca[alvo]) return biblioteca[alvo];

    var chaves = Object.keys(biblioteca);
    for (var i = 0; i < chaves.length; i++) {
      if (chaves[i].indexOf(alvo) === 0 || alvo.indexOf(chaves[i]) === 0) {
        return biblioteca[chaves[i]];
      }
    }
    return null;
  }

  function aplicarVerbas(doc, ficha, base) {
    var C = doc.documentElement;
    var alvo = limpar(caminho(C, "verbas/Set"));
    var c = ficha.contrato || {};
    var nos = {};

    var semMolde = [];

    ficha.verbas.forEach(function (v, ordem) {
      var xmlMolde = moldeDaVerba(base, v);
      if (!xmlMolde) {
        // Sem verba conferida na biblioteca, inventar a parametrização é o
        // caminho para a conta errada silenciosa. Melhor não lançar e avisar.
        semMolde.push(v.nome);
        return;
      }
      var no = reidentificar(fragmento(doc, xmlMolde));
      texto(no, "nome", v.nome);
      texto(no, "descricao", v.descricao || v.nome);
      texto(no, "ordem", ordem + 1);
      texto(no, "ativo", "true");
      texto(no, "periodoInicial", paraEpoch((v.periodo || {}).inicio || c.admissao));
      texto(no, "periodoFinal", paraEpoch((v.periodo || {}).fim || c.demissao));
      texto(no, "tipoVariacaoParcela", v.variacao || "VARIAVEL");
      // Sempre escrever: o clone do molde traz a característica da verba que
      // lhe deu origem, e um reflexo herdava AVISO_PREVIO sem nunca declará-lo.
      texto(no, "caracteristica", v.caracteristica || "COMUM");
      texto(no, "ocorrenciaDePagamento", v.ocorrenciaDePagamento || "DESLIGAMENTO");
      texto(no, "aplicarProporcionalidade", v.proporcionalizar === true);
      texto(no, "excluirFaltaJustificada", v.excluirFaltaJustificada === true);
      texto(no, "excluirFaltaNaoJustificada", v.excluirFaltaNaoJustificada === true);
      texto(no, "excluirFeriasGozadas", v.excluirFeriasGozadas === true);
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
        // "Proporcionalizar" da aba Fórmula > Base de Cálculo. O molde vinha com
        // true e marcava a caixa em toda verba gerada.
        texto(F, "baseTabelada/BaseTabelada/aplicarProporcionalidade",
          v.proporcionalizarBase === true);
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
          // AVOS e as importadas são contadas pelo sistema e ficam nulas. A
          // APURADA guarda o valor de partida (30 dias, no aviso prévio) — foi
          // assim que o calculista deixou no .PJC de referência.
          var semValor = (v.quantidade.tipo === "AVOS" ||
                          v.quantidade.tipo === "IMPORTADA_DO_CARTAO" ||
                          v.quantidade.tipo === "IMPORTADA_DO_CALENDARIO");
          texto(F, "quantidade/Quantidade/valorInformado",
            semValor ? null : v.quantidade.valor);
          texto(F, "quantidade/Quantidade/aplicarProporcionalidade",
            v.quantidade.proporcionalizar === true);
        }
      } else {
        texto(no, "comportamentoDoReflexo", v.comportamento || "VALOR_MENSAL");
        texto(no, "periodoMediaReflexo", v.periodoMedia || "PERIODO_AQUISITIVO");
        // MANTER conserva o valor apurado da verba-base; INTEGRALIZAR toma o mês
        // cheio. O molde vinha com INTEGRALIZAR e contaminava todo reflexo.
        texto(no, "tratamentoDaFracaoDeMesDoReflexo", v.tratamentoDaFracao || "MANTER");
        // A FormulaReflexo tem os mesmos operadores da calculada; sem escrevê-los
        // o clone do molde conserva os do reflexo que lhe deu origem.
        var R = caminho(no, "formula/FormulaReflexo");
        if (v.divisor) {
          texto(R, "divisor/Divisor/tipo", v.divisor.tipo);
          texto(R, "divisor/Divisor/outroValor",
            v.divisor.tipo === "OUTRO_VALOR" ? v.divisor.valor : null);
        }
        if (v.multiplicador != null) {
          texto(R, "multiplicador/Multiplicador/outroValor", v.multiplicador);
        }
        if (v.quantidade) {
          texto(R, "quantidade/Quantidade/tipo", v.quantidade.tipo);
          texto(R, "quantidade/Quantidade/valorInformado",
            v.quantidade.tipo === "AVOS" ? null : v.quantidade.valor);
        }
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

      gerarOcorrenciasZeradas(doc, no, v, c);

      nos[v.nome] = no;
      alvo.appendChild(no);
    });

    var faltantes = semMolde.concat(pendenciasDaFicha);
    if (faltantes.length) {
      // No arquivo vai só a contagem, pelo limite do campo; a lista inteira
      // aparece no painel, onde não há limite.
      // No arquivo cabe pouco: vai a lista até onde couber, truncada. A versão
      // inteira aparece no painel, onde não há limite.
      registrarPendencia(doc, "Nao lancadas: " + faltantes.join("; "));
      pendenciasDetalhadas.push("Verbas NÃO lançadas: " + faltantes.join("; ") +
        ". Lance-as manualmente no PJe-Calc.");
    }

    // segunda passada: reflexos e quantidades apontam para verbas já criadas
    ficha.verbas.forEach(function (v) {
      var no = nos[v.nome];
      if (!no) return;
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
            "<aplicarProporcionalidade>" + (v.proporcionalizarHistorico === true) +
            "</aplicarProporcionalidade>" +
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

  /* As pendências vão para o campo de comentários do cálculo: é onde o
     servidor as encontra ao abrir o arquivo, sem depender de ter visto o
     painel da extensão. */
  /* O campo comentarios do banco do PJe-Calc tem 255 caracteres — medido por
     tentativa. Texto maior faz a gravação falhar em silêncio, e foi o que
     recusou sete importações seguidas: o arquivo era válido em tudo, menos no
     tamanho deste campo. A margem cobre o carimbo de versão, que é acrescentado
     depois das pendências. Contam-se caracteres, não bytes: os acentos viram
     &#NNN; no XML, mas o banco guarda o texto decodificado. */
  var LIMITE_COMENTARIOS = 250;

  function registrarPendencia(doc, texto_) {
    var C = doc.documentElement;
    var no = filho(C, "comentarios");
    if (!no) {
      no = doc.createElement("comentarios");
      C.appendChild(no);
    }
    var atual = (no.textContent || "").trim();
    if (atual === "null") atual = "";
    var novo = atual ? atual + " | " + texto_ : texto_;
    if (novo.length > LIMITE_COMENTARIOS) {
      novo = novo.slice(0, LIMITE_COMENTARIOS - 3) + "...";
    }
    while (no.firstChild) no.removeChild(no.firstChild);
    no.appendChild(doc.createTextNode(novo));
  }

  // ------------------------------------------------------------ renumeração ---

  /* O <versao> é o controle de concorrência do banco (JPA). Herdado de um
     cálculo conferido, ele chega ao PJe-Calc dizendo "esta linha já existe na
     versão 22" para um registro que está sendo criado agora — e a importação
     falha sem mensagem. Todo objeto novo nasce na versão zero. */
  function zerarVersoes(doc) {
    var nos = doc.getElementsByTagName("*"), i, n = 0;
    for (i = 0; i < nos.length; i++) {
      if (nos[i].nodeName === "versao") {
        nos[i].textContent = "0";
        n++;
      }
    }
    return n;
  }

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

  var pendenciasDetalhadas = [];
  var pendenciasDaFicha = [];

  function montarXml(ficha, base, opcoes) {
    opcoes = opcoes || {};
    proximoIdNovo = 900000;
    pendenciasDetalhadas = [];
    pendenciasDaFicha = [];
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
    zerarVersoes(doc);
    registrarPendencia(doc, "Gerado por " + VERSAO);
    renumerar(doc, opcoes.primeiroId || 1);

    var orfaos = conferirGrafo(doc);
    exigir(orfaos.length === 0,
      "grafo inconsistente: internalRef sem id correspondente (" + orfaos.join(", ") + ")");

    var corpo = Dom.serializer.serializeToString(doc.documentElement);
    pendenciasDetalhadas.forEach(function (linha) {
      if (avisos.indexOf(linha) < 0) avisos.push(linha);
    });

    return {
      xml: '<?xml version="1.0" encoding="ISO-8859-1"?>' + paraAscii(corpo),
      avisos: avisos
    };
  }

  // ──────────────────────────────────────── ocorrências zeradas ─────────────
  //
  // Gera uma <OcorrenciaDeVerba> por período (mensal, dezembro, desligamento ou
  // período aquisitivo) com todos os valores calculados em null e ativo=true.
  //
  // Isso replica o estado inicial que o PJe-Calc cria quando o calculista
  // adiciona a verba manualmente: as linhas de período já aparecem na tela e
  // podem ser ativadas/desativadas antes do primeiro Regerar.
  //
  // Campos confirmados no arquivo PROCESSO_977560 (Calc. 27/08/2026):
  //   - tag: <OcorrenciaDeVerba>
  //   - divisor/multiplicador: copiados da fórmula (não null)
  //   - quantidade: 0 (Regerar computa os avos/horas reais)
  //   - devido, base, indiceAcumulado: null
  //   - pago, pagoIntegral: 0
  //   - ativo: true

  function gerarOcorrenciasZeradas(doc, no, v, c) {
    var lista = caminho(no, "ocorrencias/List");
    if (!lista) return;

    var ocPag  = v.ocorrenciaDePagamento || 'DESLIGAMENTO';
    var inicio = (v.periodo && v.periodo.inicio) || c.admissao;
    var fim    = (v.periodo && v.periodo.fim)    || c.demissao || c.dataLiquidacao;

    // Ocorrências explícitas vencem a inferência. O lançador as monta a partir
    // do pedido ("10/12 avos de 2024, 2023") e já sabe a quantidade de cada
    // uma. Inferir pelo tipo de pagamento é o caminho de quando essa
    // informação não existe — e foi ele que gerou uma única ocorrência de
    // janeiro quando a verba chegou sem 'caracteristica' e o padrão caiu
    // em DESLIGAMENTO.
    var explicitas = Array.isArray(v.ocorrencias) && v.ocorrencias.length
                     ? v.ocorrencias : null;
    if (!explicitas && (!inicio || !fim)) return;

    // Divisor: só 'OUTRO_VALOR' tem valor escalar; outros (CARGA_HORARIA,
    // DIAS_UTEIS) ficam null — o Regerar resolve pelo tipo.
    var divVal  = (v.divisor && v.divisor.tipo === 'OUTRO_VALOR' && v.divisor.valor != null)
                  ? v.divisor.valor : 'null';
    var multVal = v.multiplicador != null ? v.multiplicador : 'null';

    // INFORMADA usa 'INFORMADO'; qualquer outro (CALCULADA, REFLEXO) usa 'CALCULADO'.
    var tipoValor = (v.tipo === 'INFORMADA') ? 'INFORMADO' : 'CALCULADO';
    var car = v.caracteristica || 'COMUM';
    var vNome = no.nodeName;
    var vId   = texto(no, "id");

    var periodos = explicitas
      ? explicitas.map(function (o) {
          return { ini: o.inicio, fim: o.fim,
                   qtd: o.quantidade != null ? o.quantidade : 0,
                   ativo: o.ativo === false ? 'false' : 'true' };
        })
      : _pjc_periodosOcorrencia(ocPag, inicio, fim).map(function (p) {
          return { ini: p.ini, fim: p.fim, qtd: 0, ativo: 'true' };
        });

    periodos.forEach(function (p) {
      lista.appendChild(fragmento(doc,
        '<OcorrenciaDeVerba>' +
        '<id>' + idNovo() + '</id><versao>0</versao>' +
        '<dataInicial>' + paraEpoch(p.ini) + '</dataInicial>' +
        '<dataFinal>'   + paraEpoch(p.fim) + '</dataFinal>' +
        '<divisor>'       + divVal  + '</divisor>' +
        '<multiplicador>' + multVal + '</multiplicador>' +
        '<quantidade>' + p.qtd + '</quantidade>' +
        '<quantidadeIntegral>' + p.qtd + '</quantidadeIntegral>' +
        '<dobra>false</dobra>' +
        '<devido>null</devido><devidoIntegral>null</devidoIntegral>' +
        '<pago>0</pago><pagoIntegral>0</pagoIntegral>' +
        '<ativo>' + p.ativo + '</ativo>' +
        '<valor>' + tipoValor + '</valor>' +
        '<comporPrincipal>SIM</comporPrincipal>' +
        '<base>null</base><baseIntegral>null</baseIntegral>' +
        '<dataInicialPeriodoAquisitivo>null</dataInicialPeriodoAquisitivo>' +
        '<dataFinalPeriodoAquisitivo>null</dataFinalPeriodoAquisitivo>' +
        '<feriasIndenizadas>false</feriasIndenizadas>' +
        '<feriasComAbono>false</feriasComAbono>' +
        '<indiceAcumulado>null</indiceAcumulado>' +
        '<caracteristica>' + car  + '</caracteristica>' +
        '<ocorrenciaDePagamento>' + ocPag + '</ocorrenciaDePagamento>' +
        '<verbaDeCalculo><' + vNome + '><internalRef>' + vId +
        '</internalRef></' + vNome + '></verbaDeCalculo>' +
        '<ocorrenciaOriginal>null</ocorrenciaOriginal>' +
        '</OcorrenciaDeVerba>'));
    });
  }

  // Retorna lista de { ini, fim } (datas ISO) para cada ocorrência do período.
  function _pjc_periodosOcorrencia(ocPag, inicioISO, fimISO) {
    var periodos = [];
    var a = inicioISO.split('-').map(Number);
    var b = fimISO.split('-').map(Number);
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };

    if (ocPag === 'DESLIGAMENTO') {
      // Uma ocorrência única na data de demissão/liquidação.
      periodos.push({ ini: fimISO, fim: fimISO });

    } else if (ocPag === 'DEZEMBRO') {
      // 13º SALÁRIO: uma ocorrência por ano, fixada no dia 20 de dezembro
      // (prazo legal do segundo lote). No ano de rescisão, quando esta ocorre
      // antes de dezembro/20, usa-se a data de demissão (pagamento na rescisão).
      for (var ano = a[0]; ano <= b[0]; ano++) {
        var antesDez20 = (b[0] === ano) && (b[1] < 12 || (b[1] === 12 && b[2] < 20));
        var d = antesDez20 ? fimISO : (ano + '-12-20');
        periodos.push({ ini: d, fim: d });
      }

    } else if (ocPag === 'MENSAL') {
      // Uma por mês: do primeiro ao último dia.
      var ano = a[0], mes = a[1];
      while (ano < b[0] || (ano === b[0] && mes <= b[1])) {
        var ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        periodos.push({
          ini: ano + '-' + pad(mes) + '-01',
          fim: ano + '-' + pad(mes) + '-' + pad(ultimoDia)
        });
        if (++mes > 12) { mes = 1; ano++; }
        if (periodos.length > 360) break;     // trava contra datas absurdas
      }

    } else if (ocPag === 'PERIODO_AQUISITIVO') {
      // Férias: uma por período aquisitivo. Data de referência: 1º de janeiro
      // do ano seguinte ao início do período (ou demissão, o que vier antes).
      for (var ano = a[0]; ano <= b[0]; ano++) {
        var ref = (ano + 1) + '-01-01';
        if (ref > fimISO) ref = fimISO;
        periodos.push({ ini: ref, fim: ref });
      }
    }

    return periodos;
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
    VERSAO: VERSAO,
    VOCABULARIO: VOCABULARIO,
    listaDe: listaDe,
    ErroDeFicha: ErroDeFicha
  };
});