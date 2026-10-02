// ============================================================
// automaTor-lancador.js
//
// Converte um PEDIDO DE LANÇAMENTO — dados já estruturados, vindos do
// texto padronizado da sentença — em Ficha de Liquidação completa.
//
// A diferença em relação ao caminho anterior: a LLM não escolhe mais
// nomes de verba nem omite campos estruturais. O nome vem de um
// catálogo fechado, e cada entrada do catálogo já carrega assunto,
// característica, ocorrência de pagamento, fórmula e os reflexos que
// o PJe-Calc cria junto.
//
// Foi a liberdade de nomear que quebrou o primeiro teste: a Ficha
// trouxe "ACRÉSCIMO DO ARTIGO 467 DA CLT" e nenhum molde casou; e
// trouxe verbas sem 'caracteristica', o que fez 13º e Férias caírem no
// padrão genérico e gerarem uma única ocorrência no desligamento.
//
// Aqui o lançador é a única fonte desses campos. Quem escreve o
// pedido informa QUANTO e DE QUANDO; nunca COMO.
// ============================================================


// ── catálogo de verbas lançáveis ──────────────────────────────
//
// Chave: o identificador curto usado no pedido (sem acento, maiúsculo).
// 'molde' é o nome que vai para a Ficha — precisa casar com a chave da
// biblioteca em automaTor-base.js, que o montador procura por prefixo.
//
// 'quantifica' diz como o pedido expressa a quantidade:
//   DIAS          → { dias: 9 }                      uma ocorrência no desligamento
//   AVOS_ANO      → { avos: [{ ano: 2024, avos: 10 }] }   uma ocorrência por ano
//   AVOS_PERIODO  → { periodos: [{ aquisitivo: '2021/2022', avos: 12 }] }
//
// 'reflexos' lista os pacotes que o PJe-Calc anexa à verba — extraídos
// da TBVERBABASE do banco do sistema, não inferidos.

const PJC_CATALOGO = {

    'SALDO DE SALARIO': {
        molde:        'SALDO DE SALARIO',
        assuntoCnj:   8823,
        caracteristica: 'COMUM',
        ocorrenciaDePagamento: 'DESLIGAMENTO',
        quantifica:   'DIAS',
        base:         { tipo: 'HISTORICO_SALARIAL' },
        divisor:      { tipo: 'OUTRO_VALOR', valor: 30 },
        multiplicador: 1,
        variacao:     'FIXA',
        proporcionalizarHistorico:  true,
        excluirFaltaNaoJustificada: true,
        excluirFeriasGozadas:       true,
        incidenciaINSS: true, incidenciaIRPF: true, incidenciaFGTS: true,
        reflexos:     ['M467'],
    },

    'AVISO PREVIO': {
        molde:        'AVISO PREVIO',
        assuntoCnj:   2641,
        caracteristica: 'AVISO_PREVIO',
        ocorrenciaDePagamento: 'DESLIGAMENTO',
        quantifica:   'DIAS',
        base:         { tipo: 'MAIOR_REMUNERACAO' },
        divisor:      { tipo: 'OUTRO_VALOR', valor: 30 },
        multiplicador: 1,
        variacao:     'FIXA',
        // Aviso prévio não sofre INSS nem IRPF; incide FGTS (Súmula 305 do TST).
        incidenciaINSS: false, incidenciaIRPF: false, incidenciaFGTS: true,
        reflexos:     ['M467'],
    },

    '13o SALARIO': {
        molde:        '13º SALARIO',
        assuntoCnj:   2666,
        caracteristica: 'DECIMO_TERCEIRO_SALARIO',
        ocorrenciaDePagamento: 'DEZEMBRO',
        quantifica:   'AVOS_ANO',
        base:         { tipo: 'HISTORICO_SALARIAL' },
        divisor:      { tipo: 'OUTRO_VALOR', valor: 12 },
        multiplicador: 1,
        variacao:     'FIXA',
        incidenciaINSS: true, incidenciaIRPF: true, incidenciaFGTS: true,
        reflexos:     ['M467'],
    },

    'FERIAS + 1/3': {
        molde:        'FERIAS + 1/3',
        assuntoCnj:   2662,
        caracteristica: 'FERIAS',
        ocorrenciaDePagamento: 'PERIODO_AQUISITIVO',
        quantifica:   'AVOS_PERIODO',
        base:         { tipo: 'MAIOR_REMUNERACAO' },
        divisor:      { tipo: 'OUTRO_VALOR', valor: 12 },
        // 1.33333333 com as oito casas que o PJe-Calc grava: é o 1/3
        // constitucional embutido no multiplicador, como no arquivo conferido.
        multiplicador: 1.33333333,
        variacao:     'FIXA',
        // Férias indenizadas são indenizatórias: não incide nada.
        incidenciaINSS: false, incidenciaIRPF: false, incidenciaFGTS: false,
        reflexos:     ['M467'],
    },

    // Férias proporcionais têm assunto próprio (8821), mas o resto é idêntico.
    'FERIAS PROPORCIONAIS + 1/3': {
        molde:        'FERIAS + 1/3',
        assuntoCnj:   8821,
        caracteristica: 'FERIAS',
        ocorrenciaDePagamento: 'PERIODO_AQUISITIVO',
        quantifica:   'AVOS_PERIODO',
        base:         { tipo: 'MAIOR_REMUNERACAO' },
        divisor:      { tipo: 'OUTRO_VALOR', valor: 12 },
        multiplicador: 1.33333333,
        variacao:     'FIXA',
        incidenciaINSS: false, incidenciaIRPF: false, incidenciaFGTS: false,
        reflexos:     ['M467'],
    },

    'MULTA DO ARTIGO 477 DA CLT': {
        molde:        'MULTA DO ARTIGO 477 DA CLT',
        assuntoCnj:   2212,
        caracteristica: 'COMUM',
        ocorrenciaDePagamento: 'DESLIGAMENTO',
        quantifica:   'FIXA',          // uma remuneração, sem quantidade a informar
        base:         { tipo: 'MAIOR_REMUNERACAO' },
        divisor:      { tipo: 'OUTRO_VALOR', valor: 1 },
        multiplicador: 1,
        variacao:     'FIXA',
        incidenciaINSS: false, incidenciaIRPF: false, incidenciaFGTS: false,
        reflexos:     [],              // a 477 não recebe reflexo
    },

    'SALARIO RETIDO': {
        molde:        'SALARIO RETIDO',
        assuntoCnj:   2452,            // Salário Vencido/Retido — não é 2458
        caracteristica: 'COMUM',
        ocorrenciaDePagamento: 'MENSAL',
        quantifica:   'MESES',         // { meses: ['2023-12', '2024-01'] }
        base:         { tipo: 'HISTORICO_SALARIAL' },
        divisor:      { tipo: 'OUTRO_VALOR', valor: 1 },
        multiplicador: 1,
        variacao:     'VARIAVEL',
        proporcionalizarHistorico: true,
        incidenciaINSS: true, incidenciaIRPF: true, incidenciaFGTS: true,
        reflexos:     ['M467'],
    },
}


// Sinônimos aceitos no pedido. O texto da sentença varia; o catálogo não.
const PJC_CATALOGO_SINONIMOS = {
    'SALDO DE SALARIOS': 'SALDO DE SALARIO',
    'SALDO SALARIAL':    'SALDO DE SALARIO',
    'AVISO PREVIO INDENIZADO': 'AVISO PREVIO',
    'AVISO PREVIO PROPORCIONAL': 'AVISO PREVIO',
    '13 SALARIO':        '13o SALARIO',
    '13º SALARIO':       '13o SALARIO',
    'DECIMO TERCEIRO':   '13o SALARIO',
    'DECIMO TERCEIRO SALARIO': '13o SALARIO',
    'GRATIFICACAO NATALINA':   '13o SALARIO',
    'FERIAS':            'FERIAS + 1/3',
    'FERIAS VENCIDAS':   'FERIAS + 1/3',
    'FERIAS VENCIDAS + 1/3': 'FERIAS + 1/3',
    'FERIAS INTEGRAIS':  'FERIAS + 1/3',
    'FERIAS PROPORCIONAIS': 'FERIAS PROPORCIONAIS + 1/3',
    'MULTA 477':         'MULTA DO ARTIGO 477 DA CLT',
    'MULTA DO ART. 477': 'MULTA DO ARTIGO 477 DA CLT',
    'SALARIO VENCIDO':   'SALARIO RETIDO',
}


// ── perfis de reflexo ─────────────────────────────────────────
//
// Um reflexo por verba-base, como o PJe-Calc faz (TBVERBABASE: ids 54-57
// são quatro registros distintos de multa 467, um para cada rescisória).
// Nunca um reflexo com várias bases — foi o que o primeiro teste tentou
// e o montador descartou.

const PJC_PERFIS_REFLEXO = {
    M467: {
        assuntoCnj:   2210,
        prefixoNome:  'MULTA DO ARTIGO 467 DA CLT SOBRE ',
        caracteristica: 'COMUM',
        ocorrenciaDePagamento: 'DESLIGAMENTO',
        divisor:      { tipo: 'OUTRO_VALOR', valor: 1 },
        multiplicador: 0.5,
        quantidade:   { tipo: 'INFORMADA', valor: 1 },
        variacao:     'FIXA',
        comportamento: 'VALOR_MENSAL',
        tratamentoDaFracao: 'MANTER',
        incidenciaINSS: false, incidenciaIRPF: false, incidenciaFGTS: false,
    },
}


// Saldo de salário é apurado por dias: integralizar faria o reflexo tomar a
// remuneração cheia do mês em vez do valor apurado. Foi assim que o
// calculista deixou no .PJC de referência.
const PJC_NAO_INTEGRALIZA = [8823, 2452]


// ── pjcLancar ─────────────────────────────────────────────────
//
// Recebe o Pedido de Lançamento e devolve { ficha, avisos, erros }.
// Erro não vazio significa que a Ficha não deve ser montada.
//
// Formato do pedido:
//
//   {
//     processo: { numeroCNJ, autuacao, reclamante, reclamado, valorDaCausa },
//     contrato: { admissao, demissao, dataLiquidacao, remuneracao, setor },
//     verbas: [
//       { verba: 'SALDO DE SALARIO', dias: 9 },
//       { verba: '13o SALARIO', avos: [{ ano: 2024, avos: 10 },
//                                      { ano: 2023, avos: 12 }] },
//       { verba: 'FERIAS + 1/3',
//         periodos: [{ aquisitivo: '2021/2022', avos: 12,
//                      situacao: 'INDENIZADAS' }] },
//       { verba: 'SALARIO RETIDO', meses: ['2023-12'] },
//       { verba: 'MULTA DO ARTIGO 477 DA CLT' }
//     ],
//     fgts: { naoDepositado: true, multa: 40, destino: 'DEPOSITAR' }
//   }

function pjcLancar(pedido) {
    const avisos = []
    const erros  = []

    const p = pedido.processo || {}
    const c = pedido.contrato || {}

    if (!c.admissao)  erros.push('contrato.admissao é obrigatório')
    if (!c.demissao)  erros.push('contrato.demissao é obrigatório para verbas rescisórias')
    if (c.remuneracao == null) {
        erros.push('contrato.remuneracao é obrigatório — é a base das verbas rescisórias')
    }
    if (erros.length) return { ficha: null, avisos: avisos, erros: erros }

    const ficha = {
        anexo: 'PJC-3.0',
        processo: {
            numeroCNJ:    p.numeroCNJ || null,
            dataAutuacao: p.autuacao  || null,
            valorDaCausa: p.valorDaCausa != null ? p.valorDaCausa : null,
            reclamante:   p.reclamante ? { nome: p.reclamante } : null,
            reclamado:    p.reclamado  ? { nome: p.reclamado }  : null,
        },
        contrato: {
            admissao:          c.admissao,
            demissao:          c.demissao,
            ajuizamento:       c.ajuizamento || p.autuacao || null,
            dataLiquidacao:    c.dataLiquidacao || null,
            regime:            c.regime || 'INTEGRAL',
            cargaHorariaPadrao: c.cargaHorariaPadrao || 220,
            ultimaRemuneracao: c.remuneracao,
            maiorRemuneracao:  c.maiorRemuneracao != null ? c.maiorRemuneracao : c.remuneracao,
            setor:             c.setor || null,
        },
        historicosSalariais: [],
        ferias: [],
        verbas: [],
        pendencias: [],
    }

    // O histórico é o que dá ao PJe-Calc a evolução salarial: sem ele as
    // verbas de base HISTORICO_SALARIAL não regeram nada.
    ficha.historicosSalariais.push({
        nome: 'SALÁRIO BASE',
        variacao: 'FIXA',
        incidenciaFGTS: true,
        incidenciaINSS: true,
        ocorrencias: _pjcl_competencias(c.admissao, c.demissao)
                        .map(d => ({ data: d, valor: c.remuneracao })),
    })

    // ── verbas ────────────────────────────────────────────────
    const principais = []

    ;(pedido.verbas || []).forEach((item, i) => {
        const onde = 'verbas[' + i + ']'
        const chave = _pjcl_resolverVerba(item.verba)

        if (!chave) {
            erros.push(onde + ': verba "' + item.verba + '" não está no catálogo. ' +
                'Lance-a manualmente no PJe-Calc ou acrescente ao PJC_CATALOGO.')
            return
        }

        const perfil = PJC_CATALOGO[chave]
        const v = {
            tipo:  'CALCULADA',
            nome:  item.nome || perfil.molde,
            assuntoCnj:     perfil.assuntoCnj,
            caracteristica: perfil.caracteristica,
            ocorrenciaDePagamento: perfil.ocorrenciaDePagamento,
            base:           _pjcl_copia(perfil.base),
            divisor:        _pjcl_copia(perfil.divisor),
            multiplicador:  perfil.multiplicador,
            variacao:       perfil.variacao,
            incidenciaINSS: perfil.incidenciaINSS,
            incidenciaIRPF: perfil.incidenciaIRPF,
            incidenciaFGTS: perfil.incidenciaFGTS,
            fonte:          item.fonte || null,
        }
        if (perfil.proporcionalizarHistorico)  v.proporcionalizarHistorico  = true
        if (perfil.excluirFaltaNaoJustificada) v.excluirFaltaNaoJustificada = true
        if (perfil.excluirFeriasGozadas)       v.excluirFeriasGozadas       = true

        // Quantidade e ocorrências saem da forma como o pedido quantifica.
        const q = _pjcl_quantificar(perfil, item, c, onde)
        if (q.erro) { erros.push(q.erro); return }
        v.quantidade  = q.quantidade
        v.ocorrencias = q.ocorrencias
        if (q.aviso) avisos.push(q.aviso)

        // Férias alimentam também a lista de períodos aquisitivos: é ela que
        // diz ao sistema quais períodos existem e em que situação.
        if (perfil.caracteristica === 'FERIAS' && item.periodos) {
            item.periodos.forEach(pe => {
                ficha.ferias.push({
                    periodoAquisitivo: pe.aquisitivo,
                    situacao: pe.situacao || 'INDENIZADAS',
                    dobra:    pe.dobra === true,
                })
            })
        }

        ficha.verbas.push(v)
        principais.push({ verba: v, perfil: perfil })
    })

    // ── reflexos ──────────────────────────────────────────────
    //
    // Gerados aqui, um por verba-base, com o nome que casa com a biblioteca.
    // Quem escreve o pedido não os declara e não pode errá-los.

    principais.forEach(({ verba, perfil }) => {
        (perfil.reflexos || []).forEach(sigla => {
            const rp = PJC_PERFIS_REFLEXO[sigla]
            if (!rp) return

            const naoIntegraliza = PJC_NAO_INTEGRALIZA.indexOf(perfil.assuntoCnj) >= 0

            ficha.verbas.push({
                tipo: 'REFLEXO',
                nome: rp.prefixoNome + verba.nome,
                assuntoCnj:     rp.assuntoCnj,
                caracteristica: rp.caracteristica,
                ocorrenciaDePagamento: rp.ocorrenciaDePagamento,
                baseVerbas:     [verba.nome],
                divisor:        _pjcl_copia(rp.divisor),
                multiplicador:  rp.multiplicador,
                quantidade:     _pjcl_copia(rp.quantidade),
                variacao:       rp.variacao,
                comportamento:  rp.comportamento,
                // Saldo e salário retido são apurados por dias: o reflexo não
                // integraliza o item, mas integraliza a fração de mês.
                integralizar:       naoIntegraliza ? 'NAO' : 'SIM',
                tratamentoDaFracao: naoIntegraliza ? 'INTEGRALIZAR' : rp.tratamentoDaFracao,
                incidenciaINSS: rp.incidenciaINSS,
                incidenciaIRPF: rp.incidenciaIRPF,
                incidenciaFGTS: rp.incidenciaFGTS,
                fonte:          verba.fonte,
                // O reflexo acompanha as ocorrências da verba-base.
                ocorrencias:    _pjcl_copia(verba.ocorrencias),
            })
        })
    })

    // ── FGTS ──────────────────────────────────────────────────
    //
    // No PJe-Calc o FGTS não é verba: é módulo próprio, alimentado pela
    // incidência declarada em cada verba. O pedido configura o módulo.

    const f = pedido.fgts
    if (f) {
        ficha.encargos = ficha.encargos || {}
        ficha.encargos.fgts = {
            destino:    f.destino || 'DEPOSITAR',
            multa:      (f.multa === 20) ? 'VINTE_POR_CENTO' : 'QUARENTA_POR_CENTO',
            incidencia: f.incidencia || 'SOBRE_O_TOTAL_DEVIDO',
        }
        if (f.naoDepositado) {
            ficha.pendencias.push(
                'FGTS não depositado: confira no extrato da CEF as competências ' +
                'em aberto e lance-as no módulo FGTS do PJe-Calc. O lançador ' +
                'configura o módulo, mas não conhece as competências não recolhidas.')
        }
    }

    return { ficha: ficha, avisos: avisos, erros: erros }
}


// ── quantificação ─────────────────────────────────────────────
//
// Traduz o "quanto e de quando" do pedido nas ocorrências que o PJe-Calc
// mostra na tela da verba. É aqui que o pedido "10/12 avos de 2024, 2023,
// 2022 (5/12)" vira três ocorrências com quantidades 10, 12 e 5.

function _pjcl_quantificar(perfil, item, c, onde) {
    const zerar = { devido: null, base: null }

    if (perfil.quantifica === 'DIAS') {
        const dias = item.dias
        if (dias == null) {
            return { erro: onde + ': "' + perfil.molde + '" exige "dias" (ex.: { dias: 9 })' }
        }
        return {
            quantidade:  { tipo: 'INFORMADA', valor: dias },
            ocorrencias: [ Object.assign({
                inicio: c.demissao, fim: c.demissao, quantidade: dias, ativo: true
            }, zerar) ],
        }
    }

    if (perfil.quantifica === 'FIXA') {
        return {
            quantidade:  { tipo: 'INFORMADA', valor: 1 },
            ocorrencias: [ Object.assign({
                inicio: c.demissao, fim: c.demissao, quantidade: 1, ativo: true
            }, zerar) ],
        }
    }

    if (perfil.quantifica === 'AVOS_ANO') {
        const lista = item.avos
        if (!Array.isArray(lista) || !lista.length) {
            return { erro: onde + ': "' + perfil.molde + '" exige "avos" — ex.: ' +
                '[{ ano: 2024, avos: 10 }, { ano: 2023, avos: 12 }]' }
        }
        const ocs = []
        let aviso = null
        lista.slice().sort((a, b) => a.ano - b.ano).forEach(a => {
            if (a.avos == null || a.avos < 0 || a.avos > 12) {
                aviso = onde + ': avos de ' + a.ano + ' fora de 0-12 (' + a.avos + ')'
            }
            // 13º vence em 20 de dezembro. No ano da rescisão, quando esta
            // ocorre antes, a data da ocorrência é a da demissão.
            const dezembro = a.ano + '-12-20'
            const data = (dezembro > c.demissao) ? c.demissao : dezembro
            ocs.push(Object.assign({
                inicio: data, fim: data, quantidade: a.avos, ativo: true
            }, zerar))
        })
        return {
            quantidade:  { tipo: 'AVOS' },
            ocorrencias: ocs,
            aviso:       aviso,
        }
    }

    if (perfil.quantifica === 'AVOS_PERIODO') {
        const lista = item.periodos
        if (!Array.isArray(lista) || !lista.length) {
            return { erro: onde + ': "' + perfil.molde + '" exige "periodos" — ex.: ' +
                "[{ aquisitivo: '2021/2022', avos: 12, situacao: 'INDENIZADAS' }]" }
        }
        const ocs = []
        let aviso = null
        lista.forEach(pe => {
            const anos = String(pe.aquisitivo || '').split('/')
            if (anos.length !== 2) {
                aviso = onde + ': período aquisitivo "' + pe.aquisitivo +
                        '" fora do formato AAAA/AAAA'
                return
            }
            // Referência: o fim do período aquisitivo, limitado pela demissão.
            const mesDia = c.admissao.slice(5)
            let data = anos[1] + '-' + mesDia
            if (data > c.demissao) data = c.demissao
            ocs.push(Object.assign({
                inicio: data, fim: data,
                quantidade: pe.avos != null ? pe.avos : 12,
                ativo: true,
            }, zerar))
        })
        return {
            quantidade:  { tipo: 'AVOS' },
            ocorrencias: ocs,
            aviso:       aviso,
        }
    }

    if (perfil.quantifica === 'MESES') {
        const lista = item.meses
        if (!Array.isArray(lista) || !lista.length) {
            return { erro: onde + ': "' + perfil.molde + '" exige "meses" — ex.: ' +
                "['2023-12', '2024-01']" }
        }
        const ocs = lista.slice().sort().map(m => {
            const a = Number(m.slice(0, 4)), mes = Number(m.slice(5, 7))
            const ultimo = new Date(Date.UTC(a, mes, 0)).getUTCDate()
            return Object.assign({
                inicio: m + '-01',
                fim:    m + '-' + String(ultimo).padStart(2, '0'),
                quantidade: 1, ativo: true,
            }, zerar)
        })
        return { quantidade: { tipo: 'INFORMADA', valor: 1 }, ocorrencias: ocs }
    }

    return { erro: onde + ': modo de quantificação desconhecido (' + perfil.quantifica + ')' }
}


// ── auxiliares ────────────────────────────────────────────────

// Índice normalizado → chave real do catálogo. Montado uma vez, porque as
// chaves do catálogo têm grafia própria ("13o SALARIO") que não sobrevive à
// normalização em maiúsculas do pedido.
const _PJCL_INDICE = (function () {
    const idx = {}
    Object.keys(PJC_CATALOGO).forEach(k => { idx[_pjcl_normalizar(k)] = k })
    Object.keys(PJC_CATALOGO_SINONIMOS).forEach(k => {
        const destino = PJC_CATALOGO_SINONIMOS[k]
        if (PJC_CATALOGO[destino]) idx[_pjcl_normalizar(k)] = destino
    })
    return idx
})()

function _pjcl_resolverVerba(nome) {
    const chave = _pjcl_normalizar(nome)
    if (_PJCL_INDICE[chave]) return _PJCL_INDICE[chave]

    // Casamento por prefixo: "SALDO DE SALARIO JANEIRO DE 2024" cai em
    // "SALDO DE SALARIO", que é como a sentença costuma escrever. O mais
    // longo primeiro, para "FERIAS PROPORCIONAIS" não cair em "FERIAS".
    const chaves = Object.keys(_PJCL_INDICE).sort((a, b) => b.length - a.length)
    for (const k of chaves) {
        if (chave.indexOf(k) === 0) return _PJCL_INDICE[k]
    }
    return null
}

function _pjcl_normalizar(t) {
    return String(t == null ? '' : t)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().split(/\s+/).join(' ').trim()
}

function _pjcl_copia(v) {
    return (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v
}

// Primeiro dia de cada mês entre as duas datas, inclusive.
function _pjcl_competencias(inicioISO, fimISO) {
    const a = inicioISO.split('-').map(Number)
    const b = fimISO.split('-').map(Number)
    const datas = []
    let ano = a[0], mes = a[1]
    while (ano < b[0] || (ano === b[0] && mes <= b[1])) {
        datas.push(ano + '-' + String(mes).padStart(2, '0') + '-01')
        if (++mes > 12) { mes = 1; ano++ }
        if (datas.length > 720) break
    }
    return datas
}


// ── pjcResumirPedido ──────────────────────────────────────────
//
// Conferência antes de gerar: o que será lançado e com quantas ocorrências.

function pjcResumirPedido(ficha) {
    const linhas = []
    const principais = ficha.verbas.filter(v => v.tipo !== 'REFLEXO')
    const reflexos   = ficha.verbas.filter(v => v.tipo === 'REFLEXO')

    linhas.push('Verbas principais: ' + principais.length)
    principais.forEach(v => {
        const n = (v.ocorrencias || []).length
        linhas.push('   • ' + v.nome + ' — ' + n + (n === 1 ? ' ocorrência' : ' ocorrências'))
    })
    linhas.push('Reflexos gerados: ' + reflexos.length)
    reflexos.forEach(v => linhas.push('   ↳ ' + v.nome))
    return linhas
}