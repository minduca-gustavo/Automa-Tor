// ============================================================
// automaTor-gerar.js
//
// Ponto de entrada único: dados do processo + tabela do calculista →
// arquivo .PJC pronto para importar.
//
// Encadeia, nesta ordem:
//   dadosProcessuais()   automaTor-processo.js   quem e qual processo
//   pjctMontarPedido()   automaTor-tabela.js     quanto e de quando
//   pjcLancar()          automaTor-lancador.js   Pedido → Ficha
//   montarXml()          automaTor-montador.js   Ficha → XML
//   empacotar()          automaTor-montador.js   XML → zip .PJC
//
// Dependências carregadas antes deste arquivo: automaTor-base.js,
// automaTor-vocabulario.js (antes do montador), automaTor-padroes.js,
// automaTor-processo.js, automaTor-lancador.js, automaTor-montador.js,
// automaTor-tabela.js.
// ============================================================


// ── pjcGerarPjc ───────────────────────────────────────────────
//
// const r = await pjcGerarPjc({
//     processo: {                         // mesmo formato de dadosProcessuais()
//         numeroProcesso: '0011965-83.2025.5.15.0089',
//         autuacao:       '2025-11-13',               // ou '13/11/2025'
//         valorDaCausa:   284429.98,                  // ou 'R$ 284.429,98'
//         reclamante:     { nome, documento },
//         reclamada:      { nome, documento },        // ou lista
//         advogadosReclamante: [{ nome, documento, oab }],
//         advogadosReclamada:  [{ nome, documento, oab }],
//     },
//     tabela:         elementoTable,                  // <table>, TSV, array de linhas
//     dataLiquidacao: '2026-09-30',                   // obrigatória
//     setor:          76,                             // opcional
// })
//
// Devolve sempre o mesmo formato, com ou sem sucesso:
//   {
//     ok:         true | false,
//     arquivo:    Blob  (só se ok)       — o .PJC para baixar
//     bytes:      Uint8Array (só se ok)  — o mesmo arquivo, para enviar a outro lugar
//     nome:       'PROCESSO_..._CALCULO_0_DATA_30092026_HORA_000000.PJC'
//     xml:        string (só se ok)      — para conferência
//     erros:      [string]   — impedem a geração; ok = false
//     avisos:     [string]   — padrões aplicados, dados faltantes
//     pendencias: [string]   — itens da tabela que NÃO foram lançados
//     resumo:     [string]   — verbas e reflexos lançados
//   }
// Nunca lança exceção: todo problema volta em 'erros'.

async function pjcGerarPjc(entrada) {
    const r = { ok: false, arquivo: null, bytes: null, nome: null, xml: null,
                erros: [], avisos: [], pendencias: [], resumo: [] }
    entrada = entrada || {}

    try {
        // 1. Processo
        const dp = dadosProcessuais(entrada.processo || {})
        r.erros.push(...dp.erros)
        r.avisos.push(...dp.avisos)

        // 2. Tabela
        if (!entrada.tabela) r.erros.push('tabela não informada')
        const tb = pjctMontarPedido(entrada.tabela || [])
        r.pendencias.push(...tb.pendencias)

        const pedido = tb.pedido
        pedido.processo = dp.processo
        pedido.contrato.dataLiquidacao = _pjcg_data(entrada.dataLiquidacao)
        if (!pedido.contrato.dataLiquidacao) {
            r.erros.push('dataLiquidacao ausente ou inválida: "' + entrada.dataLiquidacao + '"')
        }
        if (entrada.setor != null) pedido.contrato.setor = entrada.setor
        // Ajuizamento: a tabela manda; na falta, a autuação do PJe.
        if (!pedido.contrato.ajuizamento) pedido.contrato.ajuizamento = dp.processo.dataAutuacao
        if (!pedido.verbas.length) r.erros.push('nenhuma verba reconhecida na tabela')

        if (r.erros.length) return r

        // 3. Lançador
        const l = pjcLancar(pedido)
        r.erros.push(...l.erros)
        r.avisos.push(...l.avisos)
        if (r.erros.length) return r
        r.pendencias.push(...(l.ficha.pendencias || []))
        r.resumo = pjcResumirPedido(l.ficha)

        // 4. Montador
        const m = PjcMontador.montarXml(l.ficha, PJC_BASE)
        r.avisos.push(...m.avisos.filter(a => !/sem fonte nos autos/.test(a)))
        r.xml = m.xml
        r.nome = PjcMontador.nomeDoArquivo(l.ficha)

        // 5. Zip
        const bytes = await _pjcg_empacotar(m.xml, r.nome)
        r.bytes = bytes
        r.arquivo = new Blob([bytes], { type: 'application/octet-stream' })
        r.ok = true
    } catch (e) {
        r.erros.push(e && e.message ? e.message : String(e))
    }
    return r
}


// ── empacotamento ─────────────────────────────────────────────
//
// Deflate pelo CompressionStream quando existe; senão a entrada vai
// armazenada (método 0), que o PJe-Calc também aceita.

async function _pjcg_empacotar(xml, nome) {
    if (typeof CompressionStream === 'function') {
        try {
            const dados = new Uint8Array(xml.length)
            for (let i = 0; i < xml.length; i++) dados[i] = xml.charCodeAt(i) & 0xFF
            const cs = new CompressionStream('deflate-raw')
            const escritor = cs.writable.getWriter()
            const leitura = new Response(cs.readable).arrayBuffer()
            await escritor.ready
            await escritor.write(dados)
            await escritor.close()
            const comprimido = new Uint8Array(await leitura)
            return PjcMontador.empacotar(xml, nome, () => comprimido, 8)
        } catch (e) {
            console.warn('[Automa-Tor] deflate falhou, gravando sem compressão:', e)
        }
    }
    return PjcMontador.empacotar(xml, nome, null, 0)
}

function _pjcg_data(t) {
    if (!t) return null
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t).trim())
    if (m) return m[0]
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(t).trim())
    return m ? m[3] + '-' + m[2] + '-' + m[1] : null
}