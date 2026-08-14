// ============================================================
// automaTor-padroes.js
//
// Perfis de verba: os parâmetros que o PJe-Calc já traz preenchidos
// quando o calculista escolhe a característica na tela.
//
// A Ficha carrega o que o TÍTULO EXECUTIVO determina. Base, divisor,
// multiplicador e quantidade de uma verba rescisória não estão na
// sentença — são o preenchimento padrão do sistema. Exigi-los da LLM
// gerava vinte erros por Ficha e obrigava a inventar parâmetro, que é
// justamente o que o Anexo proíbe.
//
// Regra: o que a Ficha traz sempre vence o padrão. O padrão só
// preenche buraco.
//
// Ajustar estes valores é trabalho de calculista, não de LLM — mexa
// aqui conforme os testes da equipe, sem tocar no Anexo nem no prompt.
// ============================================================


// ── por característica ────────────────────────────────────────
//
// Vale para toda verba que declare a característica correspondente.

const PJC_PADRAO_POR_CARACTERISTICA = {

    // Aviso prévio: maior remuneração ÷ 30, quantidade APURADA com 30 no
    // campo — o sistema recalcula a projeção da Lei 12.506 a partir daí.
    // Sem incidência de INSS nem de IRPF; com FGTS.
    AVISO_PREVIO: {
        base:          { tipo: 'MAIOR_REMUNERACAO' },
        divisor:       { tipo: 'OUTRO_VALOR', valor: 30 },
        multiplicador: 1,
        quantidade:    { tipo: 'APURADA', valor: 30 },
        ocorrenciaDePagamento: 'DESLIGAMENTO',
        variacao:      'FIXA',
        incidenciaINSS: false, incidenciaIRPF: false, incidenciaFGTS: true,
    },

    // 13º: histórico salarial ÷ 12 em AVOS. Incide em tudo.
    DECIMO_TERCEIRO_SALARIO: {
        base:          { tipo: 'HISTORICO_SALARIAL' },
        divisor:       { tipo: 'OUTRO_VALOR', valor: 12 },
        multiplicador: 1,
        quantidade:    { tipo: 'AVOS', proporcionalizar: true },
        ocorrenciaDePagamento: 'DEZEMBRO',
        variacao:      'FIXA',
        incidenciaINSS: true, incidenciaIRPF: true, incidenciaFGTS: true,
    },

    // Férias + 1/3: maior remuneração ÷ 12 em AVOS, multiplicador com as oito
    // casas que o sistema grava. Indenizatória: não incide em nada.
    FERIAS: {
        base:          { tipo: 'MAIOR_REMUNERACAO' },
        divisor:       { tipo: 'OUTRO_VALOR', valor: 12 },
        multiplicador: 1.33333333,
        quantidade:    { tipo: 'AVOS' },
        ocorrenciaDePagamento: 'PERIODO_AQUISITIVO',
        variacao:      'FIXA',
        incidenciaINSS: false, incidenciaIRPF: false, incidenciaFGTS: false,
    },
}


// ── por assunto ───────────────────────────────────────────────
//
// Para verbas sem característica própria. O código é o assuntoCnj.

const PJC_PADRAO_POR_ASSUNTO = {

    // Saldo de Salário: proporcionaliza pelo histórico (são dias do mês da
    // rescisão) e exclui faltas não justificadas e férias gozadas.
    8823: {
        base:          { tipo: 'HISTORICO_SALARIAL' },
        divisor:       { tipo: 'OUTRO_VALOR', valor: 1 },
        multiplicador: 1,
        quantidade:    { tipo: 'INFORMADA', valor: 1 },
        proporcionalizarHistorico: true,
        excluirFaltaNaoJustificada: true,
        excluirFeriasGozadas: true,
        ocorrenciaDePagamento: 'DESLIGAMENTO',
        variacao:      'FIXA',
        incidenciaINSS: true, incidenciaIRPF: true, incidenciaFGTS: true,
    },

    2212: {   // Multa do Art. 477 — uma remuneração
        base:          { tipo: 'MAIOR_REMUNERACAO' },
        divisor:       { tipo: 'OUTRO_VALOR', valor: 1 },
        multiplicador: 1,
        quantidade:    { tipo: 'INFORMADA', valor: 1 },
        ocorrenciaDePagamento: 'DESLIGAMENTO',
        variacao:      'FIXA',
        incidenciaINSS: false, incidenciaIRPF: false, incidenciaFGTS: false,
    },

    2086: {   // Horas Extras
        base:          { tipo: 'HISTORICO_SALARIAL' },
        divisor:       { tipo: 'CARGA_HORARIA' },
        multiplicador: 1.5,
    },

    2140: {   // Intervalo Intrajornada
        base:          { tipo: 'HISTORICO_SALARIAL' },
        divisor:       { tipo: 'CARGA_HORARIA' },
        multiplicador: 1.5,
    },

    2139: {   // Intervalo Interjornadas
        base:          { tipo: 'HISTORICO_SALARIAL' },
        divisor:       { tipo: 'CARGA_HORARIA' },
        multiplicador: 1.5,
    },

    1663: {   // Adicional Noturno
        base:          { tipo: 'HISTORICO_SALARIAL' },
        divisor:       { tipo: 'CARGA_HORARIA' },
        multiplicador: 0.2,
    },

    1666: {   // Adicional de Insalubridade
        base:          { tipo: 'SALARIO_MINIMO' },
        divisor:       { tipo: 'OUTRO_VALOR', valor: 1 },
        multiplicador: 0.2,
        quantidade:    { tipo: 'INFORMADA', valor: 1 },
    },

    1681: {   // Adicional de Periculosidade
        base:          { tipo: 'HISTORICO_SALARIAL' },
        divisor:       { tipo: 'OUTRO_VALOR', valor: 1 },
        multiplicador: 0.3,
        quantidade:    { tipo: 'INFORMADA', valor: 1 },
    },

    2458: {   // Salário / Diferença Salarial
        base:          { tipo: 'HISTORICO_SALARIAL' },
        divisor:       { tipo: 'OUTRO_VALOR', valor: 1 },
        multiplicador: 1,
        quantidade:    { tipo: 'INFORMADA', valor: 1 },
    },
}


// ── perfil do reflexo ─────────────────────────────────────────
//
// A multa do Art. 467 é reflexo de 50% sobre a verba rescisória, sem
// incidência de encargos. Vale para qualquer reflexo de assunto 2210.

const PJC_PADRAO_REFLEXO_POR_ASSUNTO = {
    2210: {   // Multa do Art. 467
        divisor:       { tipo: 'OUTRO_VALOR', valor: 1 },
        multiplicador: 0.5,
        quantidade:    { tipo: 'INFORMADA', valor: 1 },
        ocorrenciaDePagamento: 'DESLIGAMENTO',
        caracteristica: 'COMUM',
        variacao:      'FIXA',
        integralizar:  'SIM',
        // MANTER preserva o valor apurado da verba-base. INTEGRALIZAR manda o
        // reflexo tomar o mês cheio — foi o que fez a multa incidir sobre a
        // remuneração inteira em vez do valor refletido.
        tratamentoDaFracao: 'MANTER',
        comportamento: 'VALOR_MENSAL',
        incidenciaINSS: false, incidenciaIRPF: false, incidenciaFGTS: false,
    },
}


// ── integralizar por verba-base ───────────────────────────────
//
// "Integralizar" manda o reflexo tomar o valor CHEIO da competência, e não o
// que a verba-base efetivamente apurou. Para aviso prévio, férias e 13º é o
// que se quer. Para saldo de salário, não: a verba vale três dias, e
// integralizar faz o reflexo incidir sobre a remuneração inteira do mês.
//
// Nos .PJC de referência o calculista deixou justamente
// integralizar=NAO no reflexo sobre saldo de salário e SIM nos demais.

const PJC_NAO_INTEGRALIZAR_BASE = [
    8823,   // Saldo de Salário
]

function pjcAjustarIntegralizacao(ficha) {
    const avisos = []
    const porNome = {}
    ;(ficha.verbas || []).forEach(v => { porNome[v.nome] = v })

    ;(ficha.verbas || []).forEach(v => {
        if (v.tipo !== 'REFLEXO' || v.integralizarPorBase) return
        const bases = v.baseVerbas || []
        const alguma = bases.some(n => {
            const b = porNome[n]
            return b && PJC_NAO_INTEGRALIZAR_BASE.indexOf(b.assuntoCnj) >= 0
        })
        if (alguma) {
            // Saldo de salário: o item não integraliza, mas a fração de mês sim —
            // é assim que o calculista deixou no arquivo de referência.
            if (v.integralizar !== 'NAO') v.integralizar = 'NAO'
            if (!v.tratamentoDaFracao) v.tratamentoDaFracao = 'INTEGRALIZAR'
            avisos.push('"' + v.nome + '": integralizar=NÃO e fração=INTEGRALIZAR, ' +
                'porque a verba-base é apurada por dias')
        }
    })
    return avisos
}


// ── padrão final ──────────────────────────────────────────────
//
// Última rede: verba calculada que não casou com nenhum perfil.
// Escolhido para ser inofensivo — mensal, sobre a evolução salarial,
// sem multiplicar nem dividir além do óbvio.

const PJC_PADRAO_GENERICO = {
    base:          { tipo: 'HISTORICO_SALARIAL' },
    divisor:       { tipo: 'OUTRO_VALOR', valor: 1 },
    multiplicador: 1,
    quantidade:    { tipo: 'INFORMADA', valor: 1 },
}


// ── pjcGerarHistoricosDaRemuneracao ───────────────────────────
//
// Reproduz os históricos que o PJe-Calc cria sozinho ao salvar os
// parâmetros pela primeira vez: um por remuneração declarada, com uma
// ocorrência por competência, do mês da admissão ao da demissão.
//
// Sem eles o arquivo importa mas não regera: as verbas com base
// MAIOR_REMUNERACAO não encontram a evolução salarial de onde puxar.
// Como a importação não passa pelo "Salvar" da tela, os históricos
// precisam vir prontos dentro do arquivo.
//
// O nome e os flags de ÚLTIMA REMUNERAÇÃO foram lidos de um .PJC real.
// Os de MAIOR REMUNERAÇÃO seguem o mesmo molde — se a grafia do sistema
// for outra, corrija aqui, é só a constante abaixo.
//
// pjcGerarHistoricosDaRemuneracao(ficha) → array de avisos

// Só existe um. A "maior remuneração" é campo escalar do cálculo
// (valorMaiorRemuneracao), consumido direto pelas verbas de base
// MAIOR_REMUNERACAO — não gera histórico. Confirmado num .PJC em que as duas
// remunerações valiam o mesmo e ainda assim o sistema criou um único histórico.
const PJC_HISTORICOS_DE_REMUNERACAO = [
    { nome: 'ÚLTIMA REMUNERAÇÃO', campo: 'ultimaRemuneracao' },
]

function pjcGerarHistoricosDaRemuneracao(ficha) {
    const avisos = []
    const c = ficha.contrato || {}
    if (!c.admissao) return avisos

    const fim = c.demissao || c.dataLiquidacao
    if (!fim) return avisos

    const competencias = _pjc_competencias(c.admissao, fim)
    if (!competencias.length) return avisos

    PJC_HISTORICOS_DE_REMUNERACAO.forEach(perfil => {
        const valor = c[perfil.campo]
        if (valor == null) return

        const jaTem = (ficha.historicosSalariais || [])
            .some(h => _pjc_mesmoNome(h.nome, perfil.nome))
        if (jaTem) return

        ficha.historicosSalariais = ficha.historicosSalariais || []
        ficha.historicosSalariais.push({
            nome:           perfil.nome,
            variacao:       'FIXA',
            incidenciaFGTS: false,
            incidenciaINSS: true,
            ocorrencias:    competencias.map(data => ({ data: data, valor: valor })),
        })

        avisos.push('histórico "' + perfil.nome + '" gerado a partir da remuneração ' +
            'declarada: ' + competencias.length + ' competências')
    })

    return avisos
}


// Compara ignorando acento e caixa: a Ficha pode trazer "MAIOR REMUNERACAO"
// sem acento e não se deve criar um segundo histórico por causa disso.
function _pjc_mesmoNome(a, b) {
    return _pjc_semAcento(a) === _pjc_semAcento(b)
}

function _pjc_semAcento(t) {
    return String(t == null ? '' : t)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().toUpperCase()
}


// Lista o primeiro dia de cada mês entre as duas datas, inclusive.
function _pjc_competencias(inicioISO, fimISO) {
    const a = inicioISO.split('-').map(Number)
    const b = fimISO.split('-').map(Number)
    const datas = []
    let ano = a[0], mes = a[1]

    while (ano < b[0] || (ano === b[0] && mes <= b[1])) {
        datas.push(ano + '-' + String(mes).padStart(2, '0') + '-01')
        mes++
        if (mes > 12) { mes = 1; ano++ }
        if (datas.length > 720) break        // trava contra data absurda
    }
    return datas
}


// ── pjcAplicarPadroes ─────────────────────────────────────────
//
// Completa as verbas calculadas da Ficha com o perfil que couber.
// Devolve a lista de avisos, para que o painel mostre o que foi
// preenchido por padrão — nada é aplicado em silêncio.
//
// pjcAplicarPadroes(ficha) → array de avisos

function pjcAplicarPadroes(ficha) {
    let avisos = []
    if (!ficha || !Array.isArray(ficha.verbas)) return avisos

    avisos = avisos.concat(pjcGerarHistoricosDaRemuneracao(ficha))
    avisos = avisos.concat(pjcAjustarIntegralizacao(ficha))

    const temHistorico = (ficha.historicosSalariais || []).length > 0

    ficha.verbas.forEach(v => {
        if (v.tipo === 'INFORMADA') return

        const perfil = (v.tipo === 'REFLEXO')
            ? (PJC_PADRAO_REFLEXO_POR_ASSUNTO[v.assuntoCnj] || {})
            : (PJC_PADRAO_POR_CARACTERISTICA[v.caracteristica]
                || PJC_PADRAO_POR_ASSUNTO[v.assuntoCnj]
                || PJC_PADRAO_GENERICO)

        const usados = []

        for (const campo of ['base', 'divisor', 'multiplicador', 'quantidade',
                             'ocorrenciaDePagamento', 'variacao', 'integralizar',
                             'caracteristica', 'proporcionalizarBase', 'tratamentoDaFracao', 'comportamento',
                             'proporcionalizarHistorico', 'excluirFaltaJustificada',
                             'excluirFaltaNaoJustificada', 'excluirFeriasGozadas',
                             'incidenciaINSS', 'incidenciaIRPF', 'incidenciaFGTS']) {
            if (perfil[campo] === undefined) continue
            if (v[campo] !== undefined && v[campo] !== null) continue
            v[campo] = _pjc_copiar(perfil[campo])
            usados.push(campo)
        }

        // Quantidade em AVOS é contada pelo próprio PJe-Calc a partir do
        // período; valor informado junto atrapalha a apuração.
        if (v.quantidade && (v.quantidade.tipo === 'AVOS' ||
                             v.quantidade.tipo === 'IMPORTADA_DO_CALENDARIO')) {
            delete v.quantidade.valor
        }

        // Base em histórico sem histórico na Ficha não calcula nada; a maior
        // remuneração é o substituto que o próprio sistema oferece.
        if (v.tipo === 'CALCULADA' && !temHistorico &&
            v.base && v.base.tipo === 'HISTORICO_SALARIAL') {
            v.base = { tipo: 'MAIOR_REMUNERACAO' }
            usados.push('base→MAIOR_REMUNERACAO (sem histórico na Ficha)')
        }

        // Quantidade do cartão sem cartão declarado volta a ser informada.
        if (v.quantidade && v.quantidade.tipo === 'IMPORTADA_DO_CARTAO') {
            const existe = (ficha.cartoesDePonto || [])
                .some(c => c.nome === v.quantidade.cartao)
            if (!existe) {
                v.quantidade = { tipo: 'INFORMADA', valor: 1 }
                usados.push('quantidade→INFORMADA (cartão não declarado)')
            }
        }

        if (usados.length) {
            avisos.push('padrão aplicado em "' + v.nome + '": ' + usados.join(', '))
        }
    })

    return avisos
}


function _pjc_copiar(valor) {
    return (valor && typeof valor === 'object')
        ? JSON.parse(JSON.stringify(valor))
        : valor
}