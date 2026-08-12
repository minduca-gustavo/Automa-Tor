// ============================================================
// auxiliares.js
// Utilitários de armazenamento, herdados do Rota PJE.
//
// NAVEGADOR resolve a diferença entre a API do Firefox (browser, com
// promessas) e a do Chrome (chrome, com callbacks). Sem esta linha o
// arquivo quebra com "NAVEGADOR is not defined".
// ============================================================

const NAVEGADOR = (typeof browser !== 'undefined') ? browser : chrome

function armazenar(chave){
	try{ return NAVEGADOR.storage.local.set(chave) }
	catch(e){ console.error('[RotaPJE] armazenar:', e); throw e }
}

async function obterArmazenamento(chave = null){
	try{ return await NAVEGADOR.storage.local.get(chave) }
	catch(e){ return chave === null ? {} : null }
}

async function removerArmazenamento(chave) {
    await NAVEGADOR.storage.local.remove(chave)
}