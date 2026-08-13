// ============================================================
// painel.js
// Monta o painel do gerador de PJC usando os componentes do ui.js.
//
// Fluxo: colar a resposta da LLM → Gerar arquivo → baixar o .pjc.
// A conferência aparece no próprio painel; nada é enviado para fora
// do navegador.
// ============================================================

const PJC_ID = {
    flutuante: 'pjc_painel',
    corpo:     'pjc_corpo',
    entrada:   'pjc_entrada',
    gerar:     'pjc_gerar',
    limpar:    'pjc_limpar',
    saida:     'pjc_saida',
}
console.log('[Automa-Tor]')

// ── pjcIniciarPainel ──────────────────────────────────────────
//
// Cria o painel flutuante. Chamado uma vez pelo content script.

async function pjcIniciarPainel() {
    console.log('[Automa-Tor] 25')
    if (document.getElementById(PJC_ID.flutuante)) return

    await criaDivFlutuante({
        id:      PJC_ID.flutuante,
        titulo:  'Gerador de PJC',
        largura: '340px',
        ancestral: "#ffff",
        armazenarRecolhido: true
    })

    criaDiv({ id: PJC_ID.corpo, ancestral: PJC_ID.flutuante + '-corpo' })

    criaTexto({
        id:        'pjc_ajuda',
        texto:     'Cole a resposta da LLM inteira — o JSON é separado do texto automaticamente.',
        ancestral: PJC_ID.corpo,
    })

    let input = criaInputAnotacao({
        id:          PJC_ID.entrada,
        textoEmCima: 'Resposta da LLM',
        placeholder: 'Cole aqui...',
        ancestral:   PJC_ID.corpo,
    })
    input.textarea.style.maxHeight = '180px'

    criaBotaoAzul({
        id:        PJC_ID.gerar,
        texto:     'Gerar arquivo',
        ancestral: PJC_ID.corpo,
        acao:      pjcGerar,
    })

    criaBotaoLaranja({
        id:        PJC_ID.limpar,
        texto:     'Limpar',
        ancestral: PJC_ID.corpo,
        acao:      pjcLimpar,
    })

    criaDiv({ id: PJC_ID.saida, ancestral: PJC_ID.corpo })
}


// ── pjcLimpar ─────────────────────────────────────────────────

function pjcLimpar() {
    const entrada = document.getElementById(PJC_ID.entrada)
    if (entrada) {
        entrada.value = ''
        entrada.style.height = 'auto'
    }
    _pjc_zerarSaida()
}


// ── pjcGerar ──────────────────────────────────────────────────
//
// Extrai a Ficha, monta o XML, empacota e oferece o download.

async function pjcGerar() {
    _pjc_zerarSaida()

    const entrada = document.getElementById(PJC_ID.entrada)
    const bruto = entrada ? entrada.value : ''

    const extraido = pjcExtrairJson(bruto)
    if (!extraido.ok) {
        _pjc_dizer(extraido.aviso, 'erro')
        return
    }
    _pjc_dizer('JSON localizado — anexo ' + (extraido.ficha.anexo || 'não informado'), 'ok')

    let montado
    try {
        montado = PjcMontador.montarXml(extraido.ficha, PJC_BASE)
    } catch (e) {
        _pjc_dizer(e.message, 'erro')
        _pjc_dizer('Devolva a mensagem acima à LLM e peça a Ficha corrigida.', 'nota')
        return
    }

    pjcResumirFicha(extraido.ficha).forEach(l => _pjc_dizer(l, 'nota'))
    montado.avisos.forEach(a => _pjc_dizer(a, 'aviso'))
    _pjc_dizer('XML: ' + montado.xml.length.toLocaleString('pt-BR') + ' bytes', 'ok')

    const nome = PjcMontador.nomeDoArquivo(extraido.ficha)
    let zip
    try {
        zip = await _pjc_empacotar(montado.xml, nome)
    } catch (e) {
        _pjc_dizer('Falha ao compactar: ' + e.message, 'erro')
        return
    }
    _pjc_dizer('Arquivo: ' + zip.length.toLocaleString('pt-BR') + ' bytes', 'ok')

    _pjc_oferecerDownload(zip, nome)
}


// ── empacotamento ─────────────────────────────────────────────
//
// O .pjc é um zip com uma única entrada, de mesmo nome do arquivo
// externo. O deflate vem do CompressionStream, nativo no Firefox.

async function _pjc_empacotar(xml, nome) {
    const dados = _pjc_bytesAscii(xml)

    // Mesmo caminho da versão de console, que comprovadamente gera arquivos
    // aceitos pelo PJe-Calc. Sem CompressionStream — ou se ele falhar — o zip
    // sai com a entrada armazenada: o PJe-Calc lê os dois formatos, e arquivo
    // grande é melhor que arquivo nenhum.
    if (typeof CompressionStream === 'function') {
        try {
            const comprimido = await _pjc_deflate(dados)
            return PjcMontador.empacotar(xml, nome, () => comprimido)
        } catch (e) {
            console.warn('[pjc] deflate falhou, gravando sem compressão:', e)
        }
    }

    // Troca o método de compressão nos dois cabeçalhos — 8 no local, 10 no
    // central, deslocamentos fixos de um zip de entrada única.
    const zip = PjcMontador.empacotar(xml, nome, d => d)
    const central = 30 + _pjc_bytesAscii(nome).length + dados.length
    zip[8] = 0; zip[9] = 0
    zip[central + 10] = 0; zip[central + 11] = 0
    return zip
}


function _pjc_bytesAscii(s) {
    const b = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xFF
    return b
}


// Cada etapa aguardada: sem os await, o writer pode ser coletado antes de
// terminar e a operação aborta no meio.
async function _pjc_deflate(bytes) {
    const cs = new CompressionStream('deflate-raw')
    const escritor = cs.writable.getWriter()
    const leitura = new Response(cs.readable).arrayBuffer()

    await escritor.ready
    await escritor.write(bytes)
    await escritor.close()

    return new Uint8Array(await leitura)
}


function _pjc_oferecerDownload(zip, nome) {
    const url = URL.createObjectURL(new Blob([zip], { type: 'application/octet-stream' }))
    const saida = document.getElementById(PJC_ID.saida)

    const link = document.createElement('a')
    link.href = url
    link.download = nome
    link.textContent = '⬇ Baixar ' + nome
    Object.assign(link.style, {
        display:        'block',
        background:     '#0078aa',
        color:          '#ffffff',
        textDecoration: 'none',
        borderRadius:   '6px',
        padding:        '8px 12px',
        margin:         '6px 3px',
        fontSize:       '12px',
        fontWeight:     '700',
        fontFamily:     "'Segoe UI', system-ui, sans-serif",
        textAlign:      'center',
        wordBreak:      'break-all',
    })
    saida.appendChild(link)

    _pjc_dizer('Depois de importar: regere as verbas e confira os totais contra o título.', 'nota')
}


// ── saída ─────────────────────────────────────────────────────

function _pjc_zerarSaida() {
    const saida = document.getElementById(PJC_ID.saida)
    if (saida) saida.innerHTML = ''
}

function _pjc_dizer(texto, classe) {
    const saida = document.getElementById(PJC_ID.saida)
    if (!saida) return

    const cores = {
        ok:    '#2f6b4f',
        erro:  '#c62828',
        aviso: '#8a6216',
        nota:  '#6b7c93',
    }

    const linha = document.createElement('div')
    linha.textContent = texto
    Object.assign(linha.style, {
        fontSize:   '11.5px',
        lineHeight: '1.5',
        color:      cores[classe] || cores.nota,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding:    '3px 3px',
        borderTop:  '1px solid #f0f0f2',
        whiteSpace: 'pre-wrap',
    })
    saida.appendChild(linha)
}