// criarCaixaDeAviso

// ============================================================
// ui.js
// Biblioteca de componentes visuais do assistente Rota PJE.
//
// Paleta:
//   azul    #0078aa      laranja  #ffa726
//   fundo   #f9f9fa      borda    #dcdcdc
//   texto   #2c3e50      suave    #6b7c93
//
// Convenção:
//   - Todos os componentes recebem um objeto de configuração.
//   - 'ancestral' é sempre o id (string) do elemento pai.
//   - O elemento criado é inserido no ancestral automaticamente.
//   - Todos os componentes retornam o elemento raiz criado.
//   - Ids são obrigatórios para que o roteiro possa acessar
//     os valores por document.getElementById(id).
// ============================================================

const ROTA_Z = { btn: 9000, widget: 9100, aviso: 9300, modal: 9400, painel: 9500 }

// ── Utilitários internos ──────────────────────────────────────

const UI_CORES = {
    azul:        '#3a5a40',
    azulHover:   '#344e41',
    laranja:     '#b39c4d',
    laranjaHover:'#f7c548',
    fundo:       '#dad7cd',
    borda:       '#dcdcdc',
    texto:       '#221e1c',
    suave:       '#6b7c93',
    branco:      '#ffffff',
    erro:        '#c03221',
}

function _ui_el(tag, estilos = {}) {
    const el = document.createElement(tag)
    Object.assign(el.style, estilos)
    return el
}

// Insere 'el' dentro do elemento com id 'ancestral'.
// Se 'ancestral' não for encontrado, insere no body com aviso.
function _ui_inserir(el, ancestral) {
    // Aceita id simples ('minha-div') ou seletor CSS ('[class*="pje"]')
    const pai = ancestral.match(/^[a-zA-Z0-9_-]+$/)
        ? document.getElementById(ancestral)
        : document.querySelector(ancestral)
    if (!pai) {
        console.warn('[ui.js] ancestral não encontrado:', ancestral)
        document.body.appendChild(el)
        return
    }
    pai.appendChild(el)
}

// Estilo base de botão — compartilhado por variantes
function _ui_estiloBotao(cor, corHover, corTexto = '#ffffff') {
    return {
        display:      'block',
        width:        '100% - 6px',
        background:   cor,
        color:        corTexto,
        border:       'none',
        borderRadius: '6px',
        padding:      '8px 12px',
        marginLeft:   '3px',
        marginRight:  '3px',
        fontSize:     '12px',
        fontWeight:   '700',
        fontFamily:   "'Segoe UI', system-ui, sans-serif",
        cursor:       'pointer',
        textAlign:    'center',
        transition:   'background 0.15s',
        boxSizing:    'border-box',
    }
}

function _ui_hoverBotao(btn, cor, corHover) {
    btn.addEventListener('mouseenter', () => btn.style.background = corHover)
    btn.addEventListener('mouseleave', () => btn.style.background = cor)
}


// ── criaDiv ───────────────────────────────────────────────────
//
// Cria uma div genérica com id. Usada como container para
// agrupar outros componentes.
//
// criaDiv({ id, ancestral })

function criaDiv({ id, ancestral , rowColumn = 'column'}) {
    const el = _ui_el('div', {
        display:       'flex',
        flexDirection: rowColumn,
        gap:           '6px',
        marginBottom:  '8px',
    })
    el.id = id
    _ui_inserir(el, ancestral)
    return el
}


// ── criaDivFlutuante ──────────────────────────────────────────
//
// Container flutuante arrastável. O usuário pode mover pela
// barra de título. A posição é salva via armazenar/obterArmazenamento.
//
// O roteiro insere outros componentes usando o id como ancestral.
//
// criaDivFlutuante({ id, titulo, largura, ancestral })
//   largura: opcional, padrão '280px'
//   ancestral: opcional — se omitido, insere em document.body

async function criaDivFlutuante({ id, titulo = '', largura = '280px', ancestral, armazenarRecolhido = false }) {

    // ── posição inicial ───────────────────────────────────────
    const CHAVE   = 'ui_flutuante_pos_' + id
    const POS_PAD = 16
    let posicao   = { top: POS_PAD, left: POS_PAD }

    // ── clamp reutilizável (carregamento + resize) ─────────────
    function _clampPosicaoWidget(pos) {
        const larguraPx = parseInt(largura) || 280
        const alturaBarraPx = 34 // altura aproximada da barra de título (sempre precisa ficar visível)
        const margemMinimaVisivel = 40 // pelo menos essa fatia do widget precisa continuar na tela

        const maxTop  = Math.max(0, window.innerHeight - alturaBarraPx)
        const maxLeft = Math.max(0, window.innerWidth  - margemMinimaVisivel)
        const minLeft = -(larguraPx - margemMinimaVisivel) // permite sair parcialmente pra esquerda, mas não sumir

        const clamped = {
            top:  Math.min(Math.max(0, pos.top), maxTop),
            left: Math.min(Math.max(minLeft, pos.left), maxLeft),
        }

        // guarda extra contra valores corrompidos (NaN, Infinity etc.)
        if (!Number.isFinite(clamped.top))  clamped.top  = POS_PAD
        if (!Number.isFinite(clamped.left)) clamped.left = POS_PAD

        return clamped
    }

    const salvo = await obterArmazenamento([CHAVE])
    if (salvo && salvo[CHAVE] && typeof salvo[CHAVE].top === 'number' && typeof salvo[CHAVE].left === 'number') {
        posicao = _clampPosicaoWidget(salvo[CHAVE])
    }

    // ── wrapper (position:fixed) ──────────────────────────────
    const wrapper = _ui_el('div', {
        position:      'fixed',
        top:           posicao.top  + 'px',
        left:          posicao.left + 'px',
        width:         largura,
        background:    UI_CORES.branco,
        border:        '1px solid ' + UI_CORES.borda,
        borderRadius:  '8px',
        boxShadow:     '0 4px 16px rgba(0,0,0,0.15)',
        zIndex:        String(ROTA_Z.flutuante ?? 9000),
        display:       'flex',
        flexDirection: 'column',
        fontFamily:    "'Segoe UI', system-ui, sans-serif",
        userSelect:    'none',
        minWidth:      '180px',
    })
    wrapper.id = id

    // ── barra de título (handle de arrasto) ───────────────────
    const barra = _ui_el('div', {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        background:     UI_CORES.azul,
        color:          UI_CORES.branco,
        borderRadius:   '7px 7px 0 0',
        padding:        '6px 10px',
        cursor:         'grab',
        fontSize:       '12px',
        fontWeight:     '700',
        flexShrink:     '0',
    })

    const barraTexto = _ui_el('span', {})
    barraTexto.textContent = titulo

    // ── botões (recolher / fechar) ─────────────────────────────
    const barraBotoes = _ui_el('div', {
        display:    'flex',
        alignItems: 'center',
        gap:        '2px',
        flexShrink: '0',
    })

    function _criaBotaoBarra(texto, tituloBotao) {
        const botao = _ui_el('button', {
            background:   'transparent',
            border:       'none',
            color:        UI_CORES.branco,
            cursor:       'pointer',
            fontSize:     '13px',
            lineHeight:   '1',
            padding:      '2px 5px',
            borderRadius: '4px',
        })
        botao.type = 'button'
        botao.textContent = texto
        botao.title = tituloBotao
        botao.addEventListener('mouseenter', () => {
            botao.style.background = 'rgba(255,255,255,0.2)'
        })
        botao.addEventListener('mouseleave', () => {
            botao.style.background = 'transparent'
        })
        return botao
    }
    let recolhido = false
    if (armazenarRecolhido){
        let label = id + 'estado'
        let armazenamento = await obterArmazenamento([label])
        if (armazenamento) recolhido = armazenamento[label]
    }
    let textoBotao = recolhido ? '▢' : '─'
    const botaoRecolher = _criaBotaoBarra(textoBotao, 'Recolher')
    const botaoFechar   = _criaBotaoBarra('✕', 'Fechar')

    barraBotoes.appendChild(botaoRecolher)
    barraBotoes.appendChild(botaoFechar)

    barra.appendChild(barraTexto)
    barra.appendChild(barraBotoes)
    wrapper.appendChild(barra)

    // ── corpo (ancestral dos componentes filhos) ──────────────
    const corpo = _ui_el('div', {
        display:       'flex',
        flexDirection: 'column',
        gap:           '6px',
        padding:       '8px 0 6px 0',
        overflowY:     'auto',
        maxHeight:     '80vh',
    })
    corpo.id = id + '-corpo'
    corpo.classList.add('ui-clip-liberavel')
    wrapper.appendChild(corpo)

    // ── recolher / expandir ─────────────────────────────────────

    corpo.style.display    = recolhido ? 'none' : 'flex'

    botaoRecolher.addEventListener('click', (e) => {
        e.stopPropagation()
        recolhido = !recolhido
        if (armazenarRecolhido){
            let label = id + 'estado'
            armazenar({[label]: recolhido})
        }
        corpo.style.display    = recolhido ? 'none' : 'flex'
        botaoRecolher.textContent = recolhido ? '▢' : '─'
        botaoRecolher.title       = recolhido ? 'Expandir' : 'Recolher'
    })

    // ── fechar ───────────────────────────────────────────────────
    botaoFechar.addEventListener('click', (e) => {
        e.stopPropagation()
        wrapper.remove()
    })

    // ── arrasto ───────────────────────────────────────────────
    let arrastando = false
    let origemX, origemY, inicioTop, inicioLeft

    barra.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return
        arrastando = true
        origemX    = e.clientX
        origemY    = e.clientY
        inicioTop  = parseInt(wrapper.style.top)  || 0
        inicioLeft = parseInt(wrapper.style.left) || 0
        barra.style.cursor = 'grabbing'
        e.preventDefault()
    })

    document.addEventListener('mousemove', (e) => {
        if (!arrastando) return
        const novoTop  = inicioTop  + (e.clientY - origemY)
        const novoLeft = inicioLeft + (e.clientX - origemX)
        wrapper.style.top  = novoTop  + 'px'
        wrapper.style.left = novoLeft + 'px'
    })

    document.addEventListener('mouseup', async () => {
        if (!arrastando) return
        arrastando         = false
        barra.style.cursor = 'grab'
        const top  = parseInt(wrapper.style.top)
        const left = parseInt(wrapper.style.left)
        await armazenar({[CHAVE]:{top: top, left: left}})
    })

    // ── inserção ──────────────────────────────────────────────
    if (ancestral) {
        _ui_inserir(wrapper, ancestral)
    } else {
        document.body.appendChild(wrapper)
    }

    // ── re-clamp em resize da janela ────────────────────────────
    window.addEventListener('resize', () => {
        const topAtual  = parseInt(wrapper.style.top)  || 0
        const leftAtual = parseInt(wrapper.style.left) || 0

        const novaPosicao = _clampPosicaoWidget({ top: topAtual, left: leftAtual })

        if (novaPosicao.top !== topAtual || novaPosicao.left !== leftAtual) {
            wrapper.style.top  = novaPosicao.top  + 'px'
            wrapper.style.left = novaPosicao.left + 'px'
            armazenar({ [CHAVE]: novaPosicao })
        }
    })

    return wrapper
}

// ── criaTitulo ────────────────────────────────────────────────
//
// Texto de título (h2 visual). Linha azul à esquerda.
//
// criaTitulo({ id, texto, ancestral })

function criaTitulo({ id, texto, ancestral }) {
    const el = _ui_el('div', {
        fontSize:    '13px',
        fontWeight:  '700',
        color:       UI_CORES.azul,
        borderLeft:  '3px solid ' + UI_CORES.azul,
        paddingLeft: '8px',
        marginBottom:'4px',
        fontFamily:  "'Segoe UI', system-ui, sans-serif",
    })
    el.id          = id
    el.textContent = texto
    _ui_inserir(el, ancestral)
    return el
}


// ── criaSubTitulo ─────────────────────────────────────────────
//
// Texto de subtítulo menor, cor suave.
//
// criaSubTitulo({ id, texto, ancestral })

function criaSubTitulo({ id, texto, ancestral }) {
    const el = _ui_el('div', {
        fontSize:   '11px',
        fontWeight: '600',
        color:      UI_CORES.suave,
        marginBottom:'2px',
        marginLeft: '8px',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    })
    el.id          = id
    el.textContent = texto
    _ui_inserir(el, ancestral)
    return el
}


// ── criaTexto ─────────────────────────────────────────────────
//
// Parágrafo de texto simples.
//
// criaTexto({ id, texto, ancestral })

function criaTexto({ id, texto, ancestral }) {
    const el = _ui_el('div', {
        fontSize:   '12px',
        color:      UI_CORES.texto,
        paddingLeft: '8px',
        marginRight:'8px',
        lineHeight: '1.5',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        whiteSpace: 'pre-wrap',
    })
    el.id          = id
    el.textContent = texto
    _ui_inserir(el, ancestral)
    return el
}


// ── criaBotaoAzul ─────────────────────────────────────────────
//
// Botão azul primário. Clique chama acao().
//
// criaBotaoAzul({ id, texto, ancestral, acao })

function criaBotaoAzul({ id, texto = 'OK', ancestral, acao }) {
    const btn = _ui_el('button', _ui_estiloBotao(UI_CORES.azul, UI_CORES.azulHover))
    btn.id          = id
    btn.textContent = texto
    _ui_hoverBotao(btn, UI_CORES.azul, UI_CORES.azulHover)
    if (typeof acao === 'function') btn.addEventListener('click', acao)
    if (ancestral) _ui_inserir(btn, ancestral)
    return btn
}


// ── criaBotaoLaranja ──────────────────────────────────────────
//
// Botão laranja de ação secundária. Clique chama acao().
//
// criaBotaoLaranja({ id, texto, ancestral, acao })

function criaBotaoLaranja({ id, texto = 'OK', ancestral, acao }) {
    const btn = _ui_el('button', _ui_estiloBotao(UI_CORES.laranja, UI_CORES.laranjaHover))
    btn.id          = id
    btn.textContent = texto
    _ui_hoverBotao(btn, UI_CORES.laranja, UI_CORES.laranjaHover)
    if (typeof acao === 'function') btn.addEventListener('click', acao)
    _ui_inserir(btn, ancestral)
    return btn
}


// ── criaBotaoAzulComCheckBox ──────────────────────────────────
//
// Botão azul com checkbox à direita.
// Clicar no botão → executa acao() diretamente.
// O checkbox é lido pelo EXECUTAR da criaDivExecucao.
//
// Layout:
//   [ Texto do botão              ✓ ]
//
// criaBotaoAzulComCheckBox({ id, idCheckbox, texto, ancestral, acao })

function criaBotaoAzulComCheckBox({ id, idCheckbox, texto = 'OK', ancestral, acao, grupo}) {
    return _ui_botaoComCheckBox({
        id, idCheckbox, texto, ancestral, acao, grupo, 
        cor: UI_CORES.azul, corHover: UI_CORES.azulHover,
    })
}


// ── criaBotaoLaranjaComCheckBox ───────────────────────────────
//
// Igual ao azul mas na cor laranja.
//
// criaBotaoLaranjaComCheckBox({ id, idCheckbox, texto, ancestral, acao })

function criaBotaoLaranjaComCheckBox({ id, idCheckbox, texto = 'OK', ancestral, acao, grupo }) {
    return _ui_botaoComCheckBox({
        id, idCheckbox, texto, ancestral, acao, grupo,
        cor: UI_CORES.laranja, corHover: UI_CORES.laranjaHover,
    })
}

// Implementação compartilhada dos botões com checkbox
function _ui_botaoComCheckBox({ id, idCheckbox, texto, ancestral, acao, cor, corHover, grupo }) {
    // Container linha
    const linha = _ui_el('div', {
        display:     'flex',
        alignItems:  'center',
        gap:         '6px',
        marginBottom:'4px',
    })
    linha.id = id + '-linha'

    // Botão
    const btn = _ui_el('button', {
        ..._ui_estiloBotao(cor, corHover),
        flex:   '1',
        width:  'auto',
        display:'block',
    })
    btn.id          = id
    btn.textContent = texto
    _ui_hoverBotao(btn, cor, corHover)
    if (typeof acao === 'function') btn.addEventListener('click', acao)

    // Checkbox visual
    const chk = _ui_el('div', {
        width:          '18px',
        height:         '18px',
        flexShrink:     '0',
        border:         '2px solid ' + UI_CORES.borda,
        borderRadius:   '4px',
        background:     UI_CORES.branco,
        cursor:         'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        transition:     'all 0.15s',
        fontSize:       '12px',
    })
    chk.id              = idCheckbox
    chk.dataset.marcado = '0'
    if (grupo) chk.dataset.grupo = grupo

    // Função de desmarcar exposta no elemento
    chk.desmarcar = () => {
        chk.dataset.marcado  = '0'
        chk.style.background = UI_CORES.branco
        chk.style.borderColor= UI_CORES.borda
        chk.textContent      = ''
    }

    chk.addEventListener('click', () => {
        if (chk.dataset.marcado === '1') {
            chk.desmarcar()
        } else {
            // Marca este
            chk.dataset.marcado  = '1'
            chk.style.background = cor
            chk.style.borderColor= cor
            chk.textContent      = '✓'
            chk.style.color      = '#ffffff'

            // Desmarca os demais do mesmo grupo
            if (grupo) {
                document.querySelectorAll(`[data-grupo="${grupo}"]`).forEach(outro => {
                    if (outro !== chk && typeof outro.desmarcar === 'function') {
                        outro.desmarcar()
                    }
                })
            }
        }
    })

    linha.appendChild(btn)
    linha.appendChild(chk)
    _ui_inserir(linha, ancestral)
    return linha
}


// ── criaMenuSuspenso ─────────────────────────────────────────
//
// Menu suspenso (dropdown) com a mesma aparência dos botões —
// mesmo formato, fonte e cor — com uma seta na direita indicando
// abrir/fechar.
//
// O elemento retornado se comporta como um <select> nativo: tem
// `.value` com o valor selecionado, e dispara um evento 'change'
// sempre que o usuário escolhe uma opção. Dá pra reagir tanto pelo
// callback `acao` quanto por addEventListener, como preferir:
//
//   const menu = criaMenuSuspenso({
//       id:       'meu-menu',
//       opcoes:   [
//           { valor: 'a', texto: 'Opção A' },
//           { valor: 'b', texto: 'Opção B' },
//       ],
//       valorInicial: 'a',
//       ancestral:    'meu-container',
//       acao: (valor, opcao) => console.log('mudou para', valor),
//   })
//
//   // alternativa via eventlistener (equivalente ao 'acao' acima) —
//   // útil se você for adicionar o listener em outro lugar do código:
//   document.getElementById('meu-menu').addEventListener('change', (e) => {
//       console.log('mudou para', e.detail.valor, e.detail.opcao)
//   })
//
//   // e a qualquer momento dá pra ler ou setar o valor atual:
//   document.getElementById('meu-menu').value = 'b'
//
// criaMenuSuspenso({ id, opcoes, valorInicial, ancestral, cor, acao })
//   opcoes:       array de { valor, texto } — ou strings simples (valor = texto)
//   valorInicial: opcional — padrão é a primeira opção
//   cor:          'azul' (padrão) | 'laranja' | '#hexadecimal' customizado
//   acao:         opcional — function(valor, opcao) chamada na troca

function _ui_resolveCor(cor) {
    if (cor === 'laranja')          return { cor: UI_CORES.laranja, corHover: UI_CORES.laranjaHover }
    if (cor === 'azul' || !cor)     return { cor: UI_CORES.azul,    corHover: UI_CORES.azulHover }
    return { cor: cor, corHover: _ui_escurecerHex(cor, 15) } // hex customizado
}

// Escurece uma cor hex em X% — usada para gerar o hover de cores customizadas
function _ui_escurecerHex(hex, porcentagem) {
    hex = hex.replace('#', '')
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
    const num   = parseInt(hex, 16)
    const fator = 1 - porcentagem / 100
    const r = Math.max(0, Math.min(255, Math.floor(((num >> 16) & 0xff) * fator)))
    const g = Math.max(0, Math.min(255, Math.floor(((num >> 8)  & 0xff) * fator)))
    const b = Math.max(0, Math.min(255, Math.floor(( num        & 0xff) * fator)))
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function criaMenuSuspenso({ id, opcoes = [], valorInicial, ancestral, cor = 'azul', acao }) {
    const { cor: corBase, corHover } = _ui_resolveCor(cor)

    const opcoesNormalizadas = opcoes.map(o =>
        typeof o === 'string' ? { valor: o, texto: o } : o
    )

    // ── container (posição relativa — ancora a lista) ──────────
    const container = _ui_el('div', {
        position:    'relative',
        marginLeft:  '3px',
        marginRight: '3px',
    })
    container.id = id

    // ── "botão" visível (mesma cara dos demais botões) ─────────
    const botao = _ui_el('div', {
        ..._ui_estiloBotao(corBase, corHover),
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginLeft:     '0',
        marginRight:    '0',
        userSelect:     'none',
    })
    botao.tabIndex = 0

    const textoSpan = _ui_el('span', {
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
    })
    textoSpan.id = id + '-texto'

    const seta = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    seta.setAttribute('viewBox', '0 0 10 6')
    seta.setAttribute('width', '10')
    seta.setAttribute('height', '6')
    seta.style.marginLeft = '8px'
    seta.style.flexShrink = '0'
    seta.style.transition = 'transform 0.15s'
    seta.innerHTML = '<path d="M0 0 L5 6 L10 0 Z" fill="#ffffff"></path>'

    botao.appendChild(textoSpan)
    botao.appendChild(seta)
    _ui_hoverBotao(botao, corBase, corHover)

    // ── lista de opções (oculta por padrão) ─────────────────────
    const lista = _ui_el('div', {
        position:     'absolute',
        top:          'calc(100% + 4px)',
        left:         '0',
        right:        '0',
        background:   UI_CORES.branco,
        border:       '1px solid ' + UI_CORES.borda,
        borderRadius: '6px',
        boxShadow:    '0 4px 12px rgba(0,0,0,0.15)',
        maxHeight:    '200px',
        overflowY:    'auto',
        zIndex:       String((typeof ROTA_Z !== 'undefined' ? (ROTA_Z.flutuante ?? 9000) : 9000) + 1),
        display:      'none',
    })
    lista.id = id + '-lista'

    let valorAtual = valorInicial ?? opcoesNormalizadas[0]?.valor

    function _renderTexto() {
        const op = opcoesNormalizadas.find(o => o.valor === valorAtual)
        textoSpan.textContent = op ? op.texto : ''
    }

    function _fechar() {
        lista.style.display  = 'none'
        seta.style.transform = 'rotate(0deg)'
    }

    function _abrir() {
        lista.style.display  = 'block'
        seta.style.transform = 'rotate(180deg)'
    }

    opcoesNormalizadas.forEach(op => {
        const item = _ui_el('div', {
            padding:    '7px 12px',
            fontSize:   '12px',
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            color:      UI_CORES.texto,
            cursor:     'pointer',
        })
        item.textContent = op.texto
        item.addEventListener('mouseenter', () => item.style.background = UI_CORES.fundo)
        item.addEventListener('mouseleave', () => item.style.background = 'transparent')
        item.addEventListener('click', () => {
            valorAtual = op.valor
            _renderTexto()
            _fechar()
            // dispara 'change' como um <select> nativo faria
            container.dispatchEvent(new CustomEvent('change', { detail: { valor: valorAtual, opcao: op } }))
            if (typeof acao === 'function') acao(valorAtual, op)
        })
        lista.appendChild(item)
    })

    botao.addEventListener('click', (e) => {
        e.stopPropagation()
        lista.style.display === 'none' ? _abrir() : _fechar()
    })

    // fecha ao clicar fora do menu
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) _fechar()
    })

    // acessibilidade básica: Enter/Espaço abre-fecha, Esc fecha
    botao.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            lista.style.display === 'none' ? _abrir() : _fechar()
        }
        if (e.key === 'Escape') _fechar()
    })

    // ── expõe .value, como um <select> nativo ────────────────────
    Object.defineProperty(container, 'value', {
        get: () => valorAtual,
        set: (novoValor) => {
            valorAtual = novoValor
            _renderTexto()
        },
    })

    _renderTexto()
    container.appendChild(botao)
    container.appendChild(lista)
    _ui_inserir(container, ancestral)
    return container
}


// ── criaBotaoComInputAzul ─────────────────────────────────────
//
// Input de texto com botão azul abaixo.
//
// Layout:
//   textoEmCima (label, opcional)
//   ┌─────────────┐
//   │    INPUT    │
//   ├─────────────┤
//   │    BOTÃO    │
//   └─────────────┘
//
// criaBotaoComInputAzul({ id, idInput, texto, textoEmCima, ancestral, acao })

function criaBotaoComInputAzul({ id, idInput, texto = 'OK', textoEmCima = '', ancestral, acao }) {
    return _ui_botaoComInput({
        id, idInput, texto, textoEmCima, ancestral, acao,
        cor: UI_CORES.azul, corHover: UI_CORES.azulHover,
    })
}


// ── criaBotaoComInputLaranja ──────────────────────────────────
//
// Igual ao azul mas na cor laranja.
//
// criaBotaoComInputLaranja({ id, idInput, texto, textoEmCima, ancestral, acao })

function criaBotaoComInputLaranja({ id, idInput, texto = 'OK', textoEmCima = '', ancestral, acao }) {
    return _ui_botaoComInput({
        id, idInput, texto, textoEmCima, ancestral, acao,
        cor: UI_CORES.laranja, corHover: UI_CORES.laranjaHover,
    })
}

function _ui_botaoComInput({ id, idInput, texto, textoEmCima, ancestral, acao, cor, corHover }) {
    const container = _ui_el('div', {
        display:       'flex',
        flexDirection: 'column',
        gap:           '0',
        marginBottom:  '6px',
        marginLeft:     '4px',
        marginRight:    '6px',
    })
    container.id = id + '-container'

    // Label acima (opcional)
    if (textoEmCima) {
        const label = _ui_el('div', {
            fontSize:     '11px',
            color:        UI_CORES.suave,
            marginBottom: '3px',
            fontFamily:   "'Segoe UI', system-ui, sans-serif",
            marginLeft:     '4px',
            marginRight:    '6px',
        })
        label.textContent = textoEmCima
        container.appendChild(label)
    }

    // Input
    const input = _ui_el('input', {
        width:        '100%',
        border:       '1px solid ' + UI_CORES.borda,
        borderBottom: 'none',
        borderRadius: '6px 6px 0 0',
        padding:      '7px 10px',
        fontSize:     '12px',
        fontFamily:   "'Segoe UI', system-ui, sans-serif",
        color:        UI_CORES.texto,
        background:   UI_CORES.branco,
        outline:      'none',
        boxSizing:    'border-box',
        marginLeft:     '4px',
        marginRight:    '6px',
    })
    input.id   = idInput
    input.type = 'text'

    // Botão
    const btn = _ui_el('button', {
        ..._ui_estiloBotao(cor, corHover),
        borderRadius: '0 0 6px 6px',
        marginTop:    '0',
    })
    btn.id          = id
    btn.textContent = texto
    _ui_hoverBotao(btn, cor, corHover)
    if (typeof acao === 'function') btn.addEventListener('click', acao)

    container.appendChild(input)
    container.appendChild(btn)
    _ui_inserir(container, ancestral)
    return container
}


// ── criaInput ─────────────────────────────────────────────────
//
// Campo de texto simples com label acima.
//
// criaInput({ id, textoEmCima, ancestral, placeholder })

function criaInput({ id, textoEmCima = '', ancestral, placeholder = '' }) {
    const container = _ui_el('div', {
        display:       'flex',
        flexDirection: 'column',
        gap:           '3px',
        marginBottom:  '6px',
    })
    container.id = id + '-container'

    if (textoEmCima) {
        const label = _ui_el('div', {
            fontSize:  '11px',
            color:     UI_CORES.suave,
            fontFamily:"'Segoe UI', system-ui, sans-serif",
        })
        label.textContent = textoEmCima
        container.appendChild(label)
    }

    const input = _ui_el('input', {
        width:        '100%',
        border:       '1px solid ' + UI_CORES.borda,
        borderRadius: '6px',
        padding:      '7px 10px',
        fontSize:     '12px',
        fontFamily:   "'Segoe UI', system-ui, sans-serif",
        color:        UI_CORES.texto,
        background:   UI_CORES.branco,
        outline:      'none',
        boxSizing:    'border-box',
    })
    input.id          = id
    input.type        = 'text'
    input.placeholder = placeholder
    input.container = container
    

    container.appendChild(input)
    _ui_inserir(container, ancestral)
    return input
}

function criaInputAnotacao({ id, textoEmCima = '', ancestral, placeholder = '' }) {
    const container = _ui_el('div', {
        display:       'flex',
        padding: '8px',
        flexDirection: 'column',
        gap:           '3px',
        marginBottom:  '6px',
    })
    container.id = id + '-container'

    if (textoEmCima) {
        const label = _ui_el('div', {
            fontSize:  '11px',
            color:     UI_CORES.suave,
            fontFamily:"'Segoe UI', system-ui, sans-serif",
        })
        label.textContent = textoEmCima
        container.appendChild(label)
    }

    const textarea = _ui_el('textarea', {
        width:        '100%',
        border:       '1px solid ' + UI_CORES.borda,
        borderRadius: '6px',
        padding:      '7px 10px',
        fontSize:     '12px',
        fontFamily:   "'Segoe UI', system-ui, sans-serif",
        color:        UI_CORES.texto,
        background:   UI_CORES.branco,
        outline:      'none',
        boxSizing:    'border-box',
        resize:       'none',       // não redimensiona manualmente
        overflow:     'hidden',     // esconde scrollbar enquanto cresce
        minHeight:    '34px',
        lineHeight:   '1.5',
    })
    textarea.id          = id
    textarea.placeholder = placeholder

    // Cresce conforme o conteúdo
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto'
        textarea.style.height = textarea.scrollHeight + 'px'
    })

    container.textarea = textarea

    container.appendChild(textarea)
    _ui_inserir(container, ancestral)
    return container
}
// ── criaCheckBox ──────────────────────────────────────────────
//
// Checkbox com texto ao lado direito.
//
// Layout:  [✓] Texto ao lado
//
// criaCheckBox({ id, textoAoLado, ancestral })

function criaCheckBox({ id, textoAoLado = '', ancestral }) {
    const linha = _ui_el('div', {
        display:    'flex',
        alignItems: 'center',
        gap:        '8px',
        cursor:     'pointer',
        marginBottom:'4px',
    })
    linha.id = id

    const chk = _ui_el('div', {
        width:          '16px',
        height:         '16px',
        flexShrink:     '0',
        border:         '2px solid ' + UI_CORES.borda,
        borderRadius:   '4px',
        background:     UI_CORES.branco,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        transition:     'all 0.15s',
        fontSize:       '11px',
    })
    chk.id              = id + '-caixa'
    linha.dataset.marcado = '0'

    const label = _ui_el('span', {
        fontSize:  '12px',
        color:     UI_CORES.texto,
        fontFamily:"'Segoe UI', system-ui, sans-serif",
        userSelect:'none',
    })
    label.textContent = textoAoLado

    function alternar() {
        if (linha.dataset.marcado === '1') {
            linha.dataset.marcado  = '0'
            chk.style.background = UI_CORES.branco
            chk.style.borderColor= UI_CORES.borda
            chk.textContent      = ''
        } else {
            linha.dataset.marcado  = '1'
            chk.style.background = UI_CORES.azul
            chk.style.borderColor= UI_CORES.azul
            chk.textContent      = '✓'
            chk.style.color      = '#ffffff'
        }
    }

    linha.addEventListener('click', alternar)

    linha.appendChild(chk)
    linha.appendChild(label)
    _ui_inserir(linha, ancestral)
    return linha
}


// ── criaTabela ────────────────────────────────────────────────
//
// Tabela com colunas identificadas por id.
// As colunas são criadas pelo array idDasColunas.
// O rótulo de cada coluna é opcional — se não passar 'colunas',
// usa os próprios ids como cabeçalho.
// Linhas são adicionadas depois via ui_adicionarLinhaTabela().
//
// criaTabela({ id, idDasColunas, colunas, ancestral })
//   idDasColunas: ['col-nome', 'col-cpf', 'col-acao']
//   colunas:      ['Nome', 'CPF', 'Ação']  ← opcional

function criaGrade({ id, ancestral, numeroColunas, larguraColunas = {} }) {
    const colunasCss = Array.from({ length: numeroColunas }, (_, i) => {
        const chave = 'coluna' + i
        return larguraColunas[chave] || `${100 / numeroColunas}%`
    }).join(' ')

    const grade = _ui_el('div', {
        display:             'grid',
        gridTemplateColumns: colunasCss,
        marginBottom:        '2px',
        marginRight: '6px',
        gap: '4px'
    })
    grade.id = id
    _ui_inserir(grade, ancestral)
    return grade
}

function criaTabela({ id, idDasColunas = [], colunas, ancestral, semDivisao = false }) {
    const wrapper = _ui_el('div', {
        overflowX:    'auto',
        marginBottom: '8px',
        borderRadius: '6px',
        border:       '1px solid ' + UI_CORES.borda,
    })
    wrapper.id = id + '-wrapper'
    const tabela = _ui_el('table', {
        width:          '100%',
        borderCollapse: 'collapse',
        fontSize:       '12px',
        fontFamily:     "'Segoe UI', system-ui, sans-serif",
        color:          UI_CORES.texto,
    })
    tabela.id = id

    if (colunas) {
        const thead = document.createElement('thead')
        const trH   = document.createElement('tr')
        idDasColunas.forEach((colId, i) => {
            const th = _ui_el('th', {
                padding:     '7px 10px',
                textAlign:   'left',
                background:  UI_CORES.azul,
                color:       '#ffffff',
                fontWeight:  '700',
                whiteSpace:  'nowrap',
                width:       `${Math.floor(100 / idDasColunas.length)}%`,
                borderRight: (!semDivisao && i < idDasColunas.length - 1)
                    ? '1px solid rgba(255,255,255,0.2)'
                    : 'none',
            })
            th.id          = colId
            th.textContent = colunas[i] || colId
            trH.appendChild(th)
        })
        thead.appendChild(trH)
        tabela.appendChild(thead)
    }

    const tbody = document.createElement('tbody')
    tbody.id = id + '-corpo'
    tbody.dataset.semDivisao  = semDivisao ? '1' : '0'
    tbody.dataset.idDasColunas = JSON.stringify(idDasColunas)  // ← guarda para uso sem cabeçalho
    tabela.appendChild(tbody)
    wrapper.appendChild(tabela)
    _ui_inserir(wrapper, ancestral)
    return wrapper
}



function ui_adicionarLinhaTabela(idTabela, valores = {}) {
    const tbody = document.getElementById(idTabela + '-corpo')
    if (!tbody) { console.warn('[ui.js] tabela não encontrada:', idTabela); return null }
    const semDivisao   = tbody.dataset.semDivisao === '1'

    // Tenta usar thead th; se não houver cabeçalho, usa idDasColunas do dataset
    const tabela       = document.getElementById(idTabela)
    const ths          = tabela?.querySelectorAll('thead th') || []
    const colunas      = ths.length > 0
        ? Array.from(ths).map(th => ({ id: th.id }))
        : JSON.parse(tbody.dataset.idDasColunas || '[]').map(colId => ({ id: colId }))

    const tr  = document.createElement('tr')
    const idx = tbody.children.length
    tr.style.background = idx % 2 === 0 ? UI_CORES.branco : UI_CORES.fundo

    colunas.forEach(({ id: colId }, i) => {
        const td = _ui_el('td', {
            padding:      '6px 10px',
            borderTop:    '1px solid ' + UI_CORES.borda,
            borderRight:  (!semDivisao && i < colunas.length - 1)
                ? '1px solid ' + UI_CORES.borda
                : 'none',
            verticalAlign: 'middle',
            width:         `${Math.floor(100 / colunas.length)}%`,
            textAlign: 'center'
        })
        const valor = valores[colId]
        if (valor instanceof HTMLElement) {
            td.appendChild(valor)
        } else {
            td.textContent = valor ?? ''
        }
        tr.appendChild(td)
    })
    tbody.appendChild(tr)
    return tr
}


// ── criaDivExecucao ───────────────────────────────────────────
//
// Div com duas colunas:
//   - idColuna (esquerda): o roteiro coloca qualquer coisa aqui
//   - idBotaoExecutar (direita): botão EXECUTAR fixo
//
// Layout:
//   ┌──────────────────────┬──────────┐
//   │ idColuna             │ EXECUTAR │
//   └──────────────────────┴──────────┘
//
// criaDivExecucao({ id, idColuna, idBotaoExecutar, acaoBotaoExecutar, ancestral })

function criaDivExecucao({ id, idColuna, idBotaoExecutar, acaoBotaoExecutar, ancestral }) {
    const container = _ui_el('div', {
        display:     'flex',
        gap:         '8px',
        alignItems:  'flex-start',
        marginBottom:'8px',
        marginLeft:  '4px',
        marginRight: '6px',
        borderRadius:'6px',
        background:  UI_CORES.fundo,
        border:      '1px solid ' + UI_CORES.borda,
        borderRadius:'6px',
        padding:     '8px',
    })
    container.id = id

    // Coluna esquerda — livre para o roteiro
    const coluna = _ui_el('div', {
        flex:          '1',
        display:       'flex',
        flexDirection: 'column',
        gap:           '6px',
        minWidth:      '0',
    })
    coluna.id = idColuna

    // Botão EXECUTAR — fixo à direita
    const btn = _ui_el('button', {
        ..._ui_estiloBotao(UI_CORES.laranja, UI_CORES.laranjaHover),
        width:     'auto',
        flexShrink:'0',
        padding:   '8px 14px',
        alignSelf: 'stretch',  // ocupa a altura da coluna esquerda
        writingMode: 'vertical-rl',
        fontSize:     '12px',
    })
    btn.id          = idBotaoExecutar
    btn.textContent = 'Executar todos ➡️'
    
    _ui_hoverBotao(btn, UI_CORES.laranja, UI_CORES.laranjaHover)
    if (typeof acaoBotaoExecutar === 'function') {
        btn.addEventListener('click', acaoBotaoExecutar)
    }

    container.appendChild(coluna)
    container.appendChild(btn)
    _ui_inserir(container, ancestral)
    return container
}


// ── criaTextoQueAbrePassandoOMouse ────────────────────────────
//
// Texto/rótulo que, ao passar o mouse, exibe um box com conteúdo.
// Equivalente ao antigo infoPJE.
//
// corDoBox: 'azul' | 'laranja' | 'verde' | 'vermelho'
//
// criaTextoQueAbrePassandoOMouse({ id, texto, ancestral, corDoBox })
function criaTextoQueAbrePassandoOMouse({ id, texto = '📋 Passe o mouse', ancestral, corDoBox = 'azul', textoBox = '' }) {
    const CORES_BOX = {
        azul:     { bg: '#e3f2fd', borda: UI_CORES.azul    },
        laranja:  { bg: '#fff3e0', borda: UI_CORES.laranja  },
        verde:    { bg: '#e8f5e9', borda: '#2e7d32'         },
        vermelho: { bg: '#fdecea', borda: UI_CORES.erro     },
    }
    const cor = CORES_BOX[corDoBox] || CORES_BOX.azul

    let fixado = false  // ← estado que persiste no closure

    const wrapper = _ui_el('div', { position: 'relative', marginBottom: '4px' })
    wrapper.id = id + '-wrapper'
    
    const rotulo = _ui_el('div', {
        fontSize: '12px', color: UI_CORES.azul, cursor: 'pointer',
        fontFamily: "'Segoe UI', system-ui, sans-serif", userSelect: 'none',
        display: 'inline-block', borderBottom: '1px dashed ' + UI_CORES.azul,
        paddingBottom: '1px', paddingLeft: '8px', whiteSpace: 'pre-wrap',
    })
    rotulo.id = id
    rotulo.textContent = texto

    const box = _ui_el('div', {
        display: 'none', position: 'absolute', top: 'calc(100% + 4px)', left: '0',
        zIndex: '9999', background: cor.bg, border: '1px solid ' + cor.borda,
        borderRadius: '6px', padding: '10px 12px', fontSize: '12px',
        color: UI_CORES.texto, fontFamily: "'Segoe UI', system-ui, sans-serif",
        lineHeight: '1.5', whiteSpace: 'pre-wrap', maxWidth: parseInt(window.innerWidth * 0.97) + 'px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: '180px',
        textAlign: 'justify',
        cursor: 'pointer',
    })
    box.id = id + '-box'
    box.textContent = textoBox

    // Enquanto o box está visível, libera o overflow de qualquer ancestral
    // marcado como '.ui-clip-liberavel' — o corpo recolhível de uma
    // await criaSecaoMostraRecolhe, o wrapper externo dela (que corta cantos
    // arredondados), ou o corpo scrollável de um criaDivFlutuante — pra
    // nenhum deles recortar o box. Guarda os valores originais em dataset
    // e restaura ao fechar. Assim o box continua filho do wrapper (rola e
    // se comporta como qualquer elemento normal da página), sem cálculo
    // de posição manual.
    function _ajustarOverflowAncestrais(mostrar) {
        let el = wrapper.parentElement
        while (el) {
            if (el.classList && el.classList.contains('ui-clip-liberavel')) {
                if (mostrar) {
                    if (el.dataset.uiOverflowOriginal === undefined) {
                        el.dataset.uiOverflowOriginal  = el.style.overflow  || ''
                        el.dataset.uiOverflowYOriginal = el.style.overflowY || ''
                    }
                    el.style.overflow  = 'visible'
                    el.style.overflowY = 'visible'
                } else if (el.dataset.uiOverflowOriginal !== undefined) {
                    el.style.overflow  = el.dataset.uiOverflowOriginal
                    el.style.overflowY = el.dataset.uiOverflowYOriginal
                    delete el.dataset.uiOverflowOriginal
                    delete el.dataset.uiOverflowYOriginal
                }
            }
            el = el.parentElement
        }
    }

    function _mostrarBox() {
        box.style.display = 'block'
        _ajustarOverflowAncestrais(true)
    }
    function _esconderBox() {
        box.style.display = 'none'
        _ajustarOverflowAncestrais(false)
    }

    // Hover: só age se não estiver fixado
    rotulo.addEventListener('mouseenter', () => {
        if (!fixado) _mostrarBox()
    })
    rotulo.addEventListener('mouseleave', () => {
        if (!fixado) setTimeout(() => { if (!box.matches(':hover')) _esconderBox() }, 100)
    })
    box.addEventListener('mouseleave', () => {
        if (!fixado) _esconderBox()
    })

    // Clique no rótulo: alterna fixação
    rotulo.addEventListener('click', () => {
        fixado = !fixado
        if (fixado) _mostrarBox(); else _esconderBox()
        rotulo.style.fontWeight = fixado ? 'bold' : 'normal'  // feedback visual opcional
        rotulo.textContent = texto + (fixado ? '▲' : '')  // seta para indicar fixação
    })

    // Clique no box enquanto fixado: desfixa e fecha
    box.addEventListener('click', () => {
        if (fixado) {
            fixado = false
            _esconderBox()
            rotulo.style.fontWeight = 'normal'
            rotulo.textContent = texto
        } else {
            fixado = true
            rotulo.style.fontWeight = 'bold'
            rotulo.textContent = texto + '▲'
        }
    })

    wrapper.appendChild(rotulo)
    wrapper.appendChild(box)
    _ui_inserir(wrapper, ancestral)

    wrapper.atualizarConteudo = (conteudo) => { box.textContent = conteudo }

    return wrapper
}


// ── criaBotaoProximoEEncerrar ─────────────────────────────────
//
// Par de botões Encerrar + Próximo lado a lado.
// Usados no rodapé do assistente e no widget das janelas filhas.
// Acionam rota_sinalizar() com a sessão atual.
//
// A sessao é lida do storage (rotaExecucaoAtual) no momento do clique.
//
// criaBotaoProximoEEncerrar({ id, ancestral })

function criaBotaoProximoEEncerrar({ id, ancestral }) {
    const linha = _ui_el('div', {
        display: 'flex',
        gap:     '6px',
    })
    linha.id = id

    const btnEncerrar = _ui_el('button', {
        ..._ui_estiloBotao(UI_CORES.fundo, '#ececec', UI_CORES.texto),
        flex:   '1',
        border: '1px solid ' + UI_CORES.borda,
        width:  'auto',
    })
    btnEncerrar.id          = id + '-encerrar'
    btnEncerrar.textContent = '■ Encerrar'
    btnEncerrar.addEventListener('mouseenter', () => btnEncerrar.style.background = '#ececec')
    btnEncerrar.addEventListener('mouseleave', () => btnEncerrar.style.background = UI_CORES.fundo)

    const btnProximo = _ui_el('button', {
        ..._ui_estiloBotao(UI_CORES.laranja, UI_CORES.laranjaHover),
        flex:  '1',
        width: 'auto',
    })
    btnProximo.id          = id + '-proximo'
    btnProximo.textContent = '▶ Próximo'
    _ui_hoverBotao(btnProximo, UI_CORES.laranja, UI_CORES.laranjaHover)

    // Lê a sessão no momento do clique para garantir o valor atual
    btnProximo.addEventListener('click', () => {
        comandar(['rota_proximo'], [{}])
    })

    btnEncerrar.addEventListener('click', () => {
        comandar(['rota_encerrar'], [{}])
        armazenar({ rotaAssistenteFechar: true })
    })
    linha.appendChild(btnEncerrar)
    linha.appendChild(btnProximo)
    _ui_inserir(linha, ancestral)
    return linha
}


// ── criarCarregando / removerCarregando ───────────────────────
//
// Exibe/remove um indicador de carregamento na área rolável.
// O elemento pai é 'rota_corpo' (área rolável do assistente).

const _UI_ID_CARREGANDO = 'rota-carregando'

function criarCarregando(ancestral = 'rota_corpo') {
    removerCarregando()

    const el = _ui_el('div', {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '10px',
        padding:        '32px 16px',
        color:          UI_CORES.suave,
        fontSize:       '12px',
        fontFamily:     "'Segoe UI', system-ui, sans-serif",
    })
    el.id = _UI_ID_CARREGANDO

    // Spinner CSS simples
    const spinner = _ui_el('div', {
        width:       '24px',
        height:      '24px',
        border:      '3px solid ' + UI_CORES.borda,
        borderTop:   '3px solid ' + UI_CORES.azul,
        borderRadius:'50%',
        animation:   'rota-spin 0.8s linear infinite',
    })

    // Injeta keyframe se ainda não existir
    if (!document.getElementById('rota-spin-style')) {
        const style = document.createElement('style')
        style.id = 'rota-spin-style'
        style.textContent = '@keyframes rota-spin { to { transform: rotate(360deg) } }'
        document.head.appendChild(style)
    }

    const msg = _ui_el('span', {})
    msg.textContent = 'Aguardando dados…'

    el.appendChild(spinner)
    el.appendChild(msg)
    _ui_inserir(el, ancestral)
    return el
}

function removerCarregando() {
    document.getElementById(_UI_ID_CARREGANDO)?.remove()
}


// ── ui_checkboxMarcado ────────────────────────────────────────
//
// Utilitário: retorna true se o checkbox com o id dado
// estiver marcado. Usado pelo roteiro para verificar
// o estado dos botões com checkbox.
//
// ui_checkboxMarcado('chk-reclamante')  →  true | false

function ui_checkboxMarcado(idCheckbox) {
    const el = document.getElementById(idCheckbox)
    return el?.dataset?.marcado === '1'
}

// ── criaPlaquinha ─────────────────────────────────────────────
//
// Plaquinha colorida para destacar informações.
// cor: 'azul' | 'laranja' | 'amarelo' | 'verde'
//
// criaPlaquinha({ id, texto, cor, ancestral })

function criaPlaquinha({ id, texto = '', cor = 'azul', ancestral }) {
    const CORES_PLAQUINHA = {
        azul:    { bg: '#90caf9' , borda: '#1e88e5', texto: '#03071e'},
        laranja: { bg: '#e65100' , borda: '#ffa726', texto: '#fff3e0'},
        vermelho:{ bg: '#780000' , borda: '#c1121f', texto: '#fdf0d5'},
        amarelo: { bg: '#ffd500' , borda: '#fdc500', texto: '#03071e'},
        verde:   { bg: '#386641' , borda: '#6a994e', texto: '#e8f5e9'},
    }
    const c = CORES_PLAQUINHA[cor] || CORES_PLAQUINHA.azul

    const el = _ui_el('span', {
        display:       'inline-block',
        background:    c.bg,
        border:        '1px solid ' + c.borda,
        borderRadius:  '4px',
        padding:       '2px 8px',
        fontSize:      '11px',
        fontWeight:    '700',
        color:         c.texto,
        fontFamily:    "'Segoe UI', system-ui, sans-serif",
        whiteSpace:    'normal',
        marginRight:   '4px',
        marginBottom:  '4px',
        letterSpacing: '0.02em',
    })
    el.id          = id
    el.textContent = texto
    if (ancestral) _ui_inserir(el, ancestral)
    return el
}


// ── criaPlaquinhaComTooltip ───────────────────────────────────
//
// Plaquinha colorida com tooltip ao passar o mouse.
// cor: 'azul' | 'laranja' | 'amarelo' | 'verde'
//
// criaPlaquinhaComTooltip({ id, texto, cor, tooltip, ancestral })

function criaPlaquinhaComTooltip({ id, texto = '', cor = 'azul', tooltip = '', ancestral }) {
    const CORES_PLAQUINHA = {
        azul:    { bg: '#90caf9', borda: '#1e88e5', texto: '#03071e' },
        laranja: { bg: '#e65100', borda: '#ffa726', texto: '#fff3e0' },
        vermelho:{ bg: '#780000', borda: '#c1121f', texto: '#fdf0d5' },
        amarelo: { bg: '#ffd500', borda: '#fdc500', texto: '#03071e' },
        verde:   { bg: '#386641', borda: '#6a994e', texto: '#e8f5e9' },
    }
    const c = CORES_PLAQUINHA[cor] || CORES_PLAQUINHA.azul

    const wrapper = _ui_el('span', {
        position:     'relative',
        display:      'inline-block',
        marginRight:  '4px',
        marginBottom: '4px',
    })
    wrapper.id = id + '-wrapper'

    const plaquinha = _ui_el('span', {
        display:       'inline-block',
        background:    c.bg,
        border:        '1px solid ' + c.borda,
        borderRadius:  '4px',
        padding:       '2px 8px',
        fontSize:      '11px',
        fontWeight:    '700',
        color:         c.texto,
        fontFamily:    "'Segoe UI', system-ui, sans-serif",
        whiteSpace:    'normal',
        letterSpacing: '0.02em',
        cursor:        'default',
    })
    plaquinha.id          = id
    plaquinha.textContent = texto

    const tip = _ui_el('div', {
        display:       'none',
        position:      'fixed',
        background:    '#000000',
        color:         '#ffffff',
        borderRadius:  '4px',
        padding:       '5px 10px',
        fontSize:      '11px',
        fontFamily:    "'Segoe UI', system-ui, sans-serif",
        whiteSpace:    'pre-wrap',
        maxWidth:      '240px',
        boxShadow:     '0 2px 8px rgba(0,0,0,0.15)',
        zIndex:        '99999999',
        pointerEvents: 'none',
        lineHeight:    '1.4',
    })
    tip.textContent = tooltip
    document.body.appendChild(tip)

    plaquinha.addEventListener('mouseenter', () => {
        const rect = plaquinha.getBoundingClientRect()
        tip.style.display = 'block'

        // Posição inicial: centralizado acima da plaquinha
        let left = rect.left + rect.width / 2 - tip.offsetWidth / 2
        let top  = rect.top - tip.offsetHeight - 4

        // Corrige se saiu pela direita
        if (left + tip.offsetWidth > window.innerWidth - 8) {
            left = window.innerWidth - tip.offsetWidth - 8
        }
        // Corrige se saiu pela esquerda
        if (left < 8) {
            left = 8
        }
        // Corrige se saiu pelo topo — mostra abaixo da plaquinha
        if (top < 8) {
            top = rect.bottom + 4
        }

        // Corrige se saiu por baixo (pode acontecer mesmo após a correção acima,
        // quando a plaquinha está perto do rodapé e o tooltip é alto)
        if (top + tip.offsetHeight > window.innerHeight - 8) {
            top = window.innerHeight - tip.offsetHeight - 8
        }

        // Última garantia: nunca deixa o topo negativo (tooltip maior que a viewport)
        if (top < 8) {
            top = 8
        }

        tip.style.left = left + 'px'
        tip.style.top  = top  + 'px'
    })
    plaquinha.addEventListener('mouseleave', () => tip.style.display = 'none')

    // Limpa o tip do body se o wrapper for removido do DOM
    const observer = new MutationObserver(() => {
        if (!document.body.contains(wrapper)) {
            tip.remove()
            observer.disconnect()
        }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    wrapper.appendChild(plaquinha)
    if (ancestral) _ui_inserir(wrapper, ancestral)
    wrapper.atualizarTooltip = (novoTexto) => { tip.textContent = novoTexto }
    return wrapper
}

// ── await criaSecaoMostraRecolhe ────────────────────────────────────
//
// Seção expansível com cabeçalho fixo e corpo recolhível.
// A setinha (▲/▼) no canto direito do cabeçalho alterna
// o estado. Começa expandida por padrão.
//
// O roteiro popula idSempreAMostra e idRecolhe com qualquer
// componente de ui.js após a chamada, usando-os como ancestral.
//
// await criaSecaoMostraRecolhe({ id, idSempreAMostra, idRecolhe, ancestral })

async function criaSecaoMostraRecolhe({ id, idSempreAMostra, idRecolhe, ancestral, armazenarExpandido = true }) {
    const wrapper = _ui_el('div', {
        border:       '1px solid ' + UI_CORES.borda,
        borderRadius: '6px',
        overflow:     'hidden',
        marginBottom: '8px',
        background:   UI_CORES.branco,
    })
    wrapper.id = id
    wrapper.classList.add('ui-clip-liberavel')

    const cabecalho = _ui_el('div', {
        display:    'flex',
        alignItems: 'center',
        padding:    '6px 8px 6px 0',
        cursor:     'pointer',
        userSelect: 'none',
        background: UI_CORES.branco,
        transition: 'background 0.15s',
    })
    cabecalho.addEventListener('mouseenter', () => cabecalho.style.background = UI_CORES.fundo)
    cabecalho.addEventListener('mouseleave', () => cabecalho.style.background = UI_CORES.branco)

    const areaFixa = _ui_el('div', { flex: '1' })
    areaFixa.id = idSempreAMostra

    const seta = _ui_el('div', {
        flexShrink:   '0',
        width:        '24px',
        textAlign:    'center',
        fontSize:     '10px',
        color:        UI_CORES.suave,
        fontFamily:   "'Segoe UI', system-ui, sans-serif",
        paddingRight: '4px',
        transition:   'transform 0.2s',
    })
    seta.textContent = '▲'

    cabecalho.appendChild(areaFixa)
    cabecalho.appendChild(seta)

    const corpo = _ui_el('div', {
        borderTop:  '1px solid ' + UI_CORES.borda,
        padding:    '6px 0 4px 0',
        overflow:   'hidden',
        transition: 'max-height 0.25s ease, opacity 0.2s ease',
        maxHeight:  '1000px',
        opacity:    '1',
    })
    corpo.id = idRecolhe
    corpo.classList.add('ui-clip-liberavel')

    // ── Estado e métodos expostos ─────────────────────────────
    let expandido = true
    if (armazenarExpandido){
        let label = id + 'estado'
        expandido = await obterArmazenamento([label]).then(d=> d[label])
    }
    wrapper.expandido  = expandido
    wrapper.aoAlternar = null   // roteiro pode atribuir: (expandido) => { ... }

    function _aplicar(expandido) {
        wrapper.expandido = expandido
        if (expandido) {
            corpo.style.maxHeight = '1000px'
            corpo.style.opacity   = '1'
            seta.textContent      = '▲'
        } else {
            corpo.style.maxHeight = '0'
            corpo.style.opacity   = '0'
            seta.textContent      = '▼'
        }
    }

    wrapper.expandir  = () => _aplicar(true)
    wrapper.recolher  = () => _aplicar(false)

    cabecalho.addEventListener('click', () => {
        _aplicar(!wrapper.expandido)
        if (typeof wrapper.aoAlternar === 'function') wrapper.aoAlternar(wrapper.expandido)
    })
    // ─────────────────────────────────────────────────────────

        wrapper.appendChild(cabecalho)
        wrapper.appendChild(corpo)
        _ui_inserir(wrapper, ancestral)

    _aplicar(expandido, true)   // sincroniza o visual com o estado guardado

        _aplicar(expandido, true)   // sincroniza o visual com o estado guardado
        return wrapper
}

function rota_avisoObrigatorio(msg = '', segundos = 60) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.45)',
      zIndex: String(ROTA_Z.aviso),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    })

    const caixa = document.createElement('div')
    Object.assign(caixa.style, {
      background: '#fff',
      borderLeft: '4px solid #ffa726',
      borderRadius: '8px', padding: '24px 28px',
      maxWidth: '420px', width: '90%',
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', gap: '12px',
      cursor: 'pointer',
    })

    const texto = document.createElement('div')
    Object.assign(texto.style, { fontSize: '14px', lineHeight: '1.5', color: '#2c3e50' })
    texto.textContent = msg

    const rodape = document.createElement('div')
    Object.assign(rodape.style, { fontSize: '12px', color: '#888', display: 'flex', justifyContent: 'space-between' })

    const instrucao = document.createElement('span')
    instrucao.textContent = 'Clique para fechar'

    const timer = document.createElement('span')
    timer.textContent = `Fechando em ${segundos}s`

    rodape.appendChild(instrucao)
    rodape.appendChild(timer)
    caixa.appendChild(texto)
    caixa.appendChild(rodape)
    overlay.appendChild(caixa)
    document.body.appendChild(overlay)

    const fechar = () => {
      clearInterval(intervalo)
      overlay.remove()
      resolve()
    }

    overlay.addEventListener('click', fechar)

    let restam = segundos
    const intervalo = setInterval(() => {
      restam--
      timer.textContent = `Fechando em ${restam}s`
      if (restam <= 0) fechar()
    }, 1000)
  })
}

/**
 * criaWidgetDocumentos
 *
 * Monta um widget de botões para navegar documentos de uma timeline.
 *
 * @param {object}   params
 * @param {string}   params.ancestral   - id do elemento pai onde o widget será montado
 * @param {Array}    params.documentos  - array da timeline já resolvida
 * @param {Array}    params.tipos       - array de { chave, label?, opcoes? }
 *                                        se label omitido, usa chave como label
 * @param {string}   params.idPrefixo  - prefixo para compor ids internos
 * @param {Function} params.onAbrir    - callback chamado com (documento) ao clicar
 * @param {boolean}  [params.laranja=false] - true = variantes laranja, false = variantes azul
 * @param {string}   [params.modo='tipo']  - 'tipo' | 'documento' | 'tipoComCheckBox' | 'documentoComCheckBox'
 */
async function criaWidgetDocumentos({ ancestral, documentos, tipos, idPrefixo, onAbrir, laranja = false, modo = 'tipo' }) {

    // --- estado encapsulado ---
    let ordemSalva = await obterArmazenamento('armazenarCriaWidgetDocumentos')
    ordem = ordemSalva?.[idPrefixo] ?? 1
    let contadoresDocumentos = {}

    // normaliza tipos: garante que label sempre existe
    let tiposNormalizados = tipos.map(t => ({
        chave:  t.chave,
        label:  t.label ?? t.chave,
        opcoes: t.opcoes ?? null,
    }))

    // --- factory de botão conforme laranja e modo ---
    function _criaBotao(params) {
        return laranja ? criaBotaoLaranja(params) : criaBotaoAzul(params)
    }

    function _criaBotaoComCheckBox(params) {
        return laranja ? criaBotaoLaranjaComCheckBox(params) : criaBotaoAzulComCheckBox(params)
    }

    // --- botão de ordem (só nos modos por tipo) ---
    function textoOrdem() {
        return ordem === 0 ? 'Ordem: do mais novo para o mais antigo' : 'Ordem: do mais antigo para o mais novo'
    }
    if (modo === 'tipo' || modo === 'tipoComCheckBox') {
        criaBotaoLaranja({
            id:        id(idPrefixo, 'botao_ordem_documentos'),
            texto:     textoOrdem(),
            ancestral: ancestral,
            acao: () => {
                ordem = ordem === 0 ? 1 : 0
                let botao = document.getElementById(id(idPrefixo, 'botao_ordem_documentos'))
                if (botao) botao.textContent = textoOrdem()
                armazenar({ armazenarCriaWidgetDocumentos: { [idPrefixo]: ordem } })
            }
        })
    }

    if (!documentos.length) return

    // --- despacha para o modo correto ---
    if (modo === 'tipo')                 _criaTabelaPorTipo(documentos, false)
    else if (modo === 'tipoComCheckBox') _criaTabelaPorTipo(documentos, true)
    else if (modo === 'documento')       _criaTabelaPorDocumento(documentos, false)
    else if (modo === 'documentoComCheckBox') _criaTabelaPorDocumento(documentos, true)

    // -------------------------------------------------------------------------
    // MODO tipo / tipoComCheckBox
    // -------------------------------------------------------------------------

    function _encontrarTipoNaTimeline(tipo, ondeBuscar) {
        const termos = tipo.opcoes ?? [tipo.chave]

        const bate = (titulo, tipoDoc) =>
            termos.some(termo =>
                normalizar(titulo).toLowerCase().includes(termo) ||
                normalizar(tipoDoc).toLowerCase().includes(termo)
            )

        const resultado = []

        for (const documento of ondeBuscar) {
            if (bate(documento?.titulo, documento?.tipo)) {
                resultado.push(documento)
            }
            for (const anexo of documento?.anexos ?? []) {
                if (bate(anexo?.titulo, anexo?.tipo)) {
                    resultado.push(anexo)
                }
            }
        }

        return resultado
    }

    function _criaTabelaPorTipo(docs, comCheckBox) {
        
        let documentosCriar = {}
        let elementos = 0

        for (let c of tiposNormalizados) {
            documentosCriar[c.chave] = _encontrarTipoNaTimeline(c, docs)
            if (documentosCriar[c.chave].length) elementos++
        }

        if (!elementos) return

        let colunas = elementos > 3 ? 3 : elementos
        let idGrade = id(idPrefixo, 'tabela')

        criaGrade({
            id:            idGrade,
            ancestral:     ancestral,
            numeroColunas: colunas
        })

        for (let [tipo, doc] of Object.entries(documentosCriar)) {

            if (!doc.length) continue

            let tipoDef = tiposNormalizados.find(t => t.chave === tipo || (t.opcoes && t.opcoes.includes(tipo)))
            if (!tipoDef) continue

            let chaveContador = id(idPrefixo, tipo)
            contadoresDocumentos[chaveContador] = { atual: 0, total: doc.length, primeiroClique: true }

            let idBotao    = id(idPrefixo, 'botao', tipo)
            let idCheckbox = id(idPrefixo, 'checkbox', tipo)
            let textoBotao = tipoDef.label + ' 0/' + doc.length

            let acaoBotao = async () => {
                let resultado = _avancarContadorDocumento(tipo)
                if (!resultado) return
                let { tipoContador, contador } = resultado
                await onAbrir(documentosCriar[tipoContador][contador])
            }

            comCheckBox
                ? _criaBotaoComCheckBox({ id: idBotao, idCheckbox, texto: textoBotao, acao: acaoBotao, ancestral: idGrade })
                : _criaBotao({ id: idBotao, texto: textoBotao, acao: acaoBotao, ancestral: idGrade })
        }
    }

    function _avancarContadorDocumento(tipo) {
        let chaveContador = id(idPrefixo, tipo)
        let contador = contadoresDocumentos[chaveContador]
        if (!contador) return null

        if (contador.primeiroClique) {
            contador.atual = ordem === 0 ? 0 : contador.total - 1
            contador.primeiroClique = false
        } else {
            if (ordem === 0) {
                contador.atual = (contador.atual + 1) % contador.total
            } else {
                contador.atual = (contador.atual - 1 + contador.total) % contador.total
            }
        }

        let idBotao = id(idPrefixo, 'botao', tipo)
        let botao = document.getElementById(idBotao)
        if (!botao) return null

        let tipoDef = tiposNormalizados.find(t => t.chave === tipo || (t.opcoes && t.opcoes.includes(tipo)))
        botao.textContent = tipoDef.label + ' ' + (contador.total - contador.atual) + '/' + contador.total

        
        return { tipoContador: tipo, contador: contador.atual }
    }

    // -------------------------------------------------------------------------
    // MODO documento / documentoComCheckBox
    // -------------------------------------------------------------------------

    function _criaTabelaPorDocumento(docs, comCheckBox) {
        
        let elementos = docs.length
        if (!elementos) return

        let colunas = elementos > 3 ? 3 : elementos
        let idGrade = id(idPrefixo, 'tabela')

        criaGrade({
            id:            idGrade,
            ancestral:     ancestral,
            numeroColunas: colunas
        })

        for (let documento of docs) {
            let docId     = documento.idUnicoDocumento
            let tipoDef   = tiposNormalizados.find(t =>
                t.chave === documento?.tipo ||
                (t.opcoes && t.opcoes.includes(documento?.tipo))
            )
            let labelTipo  = tipoDef?.label ?? documento?.tipo ?? documento?.titulo ?? docId
            let textoBotao = labelTipo + ' - ' + docId

            let idBotao    = id(idPrefixo, 'botao', docId)
            let idCheckbox = id(idPrefixo, 'checkbox', docId)

            let acaoBotao = async () => {
                await onAbrir(documento)
            }

            comCheckBox
                ? _criaBotaoComCheckBox({ id: idBotao, idCheckbox, texto: textoBotao, acao: acaoBotao, ancestral: idGrade })
                : _criaBotao({ id: idBotao, texto: textoBotao, acao: acaoBotao, ancestral: idGrade })
        }
    }
}