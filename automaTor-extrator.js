// ============================================================
// pjc-extrator.js
// Separa a Ficha de Liquidação (JSON) do resto da mensagem da LLM.
//
// A mensagem colada costuma vir inteira: texto de análise, tabelas,
// o bloco JSON e ainda um fecho depois dele. O extrator localiza o
// bloco, ignorando o que vem antes e depois.
// ============================================================


// ── pjcExtrairJson ────────────────────────────────────────────
//
// Recebe o texto colado e devolve { ok, ficha, json, aviso }.
//   ok    : true se conseguiu interpretar um objeto JSON
//   ficha : o objeto já parseado (quando ok)
//   json  : o trecho de texto identificado como JSON
//   aviso : mensagem explicando o que houve (sempre preenchida em erro)
//
// pjcExtrairJson(texto)

function pjcExtrairJson(texto) {
    if (!texto || !texto.trim()) {
        return { ok: false, aviso: 'Cole a resposta da LLM antes de gerar.' }
    }

    const candidatos = []

    // 1º) bloco cercado por ``` — é como a LLM costuma entregar
    const cerca = /```(?:json)?\s*([\s\S]*?)```/gi
    let m
    while ((m = cerca.exec(texto)) !== null) {
        const dentro = m[1].trim()
        if (dentro.startsWith('{')) candidatos.push(dentro)
    }

    // 2º) varredura por chaves equilibradas, do primeiro '{' em diante
    if (!candidatos.length) {
        const achado = _pjc_varrerChaves(texto)
        if (achado) candidatos.push(achado)
    }

    if (!candidatos.length) {
        return {
            ok: false,
            aviso: 'Não encontrei nenhum bloco JSON na mensagem. ' +
                   'Confira se a resposta da LLM inclui a Ficha entre chaves.'
        }
    }

    // O maior candidato é a Ficha; blocos menores costumam ser exemplos soltos.
    candidatos.sort((a, b) => b.length - a.length)

    for (const bruto of candidatos) {
        const limpo = _pjc_higienizar(bruto)
        try {
            const ficha = JSON.parse(limpo)
            if (ficha && typeof ficha === 'object' && !Array.isArray(ficha)) {
                return { ok: true, ficha: ficha, json: limpo }
            }
        } catch (e) {
            var ultimoErro = e
        }
    }

    return {
        ok: false,
        json: candidatos[0],
        aviso: 'Encontrei um bloco entre chaves, mas ele não é JSON válido: ' +
               (typeof ultimoErro !== 'undefined' ? ultimoErro.message : 'erro ao interpretar') +
               '. Peça à LLM apenas o bloco JSON, sem texto dentro dele.'
    }
}


// ── _pjc_varrerChaves ─────────────────────────────────────────
//
// Percorre o texto contando chaves até fechar o objeto que abriu.
// Um simples "pegue do primeiro { ao último }" quebra quando a
// mensagem traz outro trecho entre chaves depois da Ficha; e cortar
// no primeiro '}' quebra em qualquer objeto aninhado — que é o caso
// de toda Ficha, já que 'contrato' e 'processo' são objetos.
// Strings são respeitadas: uma chave dentro de aspas não conta.

function _pjc_varrerChaves(texto) {
    const inicio = texto.indexOf('{')
    if (inicio < 0) return null

    let profundidade = 0
    let dentroDeString = false
    let escapando = false

    for (let i = inicio; i < texto.length; i++) {
        const c = texto[i]

        if (escapando) { escapando = false; continue }
        if (c === '\\' && dentroDeString) { escapando = true; continue }
        if (c === '"') { dentroDeString = !dentroDeString; continue }
        if (dentroDeString) continue

        if (c === '{') profundidade++
        else if (c === '}') {
            profundidade--
            if (profundidade === 0) return texto.slice(inicio, i + 1)
        }
    }
    return null   // objeto aberto e nunca fechado — provavelmente truncado
}


// ── _pjc_higienizar ───────────────────────────────────────────
//
// Corrige desvios frequentes das LLMs que não alteram o sentido:
// aspas tipográficas, vírgula sobrando antes de fechar, comentários
// de linha e reticências de omissão.

function _pjc_higienizar(bruto) {
    return bruto
        .replace(/[\u201C\u201D]/g, '"')      // aspas curvas
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/^\s*\/\/.*$/gm, '')          // comentário de linha inteira
        .replace(/,(\s*[}\]])/g, '$1')         // vírgula pendurada
        .trim()
}


// ── pjcResumirFicha ───────────────────────────────────────────
//
// Resumo curto da Ficha, para conferência antes de gerar o arquivo.
//
// pjcResumirFicha(ficha) → array de strings

function pjcResumirFicha(ficha) {
    const linhas = []
    const p = ficha.processo || {}
    const c = ficha.contrato || {}

    if (p.numeroCNJ) linhas.push('Processo: ' + p.numeroCNJ)
    if (p.reclamante && p.reclamante.nome) linhas.push('Reclamante: ' + p.reclamante.nome)
    if (c.admissao || c.demissao) {
        linhas.push('Contrato: ' + (c.admissao || '?') + ' a ' + (c.demissao || 'vigente'))
    }
    if (c.dataLiquidacao) linhas.push('Liquidação em: ' + c.dataLiquidacao)

    const verbas = ficha.verbas || []
    linhas.push('Verbas: ' + verbas.length)
    verbas.forEach(v => linhas.push('   • ' + (v.nome || '(sem nome)') + ' [' + (v.tipo || '?') + ']'))

    const hist = ficha.historicosSalariais || []
    linhas.push('Históricos salariais: ' + hist.length)

    const pend = ficha.pendencias || []
    if (pend.length) {
        linhas.push('Pendências apontadas pela LLM: ' + pend.length)
        pend.forEach(x => linhas.push('   • ' + x))
    }
    return linhas
}
