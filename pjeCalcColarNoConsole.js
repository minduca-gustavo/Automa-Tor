/* =============================================================================
 * pjc-console.js — Ficha de Liquidação (JSON) → arquivo .PJC do PJe-Calc
 *
 * Cole inteiro no console do navegador (F12 → Console). Mesma máquina da
 * ferramenta HTML, sem a página: montador, validação, renumeração, zip.
 *
 *   PJC.gerar(ficha)                valida, monta, empacota e baixa o .PJC
 *   PJC.gerar(ficha, {baixar:false})  só devolve os bytes, sem download
 *   PJC.xml(ficha)                  devolve { xml, avisos }, sem zip
 *   PJC.validar(ficha)              devolve os avisos; lança em caso de erro
 *   PJC.doClipboard()               lê a Ficha da área de transferência e gera
 *   PJC.exemplo                     Ficha de exemplo (objeto)
 *   PJC.ultimo                      { nome, xml, zip, base64 } da última geração
 *   PJC.ultimoErro                  erro da última tentativa recusada
 *   PJC.montador                    API crua (montarXml, empacotar, paraEpoch...)
 *   PJC.ajuda()                     este resumo
 *
 * A ficha pode entrar como objeto ou como texto — cercas ```json são toleradas.
 * O arquivo sai sem nenhum valor apurado: quem calcula é o PJe-Calc.
 * ========================================================================== */

(function () {
"use strict";

/* ---- insumo: base esqueletizada e moldes, extraídos de um .PJC real ---- */
var PJC_BASE = {
 "anexo": "PJC-1.0",
 "versaoDoSistema": "2.16.0",
 "origem": "calc.xml",
 "baseXml": "<Calculo><gprec><dataCalculo>1788145200000<\/dataCalculo><nomeBeneficiario>FULANA DE TAL<\/nomeBeneficiario><documentoFiscalBeneficiario /><liquidoExequente>0<\/liquidoExequente><inssBeneficiario>0<\/inssBeneficiario><inssExecutado>0<\/inssExecutado><impostoRenda>0<\/impostoRenda><depositoFgts>0<\/depositoFgts><custasJudiciais>0<\/custasJudiciais><honorariosReclamante /><honorariosReclamado /><\/gprec><dadosEstruturados><dataLiquidacao>1788145200000<\/dataLiquidacao><hashLiquidacao /><contrSocialDezPorcento>0<\/contrSocialDezPorcento><contrSocialMeioPorcento>0<\/contrSocialMeioPorcento><custasReclamado>0<\/custasReclamado><custasReclamante>0<\/custasReclamante><debitoReclamantePensaoAlimenticia>0<\/debitoReclamantePensaoAlimenticia><debitoReclamantePrevidenciaPrivada>0<\/debitoReclamantePrevidenciaPrivada><fgtsDepositoContaVinculada>0<\/fgtsDepositoContaVinculada><impostoRenda>0<\/impostoRenda><inssReclamado>0<\/inssReclamado><inssReclamante>0<\/inssReclamante><jurosMora>null<\/jurosMora><jurosPrevidenciaPrivada>null<\/jurosPrevidenciaPrivada><valorPrincipal>0<\/valorPrincipal><tipoRegistroCalculo>CALCULO<\/tipoRegistroCalculo><multas /><honorarios /><\/dadosEstruturados><id>977442<\/id><versao>5<\/versao><atualizacao>null<\/atualizacao><hashCodeLiquidacao /><dataCriacao>1786417200000<\/dataCriacao><dataAdmissao>null<\/dataAdmissao><dataDemissao>null<\/dataDemissao><dataAjuizamento>null<\/dataAjuizamento><valorUltimaRemuneracao>0<\/valorUltimaRemuneracao><valorMaiorRemuneracao>0<\/valorMaiorRemuneracao><dataInicioCalculo>null<\/dataInicioCalculo><dataTerminoCalculo>null<\/dataTerminoCalculo><valorCargaHorariaPadrao>220<\/valorCargaHorariaPadrao><sabadoDiaUtil>true<\/sabadoDiaUtil><projetaAvisoIndenizado>true<\/projetaAvisoIndenizado><consideraFeriadoEstadual>true<\/consideraFeriadoEstadual><prescricaoFgts>false<\/prescricaoFgts><prescricaoQuinquenal>false<\/prescricaoQuinquenal><limitarAvosAoPeriodoDoCalculo>false<\/limitarAvosAoPeriodoDoCalculo><zeraValorNegativo>false<\/zeraValorNegativo><consideraFeriadoMunicipal>true<\/consideraFeriadoMunicipal><tipoCalculo>VARA<\/tipoCalculo><prazoFeriasProporcional>null<\/prazoFeriasProporcional><dataDeLiquidacao>1788145200000<\/dataDeLiquidacao><regimeDoContrato>INTEGRAL<\/regimeDoContrato><indicesAcumulados>MES_SUBSEQUENTE_AO_VENCIMENTO<\/indicesAcumulados><usuarioCriador>32656400864<\/usuarioCriador><apuracaoPrazoDoAvisoPrevio>APURACAO_CALCULADA<\/apuracaoPrazoDoAvisoPrevio><prazoAvisoInformado>null<\/prazoAvisoInformado><ativo>true<\/ativo><processoInformadoManualmente>false<\/processoInformadoManualmente><comentarios /><idSetor>75<\/idSetor><instancia>PRIMEIRA<\/instancia><validado>false<\/validado><hashCalculoCorreto>false<\/hashCalculoCorreto><hashAtualizacaoCorreto>false<\/hashAtualizacaoCorreto><diaFechamentoMes>31<\/diaFechamentoMes><calculoExterno>false<\/calculoExterno><parcelasAtualizaveisCreditosReclamante>null<\/parcelasAtualizaveisCreditosReclamante><parcelasAtualizaveisDescontoCreditosReclamante>null<\/parcelasAtualizaveisDescontoCreditosReclamante><parcelasAtualizaveisOutrosDebitosReclamado>null<\/parcelasAtualizaveisOutrosDebitosReclamado><parcelasAtualizaveisDebitosReclamante>null<\/parcelasAtualizaveisDebitosReclamante><versaoDoSistema>2.16.0<\/versaoDoSistema><processo><Processo><id>977441<\/id><versao>0<\/versao><valorDaCausa>71685.51<\/valorDaCausa><dataAutuacao>1705287600000<\/dataAutuacao><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><identificador><IdentificadorDoProcesso><numero>10042<\/numero><ano>2024<\/ano><justica>5<\/justica><regiao>15<\/regiao><vara>5<\/vara><digito>17<\/digito><\/IdentificadorDoProcesso><\/identificador><reclamante><Reclamante><tipoDocumentoPrevidenciario>null<\/tipoDocumentoPrevidenciario><numeroDocumentoPrevidenciario>null<\/numeroDocumentoPrevidenciario><nome>FULANA DE TAL<\/nome><tipoDocumentoFiscal>CPF<\/tipoDocumentoFiscal><numeroDocumentoFiscal /><\/Reclamante><\/reclamante><reclamado><Reclamado><nome>EMPRESA ABCDEFG<\/nome><tipoDocumentoFiscal>CNPJ<\/tipoDocumentoFiscal><numeroDocumentoFiscal /><\/Reclamado><\/reclamado><advogadosReclamante><List><Advogado><id /><nome>BELTRANO DE TAL<\/nome><tipoDocumento>CPF<\/tipoDocumento><numeroDocumento /><numeroOAB /><tipo>RECLAMANTE<\/tipo><processo><Processo><internalRef>977441<\/internalRef><\/Processo><\/processo><\/Advogado><\/List><\/advogadosReclamante><advogadosReclamado><List /><\/advogadosReclamado><\/Processo><\/processo><municipio><Municipio><externalRef>6219<\/externalRef><\/Municipio><\/municipio><verbas><Set /><\/verbas><historicosSalariais><Set /><\/historicosSalariais><listaDeFerias><Set /><\/listaDeFerias><apuracoesDeJuros><Set /><\/apuracoesDeJuros><excecoesDaCargaHoraria><Set /><\/excecoesDaCargaHoraria><excecoesDoSabado><Set /><\/excecoesDoSabado><faltas><Set /><\/faltas><fgts><Fgts><id>969916<\/id><versao>2<\/versao><periodoInicial>1672542000000<\/periodoInicial><periodoFinal>1688180400000<\/periodoFinal><destinoDoFgts>DEPOSITAR<\/destinoDoFgts><aliquota>OITO_POR_CENTO<\/aliquota><multa>false<\/multa><excluirAvisoDaMulta>true<\/excluirAvisoDaMulta><tipoDoValorDaMulta>CALCULADA<\/tipoDoValorDaMulta><valorInformadoDaMulta>null<\/valorInformadoDaMulta><multaDoFgts>QUARENTA_POR_CENTO<\/multaDoFgts><incidenciaDoFgts>SOBRE_O_TOTAL_DEVIDO<\/incidenciaDoFgts><multaDoArtigo467>false<\/multaDoArtigo467><multa10>false<\/multa10><contribuicaoSocial05>false<\/contribuicaoSocial05><deduzirDoFGTS>false<\/deduzirDoFGTS><incidenciaPensaoAlimenticia>false<\/incidenciaPensaoAlimenticia><incidenciaPensaoAlimenticiaSobreMulta>false<\/incidenciaPensaoAlimenticiaSobreMulta><indiceMulta>null<\/indiceMulta><indiceMulta467>null<\/indiceMulta467><taxaDeJurosParaDataDemissao>null<\/taxaDeJurosParaDataDemissao><comporPrincipal>SIM<\/comporPrincipal><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><operacoesDeFgts><Set /><\/operacoesDeFgts><ocorrencias><Set /><\/ocorrencias><\/Fgts><\/fgts><inss><Inss><id>970094<\/id><versao>0<\/versao><tipoAliquotaSegurado>SEGURADO_EMPREGADO<\/tipoAliquotaSegurado><aliquotaSeguradoFixa>null<\/aliquotaSeguradoFixa><limitarTeto>false<\/limitarTeto><tipoAliquotaEmpregador>FIXA<\/tipoAliquotaEmpregador><aliquotaEmpresaFixa>20<\/aliquotaEmpresaFixa><aliquotaRATFixa>3<\/aliquotaRATFixa><aliquotaTerceirosFixa>null<\/aliquotaTerceirosFixa><apurarEmpresaPorAtividade>false<\/apurarEmpresaPorAtividade><apurarRATPorAtividade>false<\/apurarRATPorAtividade><apurarTerceirosPorAtividade>false<\/apurarTerceirosPorAtividade><atividadeEconomica>null<\/atividadeEconomica><apurarInssSobreSalariosPagos>false<\/apurarInssSobreSalariosPagos><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><aliquotasPorPeriodos><List /><\/aliquotasPorPeriodos><periodosComOpcaoSimples><List /><\/periodosComOpcaoSimples><inssSobreSalariosDevidos><InssSobreSalariosDevidos><id>970094<\/id><apurarInssSegurado>true<\/apurarInssSegurado><cobrarInssDoReclamante>true<\/cobrarInssDoReclamante><corrigirDescontoReclamante>false<\/corrigirDescontoReclamante><versao>1<\/versao><dataInicioPeriodo>1672542000000<\/dataInicioPeriodo><dataTerminoPeriodo>1688180400000<\/dataTerminoPeriodo><ocorrencias><Set /><\/ocorrencias><ocorrenciasAtualizacao><Set /><\/ocorrenciasAtualizacao><inss><Inss><internalRef>970094<\/internalRef><\/Inss><\/inss><\/InssSobreSalariosDevidos><\/inssSobreSalariosDevidos><inssSobreSalariosPagos><InssSobreSalariosPagos><id>970094<\/id><versao>1<\/versao><dataInicioPeriodo>1672542000000<\/dataInicioPeriodo><dataTerminoPeriodo>1688180400000<\/dataTerminoPeriodo><ocorrencias><Set /><\/ocorrencias><ocorrenciasAtualizacao><Set /><\/ocorrenciasAtualizacao><inss><Inss><internalRef>970094<\/internalRef><\/Inss><\/inss><\/InssSobreSalariosPagos><\/inssSobreSalariosPagos><\/Inss><\/inss><previdenciaPrivada><PrevidenciaPrivada><id>967954<\/id><versao>1<\/versao><apurarPrevidenciaPrivada>false<\/apurarPrevidenciaPrivada><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><aliquotas><Set /><\/aliquotas><ocorrencias><Set /><\/ocorrencias><\/PrevidenciaPrivada><\/previdenciaPrivada><pensaoAlimenticia><PensaoAlimenticia><id>967953<\/id><versao>0<\/versao><apurarPensaoAlimenticia>false<\/apurarPensaoAlimenticia><aliquota>null<\/aliquota><incidirSobreJuros>false<\/incidirSobreJuros><valorBaseVerbas>0<\/valorBaseVerbas><valorBaseVerbasTributaveis>0<\/valorBaseVerbasTributaveis><valorBaseFgts>0<\/valorBaseFgts><valorBaseMultaDoFgts>0<\/valorBaseMultaDoFgts><origemRegistro>CALCULO<\/origemRegistro><dataEvento>null<\/dataEvento><folhaDoEvento>null<\/folhaDoEvento><percPrincipalTributavel>null<\/percPrincipalTributavel><percPrincipalNaoTributavel>null<\/percPrincipalNaoTributavel><incidirSobrePrincipalTributavel>true<\/incidirSobrePrincipalTributavel><incidirSobrePrincipalNaoTributavel>false<\/incidirSobrePrincipalNaoTributavel><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><\/PensaoAlimenticia><\/pensaoAlimenticia><parametrosDeAtualizacao><ParametrosDeAtualizacao><id>978969<\/id><versao>3<\/versao><indiceTrabalhista>IPCAE<\/indiceTrabalhista><outroIndiceTrabalhista>SELIC<\/outroIndiceTrabalhista><combinarOutroIndice>true<\/combinarOutroIndice><apartirDeOutroIndice>1705287600000<\/apartirDeOutroIndice><ignorarTaxaNegativa>false<\/ignorarTaxaNegativa><jurosPadrao>null<\/jurosPadrao><entePublico>null<\/entePublico><apertirDe>null<\/apertirDe><juros>TRD_SIMPLES<\/juros><aplicarJurosFasePreJudicial>true<\/aplicarJurosFasePreJudicial><combinarOutroJuros>true<\/combinarOutroJuros><baseDeJurosDasVerbas>VERBA_INSS<\/baseDeJurosDasVerbas><indiceDeCorrecaoDoFGTS>UTILIZAR_INDICE_TRABALHISTA<\/indiceDeCorrecaoDoFGTS><jurosDeFgtsComJam>false<\/jurosDeFgtsComJam><indiceDeCorrecaoDePrevidenciaPrivada>UTILIZAR_INDICE_TRABALHISTA<\/indiceDeCorrecaoDePrevidenciaPrivada><outroIndiceDeCorrecaoDePrevidenciaPrivada>null<\/outroIndiceDeCorrecaoDePrevidenciaPrivada><jurosDePrevidenciaPrivada>false<\/jurosDePrevidenciaPrivada><indiceDeCorrecaoDasCustas>UTILIZAR_INDICE_TRABALHISTA<\/indiceDeCorrecaoDasCustas><outroIndiceDeCorrecaoDasCustas>null<\/outroIndiceDeCorrecaoDasCustas><jurosDeCustas>false<\/jurosDeCustas><correcaoTrabalhistaDosSalariosDevidosDoINSS>true<\/correcaoTrabalhistaDosSalariosDevidosDoINSS><jurosTrabalhistasDosSalariosDevidosDoINSS>false<\/jurosTrabalhistasDosSalariosDevidosDoINSS><aplicarAteDosSalariosDevidosDoINSS>null<\/aplicarAteDosSalariosDevidosDoINSS><correcaoPrevidenciariaDosSalariosDevidosDoINSS>false<\/correcaoPrevidenciariaDosSalariosDevidosDoINSS><jurosPrevidenciariosDosSalariosDevidosDoINSS>false<\/jurosPrevidenciariosDosSalariosDevidosDoINSS><aplicarMultaDosSalariosDevidosDoINSS>false<\/aplicarMultaDosSalariosDevidosDoINSS><tipoDeMultaDosSalariosDevidosDoINSS>URBANA<\/tipoDeMultaDosSalariosDevidosDoINSS><pagamentoDaMultaDosSalariosDevidosDoINSS>INTEGRAL<\/pagamentoDaMultaDosSalariosDevidosDoINSS><salarioDevidoFormaAplicacao>null<\/salarioDevidoFormaAplicacao><salarioPagoFormaAplicacao>MES_A_MES<\/salarioPagoFormaAplicacao><correcaoTrabalhistaDosSalariosPagosDoINSS>false<\/correcaoTrabalhistaDosSalariosPagosDoINSS><jurosTrabalhistasDosSalariosPagosDoINSS>false<\/jurosTrabalhistasDosSalariosPagosDoINSS><aplicarAteDosSalariosPagosDoINSS>null<\/aplicarAteDosSalariosPagosDoINSS><correcaoPrevidenciariaDosSalariosPagosDoINSS>true<\/correcaoPrevidenciariaDosSalariosPagosDoINSS><jurosPrevidenciariosDosSalariosPagosDoINSS>true<\/jurosPrevidenciariosDosSalariosPagosDoINSS><aplicarMultaDosSalariosPagosDoINSS>true<\/aplicarMultaDosSalariosPagosDoINSS><tipoDeMultaDosSalariosPagosDoINSS>URBANA<\/tipoDeMultaDosSalariosPagosDoINSS><pagamentoDaMultaDosSalariosPagosDoINSS>INTEGRAL<\/pagamentoDaMultaDosSalariosPagosDoINSS><dataInicialDoJurosPadrao>null<\/dataInicialDoJurosPadrao><dataFinalDoJurosPadrao>null<\/dataFinalDoJurosPadrao><dataInicialDoJurosFazendaPublica>null<\/dataInicialDoJurosFazendaPublica><dataFinalDoJurosFazendaPublica>null<\/dataFinalDoJurosFazendaPublica><correcaoDasCustas>true<\/correcaoDasCustas><lei11941>true<\/lei11941><apartirDeLei11941>1236222000000<\/apartirDeLei11941><apartirDeLei11941Multa>null<\/apartirDeLei11941Multa><lei11941Pago>false<\/lei11941Pago><lei11941Multa>true<\/lei11941Multa><apartirDeLei11941Pago>1236222000000<\/apartirDeLei11941Pago><lei11941PagoMulta>false<\/lei11941PagoMulta><apartirDeLei11941PagoMulta>null<\/apartirDeLei11941PagoMulta><informacaoUltimoIndice> Última taxa 'IPCA' relativa a 06/2026.<\/informacaoUltimoIndice><informacaoUltimoIndiceAtualizacao /><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><listaDeExcecaoDeJurosDaAtualizacao><Set /><\/listaDeExcecaoDeJurosDaAtualizacao><listaDeCombinacaoDeIndices><Set><CombinacaoDeIndice><id>332996<\/id><versao>0<\/versao><outroIndiceTrabalhista>SELIC<\/outroIndiceTrabalhista><apartirDeOutroIndice>1705287600000<\/apartirDeOutroIndice><parametrosDeAtualizacao><ParametrosDeAtualizacao><internalRef>978969<\/internalRef><\/ParametrosDeAtualizacao><\/parametrosDeAtualizacao><\/CombinacaoDeIndice><CombinacaoDeIndice><id>332997<\/id><versao>0<\/versao><outroIndiceTrabalhista>IPCA<\/outroIndiceTrabalhista><apartirDeOutroIndice>1725073200000<\/apartirDeOutroIndice><parametrosDeAtualizacao><ParametrosDeAtualizacao><internalRef>978969<\/internalRef><\/ParametrosDeAtualizacao><\/parametrosDeAtualizacao><\/CombinacaoDeIndice><\/Set><\/listaDeCombinacaoDeIndices><listaDeCombinacaoDeJuros><Set><CombinacaoDeJuros><id>349753<\/id><versao>0<\/versao><outroJuros>SEM_JUROS<\/outroJuros><apartirDeOutroJuros>1705287600000<\/apartirDeOutroJuros><parametrosDeAtualizacao><ParametrosDeAtualizacao><internalRef>978969<\/internalRef><\/ParametrosDeAtualizacao><\/parametrosDeAtualizacao><\/CombinacaoDeJuros><CombinacaoDeJuros><id>349757<\/id><versao>0<\/versao><outroJuros>TAXA_LEGAL<\/outroJuros><apartirDeOutroJuros>1725073200000<\/apartirDeOutroJuros><parametrosDeAtualizacao><ParametrosDeAtualizacao><internalRef>978969<\/internalRef><\/ParametrosDeAtualizacao><\/parametrosDeAtualizacao><\/CombinacaoDeJuros><\/Set><\/listaDeCombinacaoDeJuros><\/ParametrosDeAtualizacao><\/parametrosDeAtualizacao><multas><Set /><\/multas><honorarios><Set /><\/honorarios><irpf><Irpf><id>968949<\/id><versao>1<\/versao><apurarImpostoRenda>true<\/apurarImpostoRenda><incidirSobreJurosDeMora>false<\/incidirSobreJurosDeMora><cobrarDoReclamado>false<\/cobrarDoReclamado><considerarTributacaoExclusiva>false<\/considerarTributacaoExclusiva><considerarTributacaoEmSeparado>false<\/considerarTributacaoEmSeparado><regimeDeCaixa>false<\/regimeDeCaixa><deduzirContribuicaoSocialDevidaPeloReclamante>true<\/deduzirContribuicaoSocialDevidaPeloReclamante><deduzirPrevidenciaPrivada>true<\/deduzirPrevidenciaPrivada><deduzirPensaoAlimenticia>true<\/deduzirPensaoAlimenticia><deduzirHonorariosDevidosPeloReclamante>true<\/deduzirHonorariosDevidosPeloReclamante><aposentadoMaiorQue65Anos>false<\/aposentadoMaiorQue65Anos><possuiDependentes>false<\/possuiDependentes><quantidadeDependentes>0<\/quantidadeDependentes><dataInicioAnosAnteriores>1672542000000<\/dataInicioAnosAnteriores><dataFimAnosAnteriores>1688180400000<\/dataFimAnosAnteriores><dataInicioAnoRecebimento>1767236400000<\/dataInicioAnoRecebimento><dataFimAnoRecebimento>null<\/dataFimAnoRecebimento><qtdMesesRendimentoTributaveis>null<\/qtdMesesRendimentoTributaveis><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><ocorrencias><Set /><\/ocorrencias><ocorrenciasAtualizacao><Set /><\/ocorrenciasAtualizacao><ocorrenciasPagamento><Set /><\/ocorrenciasPagamento><\/Irpf><\/irpf><custasJudiciais><CustasJudiciais><id>970831<\/id><versao>0<\/versao><baseParaCustasCalculadas>BRUTO_DEVIDO_AO_RECLAMANTE_MAIS_DEBITOS_RECLAMADO<\/baseParaCustasCalculadas><tipoDeCustasDeConhecimentoDoReclamante>NAO_SE_APLICA<\/tipoDeCustasDeConhecimentoDoReclamante><dataVencimentoConhecimentoDoReclamante>null<\/dataVencimentoConhecimentoDoReclamante><valorDeConhecimentoDoReclamante>null<\/valorDeConhecimentoDoReclamante><tipoDeCustasDeConhecimentoDoReclamado>CALCULADA_2_POR_CENTO<\/tipoDeCustasDeConhecimentoDoReclamado><dataVencimentoConhecimentoDoReclamado>1788145200000<\/dataVencimentoConhecimentoDoReclamado><valorConhecimentoDoReclamado>null<\/valorConhecimentoDoReclamado><tipoDeCustasDeLiquidacao>NAO_SE_APLICA<\/tipoDeCustasDeLiquidacao><dataVencimentoCustasDeLiquidacao>null<\/dataVencimentoCustasDeLiquidacao><valorCustasDeLiquidacao>null<\/valorCustasDeLiquidacao><dataVencimentoCustasFixas>null<\/dataVencimentoCustasFixas><qtdeAtosUrbanos>null<\/qtdeAtosUrbanos><qtdeAtosRurais>null<\/qtdeAtosRurais><qtdeAgravosDeInstrumento>null<\/qtdeAgravosDeInstrumento><qtdeAgravosDePeticao>null<\/qtdeAgravosDePeticao><qtdeImpugnacaoSentenca>null<\/qtdeImpugnacaoSentenca><qtdeEmbargosArrematacao>null<\/qtdeEmbargosArrematacao><qtdeEmbargosExecucao>null<\/qtdeEmbargosExecucao><qtdeEmbargosTerceiros>null<\/qtdeEmbargosTerceiros><qtdeRecursoRevista>null<\/qtdeRecursoRevista><valorBaseCustasCalculadas>null<\/valorBaseCustasCalculadas><indiceCorrecaoCustasConhecimentoReclamante>null<\/indiceCorrecaoCustasConhecimentoReclamante><taxaJurosCustasConhecimentoReclamante>null<\/taxaJurosCustasConhecimentoReclamante><indiceCorrecaoCustasConhecimentoReclamado>null<\/indiceCorrecaoCustasConhecimentoReclamado><taxaJurosCustasConhecimentoReclamado>null<\/taxaJurosCustasConhecimentoReclamado><indiceCorrecaoCustasLiquidacao>null<\/indiceCorrecaoCustasLiquidacao><taxaJurosCustasLiquidacao>null<\/taxaJurosCustasLiquidacao><indiceCorrecaoCustasFixas>null<\/indiceCorrecaoCustasFixas><taxaJurosCustasFixas>null<\/taxaJurosCustasFixas><pisoCustasConhecimentoReclamante>null<\/pisoCustasConhecimentoReclamante><pisoCustasConhecimentoReclamado>null<\/pisoCustasConhecimentoReclamado><tetoCustasConhecimentoReclamante>null<\/tetoCustasConhecimentoReclamante><tetoCustasConhecimentoReclamado>null<\/tetoCustasConhecimentoReclamado><tetoCustasLiquidacao>null<\/tetoCustasLiquidacao><valorAtosUrbanos>null<\/valorAtosUrbanos><valorAtosRurais>null<\/valorAtosRurais><valorAgravoInstrumento>null<\/valorAgravoInstrumento><valorAgravoPeticao>null<\/valorAgravoPeticao><valorImpuganacaoSentenca>null<\/valorImpuganacaoSentenca><valorEmbargosArrematacao>null<\/valorEmbargosArrematacao><valorEmbargosExecucao>null<\/valorEmbargosExecucao><valorEmbargosTerceiros>null<\/valorEmbargosTerceiros><valorRecursoRevista>null<\/valorRecursoRevista><folhaDoEvento>null<\/folhaDoEvento><tipoCobrancaReclamante>DESCONTAR_CREDITO<\/tipoCobrancaReclamante><aplicarTetoCustasConhecimentoCalcExterno>false<\/aplicarTetoCustasConhecimentoCalcExterno><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><autosJudiciais><Set /><\/autosJudiciais><custasFixasAtualizacao><Set /><\/custasFixasAtualizacao><armazenamentos><Set /><\/armazenamentos><custasPagasDoReclamado><Set /><\/custasPagasDoReclamado><custasPagasDoReclamante><Set /><\/custasPagasDoReclamante><\/CustasJudiciais><\/custasJudiciais><seguroDesemprego><SeguroDesemprego><id>967834<\/id><versao>0<\/versao><apurarSeguroDesemprego>false<\/apurarSeguroDesemprego><empregadoDomestico>false<\/empregadoDomestico><tipoValorDoSeguroDesemprego>CALCULADO<\/tipoValorDoSeguroDesemprego><tipoSolicitacao>null<\/tipoSolicitacao><numeroDeParcelas>0<\/numeroDeParcelas><tipoSalarioPago>HISTORICO_SALARIAL<\/tipoSalarioPago><remuneracaoMensal>0<\/remuneracaoMensal><limiteFaixa1>0<\/limiteFaixa1><valorPercentualFaixa1>0<\/valorPercentualFaixa1><valorPercentualFaixa2>0<\/valorPercentualFaixa2><somaFaixa2>0<\/somaFaixa2><valorPiso>0<\/valorPiso><valorTeto>0<\/valorTeto><valorSeguroDesemprego>0<\/valorSeguroDesemprego><indiceDeCorrecao>0<\/indiceDeCorrecao><taxaDeJuros>0<\/taxaDeJuros><comporPrincipal>SIM<\/comporPrincipal><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><itensHistoricoSalarialDeSegudoDesemprego><Set /><\/itensHistoricoSalarialDeSegudoDesemprego><itensSalarioDevidoDeSeguroDesemprego><Set /><\/itensSalarioDevidoDeSeguroDesemprego><\/SeguroDesemprego><\/seguroDesemprego><salarioFamilia><SalarioFamilia><id>967828<\/id><versao>1<\/versao><apurarSalarioFamilia>false<\/apurarSalarioFamilia><quantFilhosMenores14Anos>null<\/quantFilhosMenores14Anos><dataInicial>null<\/dataInicial><dataFinal>null<\/dataFinal><tipoSalarioPago>HISTORICO_SALARIAL<\/tipoSalarioPago><comporPrincipal>SIM<\/comporPrincipal><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><variacaoQuantidadesFilhos><List /><\/variacaoQuantidadesFilhos><itensHistoricoSalarial><Set /><\/itensHistoricoSalarial><itensSalarioDevido><Set /><\/itensSalarioDevido><ocorrencias><Set /><\/ocorrencias><\/SalarioFamilia><\/salarioFamilia><pontosFacultativos><Set /><\/pontosFacultativos><historicosValidacao><Set /><\/historicosValidacao><historicosValidacaoAtualizacao><Set /><\/historicosValidacaoAtualizacao><cartoesDePonto><Set /><\/cartoesDePonto><pagamentos><Set /><\/pagamentos><apuracoesCartaoDePonto><Set /><\/apuracoesCartaoDePonto><apuracoesDiariasCartaoDePonto><Set /><\/apuracoesDiariasCartaoDePonto><excecoesDoFechamentoDeCartaoDePonto><Set /><\/excecoesDoFechamentoDeCartaoDePonto><\/Calculo>",
 "moldes": {
  "calculadaTabelada": "<Calculada><id>7296410<\/id><versao>3<\/versao><nome>ADICIONAL DE INSALUBRIDADE 20%<\/nome><descricao>ADICIONAL DE INSALUBRIDADE 20%<\/descricao><tipoVariacaoParcela>FIXA<\/tipoVariacaoParcela><incidenciaINSS>true<\/incidenciaINSS><incidenciaIRPF>true<\/incidenciaIRPF><incidenciaFGTS>true<\/incidenciaFGTS><incidenciaPrevidenciaPrivada>false<\/incidenciaPrevidenciaPrivada><incidenciaPensaoAlimenticia>false<\/incidenciaPensaoAlimenticia><caracteristica>COMUM<\/caracteristica><ocorrenciaDePagamento>MENSAL<\/ocorrenciaDePagamento><jurosDoAjuizamento>OCORRENCIAS_VENCIDAS<\/jurosDoAjuizamento><gerarPrincipal>DIFERENCA<\/gerarPrincipal><periodoInicial>1672542000000<\/periodoInicial><periodoFinal>1688180400000<\/periodoFinal><zeraValorNegativo>false<\/zeraValorNegativo><comentarios>null<\/comentarios><gerarReflexo>DIFERENCA<\/gerarReflexo><aplicarProporcionalidade>true<\/aplicarProporcionalidade><ativo>true<\/ativo><comporPrincipal>SIM<\/comporPrincipal><verbaAlterada>false<\/verbaAlterada><salarioCategoriaValorDevido>null<\/salarioCategoriaValorDevido><salarioCategoriaValorPago>null<\/salarioCategoriaValorPago><excluirFaltaJustificada>false<\/excluirFaltaJustificada><excluirFaltaNaoJustificada>true<\/excluirFaltaNaoJustificada><excluirFeriasGozadas>true<\/excluirFeriasGozadas><ordem>0<\/ordem><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><assuntoCnj><AssuntoCnj><externalRef>1666<\/externalRef><\/AssuntoCnj><\/assuntoCnj><formula><FormulaCalculada><dobra>false<\/dobra><id>7296410<\/id><versao>0<\/versao><baseTabelada><BaseTabelada><tipo>SALARIO_MINIMO<\/tipo><aplicarProporcionalidade>true<\/aplicarProporcionalidade><\/BaseTabelada><\/baseTabelada><baseVerba><BaseVerba><itens><List /><\/itens><\/BaseVerba><\/baseVerba><divisor><Divisor><id>3032531<\/id><tipo>OUTRO_VALOR<\/tipo><outroValor>1<\/outroValor><\/Divisor><\/divisor><multiplicador><Multiplicador><outroValor>0.2<\/outroValor><\/Multiplicador><\/multiplicador><quantidade><Quantidade><id>3032530<\/id><tipo>INFORMADA<\/tipo><valorInformado>1<\/valorInformado><tipoImportadadoDoCartaoDePonto>null<\/tipoImportadadoDoCartaoDePonto><tipoImportadaCalendarioEnum>null<\/tipoImportadaCalendarioEnum><aplicarProporcionalidade>false<\/aplicarProporcionalidade><\/Quantidade><\/quantidade><verbaDeCalculo><Calculada><internalRef>7296410<\/internalRef><\/Calculada><\/verbaDeCalculo><valorPago><ValorPago><id>7296410<\/id><tipo>CALCULADO<\/tipo><valorInformado>0<\/valorInformado><quantidade>1<\/quantidade><aplicarProporcionalidade>false<\/aplicarProporcionalidade><baseTabelada>HISTORICO_SALARIAL<\/baseTabelada><\/ValorPago><\/valorPago><\/FormulaCalculada><\/formula><ocorrencias><List /><\/ocorrencias><historicosDaVerbaDoValorDevido><List /><\/historicosDaVerbaDoValorDevido><historicosDaVerbaDoValorPago><List><HistoricoSalarialDaVerba><id>958752<\/id><tipoVinculoHistorico>VALOR_PAGO<\/tipoVinculoHistorico><aplicarProporcionalidade>false<\/aplicarProporcionalidade><verbaDeCalculo><Calculada><internalRef>7296410<\/internalRef><\/Calculada><\/verbaDeCalculo><historicoSalarial><HistoricoSalarial><internalRef>867455<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/HistoricoSalarialDaVerba><\/List><\/historicosDaVerbaDoValorPago><cartoesDePontoDaVerbaQuantidade><List /><\/cartoesDePontoDaVerbaQuantidade><cartoesDePontoDaVerbaDivisor><List /><\/cartoesDePontoDaVerbaDivisor><valesTransportesDoValorDevido><List /><\/valesTransportesDoValorDevido><valesTransportesDoValorPago><List /><\/valesTransportesDoValorPago><\/Calculada>",
  "calculadaHistorico": "<Calculada><id>7296407<\/id><versao>10<\/versao><nome>HORAS EXTRAS 100%<\/nome><descricao>HORAS EXTRAS 100%<\/descricao><tipoVariacaoParcela>VARIAVEL<\/tipoVariacaoParcela><incidenciaINSS>true<\/incidenciaINSS><incidenciaIRPF>true<\/incidenciaIRPF><incidenciaFGTS>true<\/incidenciaFGTS><incidenciaPrevidenciaPrivada>false<\/incidenciaPrevidenciaPrivada><incidenciaPensaoAlimenticia>false<\/incidenciaPensaoAlimenticia><caracteristica>COMUM<\/caracteristica><ocorrenciaDePagamento>MENSAL<\/ocorrenciaDePagamento><jurosDoAjuizamento>OCORRENCIAS_VENCIDAS<\/jurosDoAjuizamento><gerarPrincipal>DIFERENCA<\/gerarPrincipal><periodoInicial>1672542000000<\/periodoInicial><periodoFinal>1688180400000<\/periodoFinal><zeraValorNegativo>false<\/zeraValorNegativo><comentarios>null<\/comentarios><gerarReflexo>DIFERENCA<\/gerarReflexo><aplicarProporcionalidade>false<\/aplicarProporcionalidade><ativo>true<\/ativo><comporPrincipal>SIM<\/comporPrincipal><verbaAlterada>false<\/verbaAlterada><salarioCategoriaValorDevido>null<\/salarioCategoriaValorDevido><salarioCategoriaValorPago>null<\/salarioCategoriaValorPago><excluirFaltaJustificada>true<\/excluirFaltaJustificada><excluirFaltaNaoJustificada>true<\/excluirFaltaNaoJustificada><excluirFeriasGozadas>true<\/excluirFeriasGozadas><ordem>3<\/ordem><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><assuntoCnj><AssuntoCnj><externalRef>2086<\/externalRef><\/AssuntoCnj><\/assuntoCnj><formula><FormulaCalculada><dobra>false<\/dobra><id>7296407<\/id><versao>0<\/versao><baseTabelada><BaseTabelada><tipo>HISTORICO_SALARIAL<\/tipo><aplicarProporcionalidade>false<\/aplicarProporcionalidade><\/BaseTabelada><\/baseTabelada><baseVerba><BaseVerba><itens><List /><\/itens><\/BaseVerba><\/baseVerba><divisor><Divisor><id>3032528<\/id><tipo>CARGA_HORARIA<\/tipo><outroValor>null<\/outroValor><\/Divisor><\/divisor><multiplicador><Multiplicador><outroValor>2<\/outroValor><\/Multiplicador><\/multiplicador><quantidade><Quantidade><id>3032527<\/id><tipo>IMPORTADA_DO_CARTAO<\/tipo><valorInformado>0<\/valorInformado><tipoImportadadoDoCartaoDePonto>null<\/tipoImportadadoDoCartaoDePonto><tipoImportadaCalendarioEnum>null<\/tipoImportadaCalendarioEnum><aplicarProporcionalidade>true<\/aplicarProporcionalidade><\/Quantidade><\/quantidade><verbaDeCalculo><Calculada><internalRef>7296407<\/internalRef><\/Calculada><\/verbaDeCalculo><valorPago><ValorPago><id>7296407<\/id><tipo>INFORMADO<\/tipo><valorInformado>0<\/valorInformado><quantidade>1<\/quantidade><aplicarProporcionalidade>false<\/aplicarProporcionalidade><baseTabelada>null<\/baseTabelada><\/ValorPago><\/valorPago><\/FormulaCalculada><\/formula><ocorrencias><List /><\/ocorrencias><historicosDaVerbaDoValorDevido><List><HistoricoSalarialDaVerba><id>958767<\/id><tipoVinculoHistorico>BASE<\/tipoVinculoHistorico><aplicarProporcionalidade>false<\/aplicarProporcionalidade><verbaDeCalculo><Calculada><internalRef>7296407<\/internalRef><\/Calculada><\/verbaDeCalculo><historicoSalarial><HistoricoSalarial><internalRef>867453<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/HistoricoSalarialDaVerba><HistoricoSalarialDaVerba><id>958768<\/id><tipoVinculoHistorico>BASE<\/tipoVinculoHistorico><aplicarProporcionalidade>false<\/aplicarProporcionalidade><verbaDeCalculo><Calculada><internalRef>7296407<\/internalRef><\/Calculada><\/verbaDeCalculo><historicoSalarial><HistoricoSalarial><internalRef>867455<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/HistoricoSalarialDaVerba><HistoricoSalarialDaVerba><id>958769<\/id><tipoVinculoHistorico>BASE<\/tipoVinculoHistorico><aplicarProporcionalidade>false<\/aplicarProporcionalidade><verbaDeCalculo><Calculada><internalRef>7296407<\/internalRef><\/Calculada><\/verbaDeCalculo><historicoSalarial><HistoricoSalarial><internalRef>867454<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/HistoricoSalarialDaVerba><\/List><\/historicosDaVerbaDoValorDevido><historicosDaVerbaDoValorPago><List /><\/historicosDaVerbaDoValorPago><cartoesDePontoDaVerbaQuantidade><List><CartaoDePontoDaVerba><id>237900<\/id><tipoVinculoCartao>QUANTIDADE<\/tipoVinculoCartao><verbaDeCalculo><Calculada><internalRef>7296407<\/internalRef><\/Calculada><\/verbaDeCalculo><cartaoDePonto><CartaoDePonto><internalRef>378291<\/internalRef><\/CartaoDePonto><\/cartaoDePonto><\/CartaoDePontoDaVerba><\/List><\/cartoesDePontoDaVerbaQuantidade><cartoesDePontoDaVerbaDivisor><List /><\/cartoesDePontoDaVerbaDivisor><valesTransportesDoValorDevido><List /><\/valesTransportesDoValorDevido><valesTransportesDoValorPago><List /><\/valesTransportesDoValorPago><\/Calculada>",
  "informada": "<Informada><id>7296403<\/id><versao>4<\/versao><nome>TÍQUETE-ALIMENTAÇÃO<\/nome><descricao>TÍQUETE-ALIMENTAÇÃO<\/descricao><tipoVariacaoParcela>FIXA<\/tipoVariacaoParcela><incidenciaINSS>false<\/incidenciaINSS><incidenciaIRPF>false<\/incidenciaIRPF><incidenciaFGTS>false<\/incidenciaFGTS><incidenciaPrevidenciaPrivada>false<\/incidenciaPrevidenciaPrivada><incidenciaPensaoAlimenticia>false<\/incidenciaPensaoAlimenticia><caracteristica>COMUM<\/caracteristica><ocorrenciaDePagamento>MENSAL<\/ocorrenciaDePagamento><jurosDoAjuizamento>OCORRENCIAS_VENCIDAS<\/jurosDoAjuizamento><gerarPrincipal>DIFERENCA<\/gerarPrincipal><periodoInicial>1672542000000<\/periodoInicial><periodoFinal>1688180400000<\/periodoFinal><zeraValorNegativo>false<\/zeraValorNegativo><comentarios>null<\/comentarios><gerarReflexo>DIFERENCA<\/gerarReflexo><aplicarProporcionalidade>true<\/aplicarProporcionalidade><ativo>true<\/ativo><comporPrincipal>SIM<\/comporPrincipal><verbaAlterada>false<\/verbaAlterada><salarioCategoriaValorDevido>null<\/salarioCategoriaValorDevido><salarioCategoriaValorPago>null<\/salarioCategoriaValorPago><excluirFaltaJustificada>false<\/excluirFaltaJustificada><excluirFaltaNaoJustificada>false<\/excluirFaltaNaoJustificada><excluirFeriasGozadas>false<\/excluirFeriasGozadas><ordem>7<\/ordem><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><assuntoCnj><AssuntoCnj><externalRef>2506<\/externalRef><\/AssuntoCnj><\/assuntoCnj><formula><FormulaInformada><id>7296403<\/id><versao>1<\/versao><constante><Constante><valor>150<\/valor><\/Constante><\/constante><verbaDeCalculo><Informada><internalRef>7296403<\/internalRef><\/Informada><\/verbaDeCalculo><valorPago><ValorPago><id>7296403<\/id><tipo>INFORMADO<\/tipo><valorInformado>0<\/valorInformado><quantidade>1<\/quantidade><aplicarProporcionalidade>false<\/aplicarProporcionalidade><baseTabelada>null<\/baseTabelada><\/ValorPago><\/valorPago><\/FormulaInformada><\/formula><ocorrencias><List /><\/ocorrencias><historicosDaVerbaDoValorDevido><List /><\/historicosDaVerbaDoValorDevido><historicosDaVerbaDoValorPago><List /><\/historicosDaVerbaDoValorPago><cartoesDePontoDaVerbaQuantidade><List /><\/cartoesDePontoDaVerbaQuantidade><cartoesDePontoDaVerbaDivisor><List /><\/cartoesDePontoDaVerbaDivisor><valesTransportesDoValorDevido><List /><\/valesTransportesDoValorDevido><valesTransportesDoValorPago><List /><\/valesTransportesDoValorPago><\/Informada>",
  "reflexo": "<Reflexo><comportamentoDoReflexo>VALOR_MENSAL<\/comportamentoDoReflexo><periodoMediaReflexo>PERIODO_AQUISITIVO<\/periodoMediaReflexo><tratamentoDaFracaoDeMesDoReflexo>INTEGRALIZAR<\/tratamentoDaFracaoDeMesDoReflexo><id>7296413<\/id><versao>0<\/versao><nome>AVISO PRÉVIO SOBRE ADICIONAL DE INSALUBRIDADE 20%<\/nome><descricao>AVISO PRÉVIO<\/descricao><tipoVariacaoParcela>FIXA<\/tipoVariacaoParcela><incidenciaINSS>false<\/incidenciaINSS><incidenciaIRPF>false<\/incidenciaIRPF><incidenciaFGTS>false<\/incidenciaFGTS><incidenciaPrevidenciaPrivada>false<\/incidenciaPrevidenciaPrivada><incidenciaPensaoAlimenticia>false<\/incidenciaPensaoAlimenticia><caracteristica>AVISO_PREVIO<\/caracteristica><ocorrenciaDePagamento>DESLIGAMENTO<\/ocorrenciaDePagamento><jurosDoAjuizamento>OCORRENCIAS_VENCIDAS<\/jurosDoAjuizamento><gerarPrincipal>DIFERENCA<\/gerarPrincipal><periodoInicial>1672542000000<\/periodoInicial><periodoFinal>1688180400000<\/periodoFinal><zeraValorNegativo>false<\/zeraValorNegativo><comentarios>null<\/comentarios><gerarReflexo>DIFERENCA<\/gerarReflexo><aplicarProporcionalidade>false<\/aplicarProporcionalidade><ativo>false<\/ativo><comporPrincipal>SIM<\/comporPrincipal><verbaAlterada>false<\/verbaAlterada><salarioCategoriaValorDevido>null<\/salarioCategoriaValorDevido><salarioCategoriaValorPago>null<\/salarioCategoriaValorPago><excluirFaltaJustificada>false<\/excluirFaltaJustificada><excluirFaltaNaoJustificada>false<\/excluirFaltaNaoJustificada><excluirFeriasGozadas>false<\/excluirFeriasGozadas><ordem>0<\/ordem><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><assuntoCnj><AssuntoCnj><externalRef>2641<\/externalRef><\/AssuntoCnj><\/assuntoCnj><formula><FormulaReflexo><dobra>false<\/dobra><id>7296413<\/id><versao>0<\/versao><baseVerba><BaseVerba><itens><List><ItemBaseVerba><id>2399796<\/id><integralizar>NAO<\/integralizar><verbaDeCalculo><Calculada><internalRef>7296410<\/internalRef><\/Calculada><\/verbaDeCalculo><formula><FormulaReflexo><internalRef>7296413<\/internalRef><\/FormulaReflexo><\/formula><\/ItemBaseVerba><\/List><\/itens><\/BaseVerba><\/baseVerba><divisor><Divisor><id>3032534<\/id><tipo>OUTRO_VALOR<\/tipo><outroValor>30<\/outroValor><\/Divisor><\/divisor><multiplicador><Multiplicador><outroValor>1<\/outroValor><\/Multiplicador><\/multiplicador><quantidade><Quantidade><id>3032533<\/id><tipo>APURADA<\/tipo><valorInformado>30<\/valorInformado><tipoImportadadoDoCartaoDePonto>null<\/tipoImportadadoDoCartaoDePonto><tipoImportadaCalendarioEnum>null<\/tipoImportadaCalendarioEnum><aplicarProporcionalidade>false<\/aplicarProporcionalidade><\/Quantidade><\/quantidade><verbaDeCalculo><Reflexo><internalRef>7296413<\/internalRef><\/Reflexo><\/verbaDeCalculo><valorPago><ValorPago><id>7296413<\/id><tipo>INFORMADO<\/tipo><valorInformado>0<\/valorInformado><quantidade>null<\/quantidade><aplicarProporcionalidade>false<\/aplicarProporcionalidade><baseTabelada>null<\/baseTabelada><\/ValorPago><\/valorPago><\/FormulaReflexo><\/formula><ocorrencias><List /><\/ocorrencias><historicosDaVerbaDoValorDevido><List /><\/historicosDaVerbaDoValorDevido><historicosDaVerbaDoValorPago><List /><\/historicosDaVerbaDoValorPago><cartoesDePontoDaVerbaQuantidade><List /><\/cartoesDePontoDaVerbaQuantidade><cartoesDePontoDaVerbaDivisor><List /><\/cartoesDePontoDaVerbaDivisor><valesTransportesDoValorDevido><List /><\/valesTransportesDoValorDevido><valesTransportesDoValorPago><List /><\/valesTransportesDoValorPago><\/Reflexo>",
  "historicoSalarial": "<HistoricoSalarial><id>867455<\/id><versao>0<\/versao><nome>ADICIONAL DE INSALUBRIDADE PAGO<\/nome><tipoVariacaoParcela>VARIAVEL<\/tipoVariacaoParcela><incidenciaFGTS>true<\/incidenciaFGTS><aplicarProporcionalidadeFGTS>true<\/aplicarProporcionalidadeFGTS><incidenciaINSS>true<\/incidenciaINSS><aplicarProporcionalidadeINSS>true<\/aplicarProporcionalidadeINSS><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><ocorrencias><List><OcorrenciaDoHistoricoSalarial><id>22363735<\/id><versao>0<\/versao><dataOcorrencia>1672542000000<\/dataOcorrencia><valor>260.4<\/valor><recolhidoFGTS>false<\/recolhidoFGTS><recolhidoINSS>true<\/recolhidoINSS><incidenciaFGTS>true<\/incidenciaFGTS><incidenciaINSS>true<\/incidenciaINSS><historicoSalarial><HistoricoSalarial><internalRef>867455<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/OcorrenciaDoHistoricoSalarial><OcorrenciaDoHistoricoSalarial><id>22363736<\/id><versao>0<\/versao><dataOcorrencia>1675220400000<\/dataOcorrencia><valor>260.4<\/valor><recolhidoFGTS>false<\/recolhidoFGTS><recolhidoINSS>false<\/recolhidoINSS><incidenciaFGTS>true<\/incidenciaFGTS><incidenciaINSS>true<\/incidenciaINSS><historicoSalarial><HistoricoSalarial><internalRef>867455<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/OcorrenciaDoHistoricoSalarial><OcorrenciaDoHistoricoSalarial><id>22363737<\/id><versao>0<\/versao><dataOcorrencia>1677639600000<\/dataOcorrencia><valor>260.4<\/valor><recolhidoFGTS>true<\/recolhidoFGTS><recolhidoINSS>false<\/recolhidoINSS><incidenciaFGTS>true<\/incidenciaFGTS><incidenciaINSS>true<\/incidenciaINSS><historicoSalarial><HistoricoSalarial><internalRef>867455<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/OcorrenciaDoHistoricoSalarial><OcorrenciaDoHistoricoSalarial><id>22363738<\/id><versao>0<\/versao><dataOcorrencia>1680318000000<\/dataOcorrencia><valor>260.4<\/valor><recolhidoFGTS>false<\/recolhidoFGTS><recolhidoINSS>false<\/recolhidoINSS><incidenciaFGTS>true<\/incidenciaFGTS><incidenciaINSS>true<\/incidenciaINSS><historicoSalarial><HistoricoSalarial><internalRef>867455<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/OcorrenciaDoHistoricoSalarial><OcorrenciaDoHistoricoSalarial><id>22363739<\/id><versao>0<\/versao><dataOcorrencia>1682910000000<\/dataOcorrencia><valor>264<\/valor><recolhidoFGTS>true<\/recolhidoFGTS><recolhidoINSS>false<\/recolhidoINSS><incidenciaFGTS>true<\/incidenciaFGTS><incidenciaINSS>true<\/incidenciaINSS><historicoSalarial><HistoricoSalarial><internalRef>867455<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/OcorrenciaDoHistoricoSalarial><OcorrenciaDoHistoricoSalarial><id>22363740<\/id><versao>0<\/versao><dataOcorrencia>1685588400000<\/dataOcorrencia><valor>264<\/valor><recolhidoFGTS>false<\/recolhidoFGTS><recolhidoINSS>true<\/recolhidoINSS><incidenciaFGTS>true<\/incidenciaFGTS><incidenciaINSS>true<\/incidenciaINSS><historicoSalarial><HistoricoSalarial><internalRef>867455<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/OcorrenciaDoHistoricoSalarial><OcorrenciaDoHistoricoSalarial><id>22363741<\/id><versao>0<\/versao><dataOcorrencia>1688180400000<\/dataOcorrencia><valor>264<\/valor><recolhidoFGTS>false<\/recolhidoFGTS><recolhidoINSS>false<\/recolhidoINSS><incidenciaFGTS>true<\/incidenciaFGTS><incidenciaINSS>true<\/incidenciaINSS><historicoSalarial><HistoricoSalarial><internalRef>867455<\/internalRef><\/HistoricoSalarial><\/historicoSalarial><\/OcorrenciaDoHistoricoSalarial><\/List><\/ocorrencias><\/HistoricoSalarial>",
  "cartaoDePonto": "<CartaoDePonto><id>378293<\/id><nome>Dias Trabalhados<\/nome><versao>0<\/versao><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><ocorrencias><List><OcorrenciaDoCartaoDePonto><id>15305052<\/id><dataOcorrencia>1672542000000<\/dataOcorrencia><valor>27<\/valor><versao>0<\/versao><cartaoDePonto><CartaoDePonto><internalRef>378293<\/internalRef><\/CartaoDePonto><\/cartaoDePonto><\/OcorrenciaDoCartaoDePonto><OcorrenciaDoCartaoDePonto><id>15305053<\/id><dataOcorrencia>1675220400000<\/dataOcorrencia><valor>22<\/valor><versao>0<\/versao><cartaoDePonto><CartaoDePonto><internalRef>378293<\/internalRef><\/CartaoDePonto><\/cartaoDePonto><\/OcorrenciaDoCartaoDePonto><OcorrenciaDoCartaoDePonto><id>15305054<\/id><dataOcorrencia>1677639600000<\/dataOcorrencia><valor>27<\/valor><versao>0<\/versao><cartaoDePonto><CartaoDePonto><internalRef>378293<\/internalRef><\/CartaoDePonto><\/cartaoDePonto><\/OcorrenciaDoCartaoDePonto><OcorrenciaDoCartaoDePonto><id>15305055<\/id><dataOcorrencia>1680318000000<\/dataOcorrencia><valor>25<\/valor><versao>0<\/versao><cartaoDePonto><CartaoDePonto><internalRef>378293<\/internalRef><\/CartaoDePonto><\/cartaoDePonto><\/OcorrenciaDoCartaoDePonto><OcorrenciaDoCartaoDePonto><id>15305056<\/id><dataOcorrencia>1682910000000<\/dataOcorrencia><valor>27<\/valor><versao>0<\/versao><cartaoDePonto><CartaoDePonto><internalRef>378293<\/internalRef><\/CartaoDePonto><\/cartaoDePonto><\/OcorrenciaDoCartaoDePonto><OcorrenciaDoCartaoDePonto><id>15305057<\/id><dataOcorrencia>1685588400000<\/dataOcorrencia><valor>26<\/valor><versao>0<\/versao><cartaoDePonto><CartaoDePonto><internalRef>378293<\/internalRef><\/CartaoDePonto><\/cartaoDePonto><\/OcorrenciaDoCartaoDePonto><OcorrenciaDoCartaoDePonto><id>15305058<\/id><dataOcorrencia>1688180400000<\/dataOcorrencia><valor>1<\/valor><versao>0<\/versao><cartaoDePonto><CartaoDePonto><internalRef>378293<\/internalRef><\/CartaoDePonto><\/cartaoDePonto><\/OcorrenciaDoCartaoDePonto><\/List><\/ocorrencias><\/CartaoDePonto>",
  "falta": "<Falta><id>184916<\/id><versao>0<\/versao><dataInicioPeriodoFalta>1675220400000<\/dataInicioPeriodoFalta><dataTerminoPeriodoFalta>1675220400000<\/dataTerminoPeriodoFalta><faltaJustificada>true<\/faltaJustificada><justificativaDaFalta>COMPENSA DIA DE TRABALHO EM ELEICAO<\/justificativaDaFalta><reiniciarFerias>false<\/reiniciarFerias><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><\/Falta>",
  "pontoFacultativo": "<ItemPontoFacultativo><id>1775118<\/id><pontoFacultativo><Feriado><externalRef>09368bb6-d8dc-4e3a-ae3c-2d4d4521e552<\/externalRef><\/Feriado><\/pontoFacultativo><calculo><Calculo><internalRef>977442<\/internalRef><\/Calculo><\/calculo><\/ItemPontoFacultativo>"
 }
};
var PJC_EXEMPLO = {
  "anexo": "PJC-1.0",
  "processo": {
    "numeroCNJ": "0010042-17.2024.5.15.0005",
    "valorDaCausa": 71685.51,
    "dataAutuacao": "2024-01-15",
    "municipio": 6219,
    "reclamante": { "nome": "FULANA DE TAL" },
    "reclamado": { "nome": "EMPRESA ABCDEFG" },
    "advogadosReclamante": [{ "nome": "BELTRANO DE TAL" }]
  },
  "contrato": {
    "admissao": "2023-01-01",
    "demissao": "2023-07-01",
    "ajuizamento": "2024-01-15",
    "dataLiquidacao": "2026-06-30",
    "cargaHorariaPadrao": 220,
    "regime": "INTEGRAL",
    "sabadoDiaUtil": true,
    "projetaAvisoIndenizado": true,
    "ultimaRemuneracao": 10000,
    "maiorRemuneracao": 10000
  },
  "atualizacao": {
    "indiceTrabalhista": "IPCAE",
    "juros": "TRD_SIMPLES",
    "baseDeJurosDasVerbas": "VERBA_INSS",
    "combinacoesDeIndice": [
      { "indice": "SELIC", "apartirDe": "2024-01-15" },
      { "indice": "IPCA", "apartirDe": "2024-08-31" }
    ],
    "combinacoesDeJuros": [
      { "juros": "SEM_JUROS", "apartirDe": "2024-01-15" },
      { "juros": "TAXA_LEGAL", "apartirDe": "2024-08-31" }
    ]
  },
  "historicosSalariais": [
    {
      "nome": "SAL\u00c1RIO BASE",
      "variacao": "VARIAVEL",
      "incidenciaFGTS": true,
      "incidenciaINSS": true,
      "ocorrencias": [
        { "data": "2023-01-01", "valor": 2604.0 },
        { "data": "2023-02-01", "valor": 2604.0 },
        { "data": "2023-03-01", "valor": 2604.0 },
        { "data": "2023-04-01", "valor": 2800.0 },
        { "data": "2023-05-01", "valor": 2800.0 },
        { "data": "2023-06-01", "valor": 2800.0 }
      ]
    }
  ],
  "cartoesDePonto": [
    {
      "nome": "Horas Extras 50%",
      "ocorrencias": [
        { "data": "2023-01-01", "valor": 12 },
        { "data": "2023-02-01", "valor": 8 },
        { "data": "2023-03-01", "valor": 14 },
        { "data": "2023-04-01", "valor": 10 },
        { "data": "2023-05-01", "valor": 9 },
        { "data": "2023-06-01", "valor": 11 }
      ]
    }
  ],
  "faltas": [],
  "verbas": [
    {
      "tipo": "CALCULADA",
      "nome": "ADICIONAL DE INSALUBRIDADE 20%",
      "assuntoCnj": 1666,
      "natureza": "SALARIAL",
      "variacao": "FIXA",
      "base": { "tipo": "SALARIO_MINIMO" },
      "divisor": { "tipo": "OUTRO_VALOR", "valor": 1 },
      "multiplicador": 0.2,
      "quantidade": { "tipo": "INFORMADA", "valor": 1 },
      "fonte": "Senten\u00e7a, dispositivo, item 2"
    },
    {
      "tipo": "CALCULADA",
      "nome": "HORAS EXTRAS 50%",
      "assuntoCnj": 2086,
      "natureza": "SALARIAL",
      "variacao": "VARIAVEL",
      "base": { "tipo": "HISTORICO_SALARIAL" },
      "divisor": { "tipo": "CARGA_HORARIA" },
      "multiplicador": 1.5,
      "quantidade": { "tipo": "IMPORTADA_DO_CARTAO", "cartao": "Horas Extras 50%" },
      "fonte": "Senten\u00e7a, dispositivo, item 3"
    },
    {
      "tipo": "REFLEXO",
      "nome": "REPOUSO SEMANAL REMUNERADO SOBRE HORAS EXTRAS 50%",
      "descricao": "REPOUSO SEMANAL REMUNERADO E FERIADO",
      "assuntoCnj": 2426,
      "natureza": "SALARIAL",
      "baseVerbas": ["HORAS EXTRAS 50%"],
      "comportamento": "VALOR_MENSAL",
      "fonte": "Senten\u00e7a, fundamenta\u00e7\u00e3o, t\u00f3pico Horas Extras"
    },
    {
      "tipo": "INFORMADA",
      "nome": "T\u00cdQUETE-ALIMENTA\u00c7\u00c3O",
      "assuntoCnj": 2506,
      "natureza": "INDENIZATORIA",
      "variacao": "FIXA",
      "ocorrenciaDePagamento": "MENSAL",
      "valor": 150,
      "fonte": "Senten\u00e7a, dispositivo, item 5"
    }
  ],
  "encargos": {
    "fgts": { "destino": "DEPOSITAR", "multa": false }
  }
}
;
/* ---- montador ---- */
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

/* No HTML original este bloco era um UMD que se pendurava em window/module.
   No console basta uma variável local: nada vaza para o escopo global além
   de PJC. */
var PjcMontador = (function () {
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
  var VOCABULARIO = {
    "tipoVerba": ["CALCULADA", "INFORMADA", "REFLEXO"],
    "natureza": ["SALARIAL", "INDENIZATORIA"],
    "variacao": ["FIXA", "VARIAVEL"],
    "caracteristica": ["COMUM", "DECIMO_TERCEIRO_SALARIO", "AVISO_PREVIO", "FERIAS"],
    "ocorrenciaDePagamento": ["MENSAL", "DEZEMBRO", "DESLIGAMENTO", "PERIODO_AQUISITIVO"],
    "jurosDoAjuizamento": ["OCORRENCIAS_VENCIDAS", "OCORRENCIAS_VENCIDAS_E_VINCENDAS"],
    "gerar": ["DEVIDO", "DIFERENCA"],
    "comporPrincipal": ["SIM", "NAO"],
    "base": ["HISTORICO_SALARIAL", "SALARIO_MINIMO", "SALARIO_DA_CATEGORIA",
             "MAIOR_REMUNERACAO", "VALE_TRANSPORTE"],
    "divisor": ["CARGA_HORARIA", "DIAS_UTEIS", "IMPORTADA_DO_CARTAO", "OUTRO_VALOR"],
    "quantidade": ["INFORMADA", "IMPORTADA_DO_CARTAO", "IMPORTADA_DO_CALENDARIO"],
    "valorPago": ["INFORMADO", "CALCULADO"],
    "integralizar": ["SIM", "NAO"],
    "indice": ["IPCAE", "IPCA", "SELIC", "TR", "SEM_CORRECAO"],
    "juros": ["TRD_SIMPLES", "TAXA_LEGAL", "SEM_JUROS"],
    "regime": ["INTEGRAL", "PARCIAL", "INTERMITENTE"],
    "prazoAvisoPrevio": ["APURACAO_CALCULADA", "APURACAO_INFORMADA", "NAO_APURAR"],
    "comportamentoDoReflexo": ["VALOR_MENSAL", "MEDIA_PELA_QUANTIDADE",
                               "MEDIA_FISICA", "MEDIA_DUODECIMOS"],
    "destinoDoFgts": ["DEPOSITAR", "PAGAR"]
  };

  /* Grafias equivalentes que as LLMs produzem com frequência. Aceitar e
     padronizar sai mais barato do que insistir na instrução: o valor pretendido
     é inequívoco, e cada rejeição custa uma rodada de correção. */
  var SINONIMOS = {
    "IPCA_E": "IPCAE", "IPCAE": "IPCAE", "IPCA-E": "IPCAE",
    "TR_SIMPLES": "TRD_SIMPLES", "TRD": "TRD_SIMPLES",
    "SEM_CORRECAO_MONETARIA": "SEM_CORRECAO", "SEM_INDICE": "SEM_CORRECAO",
    "PISO_SALARIAL": "SALARIO_DA_CATEGORIA",
    "SALARIO_CATEGORIA": "SALARIO_DA_CATEGORIA",
    "INDENIZATORIO": "INDENIZATORIA", "SALARIO": "SALARIAL",
    "UNICA": "DESLIGAMENTO", "ANUAL": "DEZEMBRO",
    "IMPORTADA_DO_CALENDARIO": "IMPORTADA_DO_CALENDARIO",
    "CONTA_VINCULADA": "DEPOSITAR", "DEPOSITO_CONTA_VINCULADA": "DEPOSITAR",
    "DEPOSITO": "DEPOSITAR", "PAGAMENTO_DIRETO": "PAGAR"
  };

  function semAcento(s) {
    return String(s).normalize ? String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                               : String(s);
  }

  function padronizar(valor, lista) {
    if (valor === null || valor === undefined) return valor;
    var v = semAcento(valor).toUpperCase().replace(/[\s-]+/g, "_");
    if (VOCABULARIO[lista].indexOf(v) >= 0) return v;
    var alvo = SINONIMOS[v];
    if (alvo && VOCABULARIO[lista].indexOf(alvo) >= 0) return alvo;
    return valor;
  }

  function exigir(cond, msg) {
    if (!cond) throw new ErroDeFicha(msg);
  }

  function exigirVocabulario(campo, valor, lista) {
    exigir(VOCABULARIO[lista].indexOf(valor) >= 0,
      campo + ": \"" + valor + "\" não pertence ao vocabulário (" +
      VOCABULARIO[lista].join(", ") + ")");
  }

  /* Acumula TODOS os problemas antes de falhar. Uma Ficha recém-gerada costuma
     ter vários; devolver um por vez transformaria a correção em dezenas de
     idas e vindas com a LLM. */
  function validarFicha(ficha) {
    var erros = [], avisos = [];

    function checar(cond, msg) { if (!cond) erros.push(msg); return !!cond; }

    // Padroniza em cima do próprio objeto: o resto da montagem lê o valor já
    // canônico, e a divergência vira aviso em vez de rodada de correção.
    function checarVocabulario(dono, campo, lista, rotulo) {
      var valor = dono ? dono[campo] : undefined;
      if (valor === undefined || valor === null) return;
      var bom = padronizar(valor, lista);
      if (VOCABULARIO[lista].indexOf(bom) < 0) {
        erros.push(rotulo + ": \"" + valor + "\" não pertence ao vocabulário (" +
          VOCABULARIO[lista].join(", ") + ")");
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
          texto(F, "quantidade/Quantidade/valorInformado",
            v.quantidade.tipo === "INFORMADA" ? v.quantidade.valor : 0);
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
        v.baseVerbas.forEach(function (nome) {
          var alvoVerba = nos[nome];
          itens.appendChild(fragmento(doc,
            "<ItemBaseVerba><id>" + idNovo() + "</id><integralizar>SIM</integralizar>" +
            "<verbaDeCalculo><" + alvoVerba.nodeName + "><internalRef>" +
            texto(alvoVerba, "id") + "</internalRef></" + alvoVerba.nodeName +
            "></verbaDeCalculo></ItemBaseVerba>"));
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
  function empacotar(xml, nomeArquivo, deflateRaw) {
    var dados = bytesAscii(xml);
    var comprimido = deflateRaw(dados);
    var nome = bytesAscii(nomeArquivo);
    var crc = crc32(dados);
    var cab = [].concat(
      u16(20), u16(0), u16(8), u16(0), u16(0),
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
    ErroDeFicha: ErroDeFicha
  };
})();
/* ---- camada de console (substitui a interface HTML) ---- */

var M = PjcMontador;
M.configurarDom(new DOMParser(), new XMLSerializer());

// ------------------------------------------------------------------ entrada ---

/* A Ficha costuma chegar colada da LLM. Aceitar objeto, texto puro e texto
   cercado por ```json evita uma edição manual a cada rodada. */
function normalizar(entrada) {
  if (entrada && typeof entrada === "object") return entrada;
  if (typeof entrada !== "string") {
    throw new Error("Passe a Ficha como objeto ou como texto JSON.");
  }
  var t = entrada.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    throw new Error("O texto não é JSON válido: " + e.message +
      "\nPeça à LLM apenas o bloco JSON, sem comentários nem texto em volta.");
  }
}

// -------------------------------------------------------------------- bytes ---

function bytesAscii(s) {
  var b = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xFF;
  return b;
}

function paraBase64(bytes) {
  var s = "", passo = 0x8000;
  for (var i = 0; i < bytes.length; i += passo) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
  }
  return btoa(s);
}

async function comprimir(bytes) {
  var cs = new CompressionStream("deflate-raw");
  var w = cs.writable.getWriter();
  w.write(bytes); w.close();
  var buf = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(buf);
}

/* Sem CompressionStream (navegador antigo, ou contexto sem a API), o zip sai
   com a entrada armazenada em vez de deflacionada: o PJe-Calc lê os dois. Basta
   trocar o método de compressão nos dois cabeçalhos — 8 no local, 10 no
   central, deslocamentos fixos de um zip de entrada única. */
async function empacotar(xml, nome) {
  var dados = bytesAscii(xml);
  if (typeof CompressionStream === "function") {
    var comp = await comprimir(dados);
    return M.empacotar(xml, nome, function () { return comp; });
  }
  var zip = M.empacotar(xml, nome, function (d) { return d; });
  var central = 30 + bytesAscii(nome).length + dados.length;
  zip[8] = 0; zip[9] = 0;
  zip[central + 10] = 0; zip[central + 11] = 0;
  return zip;
}

// ------------------------------------------------------------------- saída ---

function baixar(zip, nome) {
  var url = URL.createObjectURL(new Blob([zip], { type: "application/octet-stream" }));
  var a = document.createElement("a");
  a.href = url; a.download = nome; a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
}

var VERDE = "color:#2f6b4f", VERMELHO = "color:#9b2c2c", AMBAR = "color:#8a6216",
    FRACO = "color:#5d6d7b", FORTE = "font-weight:600";

function num(n) { return n.toLocaleString("pt-BR"); }

// ----------------------------------------------------------------- geração ---

function xml(entrada) {
  var ficha = normalizar(entrada);
  return M.montarXml(ficha, PJC_BASE);
}

function validar(entrada) {
  return M.validarFicha(normalizar(entrada));
}

async function gerar(entrada, opcoes) {
  opcoes = opcoes || {};
  var quieto = opcoes.quieto === true;
  var ficha, r;

  try {
    ficha = normalizar(entrada);
    if (!quieto) {
      console.log("%clido%c  JSON válido, versão do anexo " +
        (ficha.anexo || "não informada"), VERDE + ";" + FORTE, FRACO);
    }
    r = M.montarXml(ficha, PJC_BASE, opcoes);
  } catch (e) {
    PJC.ultimoErro = e;
    console.log("%crecusado%c\n" + e.message, VERMELHO + ";" + FORTE, VERMELHO);
    console.log("%ccorrija%c  devolva a mensagem acima à LLM e peça a Ficha corrigida" +
      " (o erro também fica em PJC.ultimoErro)", AMBAR + ";" + FORTE, FRACO);
    if (opcoes.estrito) throw e;
    return null;
  }

  var nome = M.nomeDoArquivo(ficha);
  var zip = await empacotar(r.xml, nome);
  var saida = {
    nome: nome,
    xml: r.xml,
    zip: zip,
    base64: paraBase64(zip),
    avisos: r.avisos,
    ficha: ficha
  };
  PJC.ultimo = saida;
  PJC.ultimoErro = null;

  if (!quieto) {
    console.log("%cverbas%c  " + (ficha.verbas || []).length + " verba(s) montada(s)",
      VERDE + ";" + FORTE, FRACO);
    console.log("%cgrafo%c  nenhuma referência órfã", VERDE + ";" + FORTE, FRACO);
    console.log("%cxml%c  " + num(r.xml.length) + " bytes", VERDE + ";" + FORTE, FRACO);
    console.log("%cempacotado%c  " + num(zip.length) + " bytes  ·  " + nome,
      VERDE + ";" + FORTE, FRACO);
    (r.avisos || []).forEach(function (a) {
      console.log("%catenção%c  " + a, AMBAR + ";" + FORTE, AMBAR);
    });
    (ficha.pendencias || []).forEach(function (p) {
      console.log("%cpendência%c  " + p, AMBAR + ";" + FORTE, AMBAR);
    });
  }

  if (opcoes.baixar !== false) {
    try {
      baixar(zip, nome);
      if (!quieto) {
        console.log("%centrega%c  download disparado — importe no PJe-Calc, regere as" +
          " verbas e confira os totais contra o título antes de homologar",
          VERDE + ";" + FORTE, FRACO);
      }
    } catch (e) {
      console.log("%centrega%c  download bloqueado nesta página (" + e.message +
        "). Alternativa: copy(PJC.ultimo.base64) e decodifique fora do navegador.",
        AMBAR + ";" + FORTE, AMBAR);
    }
  }

  return saida;
}

async function doClipboard(opcoes) {
  var texto;
  try {
    texto = await navigator.clipboard.readText();
  } catch (e) {
    console.log("%crecusado%c  a área de transferência exige a página em foco e" +
      " permissão concedida. Clique na página e repita, ou use PJC.gerar(texto).",
      VERMELHO + ";" + FORTE, VERMELHO);
    return null;
  }
  return gerar(texto, opcoes);
}

// -------------------------------------------------------------------- API ---

function ajuda() {
  console.log([
    "PJC.gerar(ficha)              valida, monta, empacota e baixa o .PJC",
    "PJC.gerar(ficha,{baixar:false}) só devolve os bytes",
    "PJC.gerar(ficha,{estrito:true}) relança o erro em vez de só reportar",
    "PJC.xml(ficha)                { xml, avisos } sem zip",
    "PJC.validar(ficha)            avisos; lança em caso de erro",
    "PJC.doClipboard()             lê a Ficha da área de transferência e gera",
    "PJC.exemplo                   Ficha de exemplo",
    "PJC.ultimo                    { nome, xml, zip, base64 } da última geração",
    "PJC.ultimoErro                erro da última tentativa recusada",
    "PJC.vocabulario               valores aceitos por campo",
    "PJC.montador                  API crua do montador"
  ].join("\n"));
}

var PJC = {
  gerar: gerar,
  xml: xml,
  validar: validar,
  doClipboard: doClipboard,
  exemplo: PJC_EXEMPLO,
  base: PJC_BASE,
  montador: M,
  vocabulario: M.VOCABULARIO,
  ultimo: null,
  ultimoErro: null,
  ajuda: ajuda
};

self.PJC = PJC;

console.log("%cPJC pronto%c  anexo PJC-1.5 · base " + (PJC_BASE.versaoDoSistema || "?") +
  "  —  PJC.gerar(ficha)  ·  PJC.ajuda()", VERDE + ";" + FORTE, FRACO);

})();