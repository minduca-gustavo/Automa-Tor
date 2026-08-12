// ============================================================
// principal.js
// Ponto de entrada do content script. Só amarra as peças; toda a
// lógica está no montador, no extrator e no painel.
// ============================================================

;(async function () {
    'use strict'

    // O montador é escrito como módulo universal: em content script ele se
    // registra em window.PjcMontador.
    if (typeof PjcMontador === 'undefined') {
        console.error('[pjc] montador não carregado')
        return
    }
    PjcMontador.configurarDom(new DOMParser(), new XMLSerializer())

    try {
        await pjcIniciarPainel()
    } catch (e) {
        console.error('[pjc] falha ao montar o painel:', e)
    }
})()
