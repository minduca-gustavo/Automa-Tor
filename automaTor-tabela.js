// ============================================================
// automaTor-tabela.js
//
// Lê a tabela "Sentenças Líquidas" do calculista e devolve o Pedido de
// Lançamento que o lançador consome.
//
// A tabela tem uma linha por item e o texto de cada item em pares
// "Chave: valor.":
//
//   Verba          | Parâmetros de Liquidação | Texto-Padrão
//   Aviso prévio   | Tipo do aviso, ...       | Tipo aviso: indenizado. Período: 30 dias. ...
//
// Só a primeira coluna (nome do item) e a ÚLTIMA (texto) são lidas; a
// do meio é documentação para quem preenche.
//
// O que a tabela traz e o lançador ainda não sabe lançar vai para
// 'pendencias', para aparecer na conferência — nada some em silêncio.
// ============================================================


// ── pjctLinhas ────────────────────────────────────────────────
//
// Normaliza a tabela para [{ item, texto }], qualquer que seja a forma
// em que chegou:
//   - elemento <table> do editor (HTMLTableElement)
//   - texto TSV (colado de planilha)
//   - array de arrays  [['Aviso prévio', '...', 'Tipo aviso: ...'], ...]
//   - array de objetos [{ verba: 'Aviso prévio', texto: '...' }, ...]
// A linha de cabeçalho (primeira célula "Verba") é descartada.

function pjctLinhas(tabela) {
    let linhas = []

    if (tabela && typeof tabela === 'object' && tabela.rows && typeof tabela.rows.length === 'number') {
        linhas = Array.from(tabela.rows).map(tr =>
            Array.from(tr.cells).map(td => _pjct_textoDaCelula(td)))
    } else if (typeof tabela === 'string') {
        linhas = tabela.replace(/\r/g, '').split('\n')
            .filter(l => l.trim())
            .map(l => l.split('\t'))
    } else if (Array.isArray(tabela)) {
        linhas = tabela.map(l => Array.isArray(l) ? l
            : [l.verba || l.item || '', l.texto || l.textoPadrao || ''])
    }

    return linhas
        .filter(c => c.length >= 2 && String(c[0]).trim())
        .map(c => ({ item: String(c[0]).trim(), texto: String(c[c.length - 1] || '').trim() }))
        .filter(l => _pjct_norm(l.item) !== 'VERBA')
}

// Célula do editor: o texto pode vir quebrado em parágrafos e <br>.
// Junta tudo numa linha, com espaço entre os blocos.
function _pjct_textoDaCelula(td) {
    const partes = []
    td.childNodes.forEach(n => partes.push(n.textContent))
    return partes.join(' ').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}


// ── pjctPares ─────────────────────────────────────────────────
//
// "Chave: valor. Outra chave: valor" → { 'CHAVE': 'valor', ... }
// Tolera ponto faltando entre pares ("2025 Proporcional: 2025"): o início
// de cada chave é uma palavra com inicial maiúscula seguida de ':'.

function pjctPares(texto) {
    const re = /(?:^|[.\s])([A-ZÀ-Ý][A-Za-zÀ-ÿ0-9 /%-]{0,40}?):\s/g
    const marcas = []
    let m
    while ((m = re.exec(texto)) !== null) {
        marcas.push({ chave: m[1].trim(), ini: m.index + m[0].length, cab: m.index })
    }
    const pares = {}
    marcas.forEach((mk, i) => {
        const fim = i + 1 < marcas.length ? marcas[i + 1].cab + 1 : texto.length
        pares[_pjct_norm(mk.chave)] = texto.slice(mk.ini, fim).trim().replace(/\.$/, '').trim()
    })
    return pares
}


// ── pjctMontarPedido ──────────────────────────────────────────
//
// tabela (qualquer forma aceita por pjctLinhas) → { pedido, pendencias }
// O bloco 'processo' do pedido fica vazio: quem chama o preenche com o
// resultado de dadosProcessuais().

function pjctMontarPedido(tabela) {
    const T = {}
    pjctLinhas(tabela).forEach(l => { T[_pjct_norm(l.item)] = l })
    const P = k => (T[k] ? pjctPares(T[k].texto) : null)
    const pendencias = []

    const ini  = P('PARAMETROS INICIAIS PJE-CALC') || {}
    const ct   = P('CONTRATO DE TRABALHO') || {}
    const hist = P('HISTORICO SALARIAL') || {}

    const pedido = {
        processo: {},
        contrato: {
            admissao:         pjctData(ct['DATA ADMISSAO']),
            demissao:         pjctData(ct['DATA DEMISSAO']),
            ajuizamento:      pjctData(ini['AJUIZAMENTO']),
            remuneracao:      pjctValor(hist['VALOR']),
            maiorRemuneracao: pjctValor(ini['MAIOR REMUNERACAO']),
        },
        verbas: [],
    }

    const av = P('AVISO PREVIO')
    if (av) {
        const dias = Number((/(\d+)\s*dias/.exec(av['PERIODO'] || '') || [])[1])
        pedido.verbas.push({ verba: 'AVISO PREVIO', nome: 'AVISO PRÉVIO', dias: dias || null })
    }

    const dt = P('DECIMO TERCEIRO SALARIO')
    if (dt) {
        const m = /(\d+)\s*\/\s*12/.exec(dt['AVOS'] || '')
        const ano = Number(dt['PROPORCIONAL'] || dt['ANOS DE REFERENCIA'])
        pedido.verbas.push({ verba: '13o SALARIO', nome: '13º SALÁRIO',
                             avos: [{ ano: ano, avos: m ? +m[1] : null }] })
    }

    const fe = P('FERIAS ACRESCIDAS DO TERCO LEGAL')
    if (fe) {
        const datas = ((fe['PERIODO AQUISITIVO'] || '').match(/\d{2}\/\d{2}\/\d{4}/g) || []).map(pjctData)
        const m = /(\d+)\s*\/\s*12/.exec(fe['AVOS'] || '')
        if (datas.length === 2) {
            pedido.verbas.push({
                verba: 'FERIAS PROPORCIONAIS', nome: 'FÉRIAS + 1/3',
                periodos: [{ aquisitivo: datas[0].slice(0, 4) + '/' + datas[1].slice(0, 4),
                             inicio: datas[0], fim: datas[1], avos: m ? +m[1] : null }],
            })
        } else {
            pendencias.push('Férias: período aquisitivo ilegível — "' + (fe['PERIODO AQUISITIVO'] || '') + '"')
        }
    }

    if (T['MULTA ARTIGO 477 CLT']) pedido.verbas.push({ verba: 'MULTA DO ARTIGO 477 DA CLT' })

    const fg = P('MULTA 40% FGTS')
    if (fg) {
        pedido.fgts = { multa: 40, destino: 'DEPOSITAR',
                        incidencia: 'SOBRE_TOTAL_DEVIDO_MAIS_SAQUE_E_OU_SALDO' }
        const s = fg['SALDO E/OU SAQUE']
        if (s) pendencias.push('FGTS — saldo/saque a lançar: ' + s)
    }

    // Itens que a tabela traz e o gerador ainda não lança.
    ;['ADICIONAL DE INSALUBRIDADE', 'HONORARIOS ADVOCATICIOS', 'HONORARIOS PERICIAIS',
      'CUSTAS JUDICIAIS', 'CRITERIOS DE ATUALIZACAO'].forEach(k => {
        if (T[k]) pendencias.push(T[k].item + ': ' + T[k].texto)
    })
    if (ct['MODALIDADE RESCISAO']) pendencias.push('Modalidade de rescisão: ' + ct['MODALIDADE RESCISAO'])

    // Item da tabela que nenhuma regra acima reconhece: avisa pelo nome.
    const conhecidos = ['PARAMETROS INICIAIS PJE-CALC', 'CONTRATO DE TRABALHO', 'HISTORICO SALARIAL',
        'AVISO PREVIO', 'DECIMO TERCEIRO SALARIO', 'FERIAS ACRESCIDAS DO TERCO LEGAL',
        'MULTA ARTIGO 477 CLT', 'MULTA ARTIGO 467 CLT', 'MULTA 40% FGTS', 'ADICIONAL DE INSALUBRIDADE',
        'HONORARIOS ADVOCATICIOS', 'HONORARIOS PERICIAIS', 'CUSTAS JUDICIAIS', 'CRITERIOS DE ATUALIZACAO']
    Object.keys(T).forEach(k => {
        if (conhecidos.indexOf(k) < 0) pendencias.push('Item da tabela não reconhecido: "' + T[k].item + '"')
    })

    return { pedido: pedido, pendencias: pendencias }
}


// ── auxiliares ────────────────────────────────────────────────

function pjctData(br) {            // 06/05/2025 → 2025-05-06
    const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(br || '')
    return m ? m[3] + '-' + m[2] + '-' + m[1] : null
}

function pjctValor(t) {            // R$ 2.020,80 → 2020.8
    const m = /([\d.]+,\d{2})/.exec(t || '')
    return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null
}

function _pjct_norm(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/\s+/g, ' ').trim()
}