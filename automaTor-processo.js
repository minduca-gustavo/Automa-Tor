// ============================================================
// automaTor-processo.js
//
// Dados do processo e das partes. Não vêm da sentença nem da tabela do
// calculista: vêm da consulta que a extensão faz no PJe. Ficam
// separados do Pedido de Lançamento porque têm outra origem e outro
// ciclo — a tabela diz QUANTO e DE QUANDO; o PJe diz QUEM e QUAL
// processo.
//
// O formato de saída é o bloco 'processo' que o lançador repassa à
// Ficha e o montador grava em <Processo>. Formatos conferidos no
// gabarito 1317502 (cálculo importado do PJe pelo próprio PJe-Calc):
//   - parte:     documento só com dígitos       25429746835
//   - advogado:  documento com máscara          469.673.818-30
//   - OAB:       UF + número, sem separador     SP501265
// ============================================================


// ── dadosProcessuais ──────────────────────────────────────────
//
// Recebe o que a busca no PJe devolveu e normaliza para o formato do
// PJe-Calc. Aceita datas em AAAA-MM-DD ou DD/MM/AAAA, valores em número
// ou "R$ 284.429,98", documentos com ou sem máscara.
//
// dadosProcessuais({
//     numeroProcesso:      '0011965-83.2025.5.15.0089',
//     reclamante:          { nome, documento },
//     reclamada:           { nome, documento },        // ou lista, se houver várias
//     autuacao:            '2025-11-13',
//     valorDaCausa:        284429.98,
//     advogadosReclamante: [{ nome, documento, oab }],
//     advogadosReclamada:  [{ nome, documento, oab }],
// })
// → { processo, erros, avisos }
//
// 'erros' não vazio: o número ou a autuação não servem, e o arquivo não
// deve ser montado. 'avisos': dado faltante que o PJe-Calc aceita vazio.

function dadosProcessuais(d) {
    d = d || {}
    const erros = [], avisos = []

    const numeroCNJ = _pjcp_cnj(d.numeroProcesso)
    if (!numeroCNJ) erros.push('numeroProcesso fora do padrão CNJ: "' + d.numeroProcesso + '"')

    const autuacao = _pjcp_data(d.autuacao)
    if (!autuacao) erros.push('autuacao ausente ou em formato desconhecido: "' + d.autuacao + '"')

    const valorDaCausa = _pjcp_valor(d.valorDaCausa)
    if (valorDaCausa == null) avisos.push('valorDaCausa não informado — vai vazio')

    // O PJe-Calc tem um único reclamante e um único reclamado no cálculo.
    // Com várias reclamadas, a primeira entra e as demais viram aviso:
    // o calculista decide no PJe-Calc como tratar a responsabilidade.
    const reclamadas = [].concat(d.reclamada || [])
    if (reclamadas.length > 1) {
        avisos.push('há ' + reclamadas.length + ' reclamadas; só a primeira ("' +
            (reclamadas[0] || {}).nome + '") vai para o cálculo')
    }

    const reclamante = _pjcp_parte(d.reclamante, 'reclamante', avisos)
    const reclamado  = _pjcp_parte(reclamadas[0], 'reclamada', avisos)

    const processo = {
        origem:       'PJE',          // o montador grava processoInformadoManualmente=false
        numeroCNJ:    numeroCNJ,
        dataAutuacao: autuacao,
        valorDaCausa: valorDaCausa,
        reclamante:   reclamante,
        reclamado:    reclamado,
        advogadosReclamante: _pjcp_advogados(d.advogadosReclamante, 'RECLAMANTE', avisos),
        advogadosReclamado:  _pjcp_advogados(d.advogadosReclamada,  'RECLAMADO',  avisos),
    }

    return { processo: processo, erros: erros, avisos: avisos }
}


// ── localizarAdvogado ─────────────────────────────────────────
//
// A tabela do calculista cita o credor dos honorários pelo nome, com a
// grafia de quem digitou ("Henrique Bragança Pinheiro Cecato"); o PJe-Calc
// grava o nome e o CPF do cadastro do PJe ("HENRIQUE BRAGANCA PINHEIRO
// CECATTO", 469.673.818-30). Esta função casa os dois para o módulo de
// honorários usar o cadastro, não a digitação.
//
// Compara sem acento, sem caixa e tolerando letra dobrada (CECATO/CECATTO).
//
// localizarAdvogado(processo, 'Henrique Bragança Pinheiro Cecato') → advogado | null

function localizarAdvogado(processo, nome) {
    const alvo = _pjcp_chaveNome(nome)
    const todos = [].concat(processo.advogadosReclamante || [], processo.advogadosReclamado || [])
    return todos.find(a => _pjcp_chaveNome(a.nome) === alvo) || null
}


// ── auxiliares ────────────────────────────────────────────────

function _pjcp_parte(p, rotulo, avisos) {
    p = p || {}
    const nome = String(p.nome || '').trim()
    if (!nome) avisos.push(rotulo + ': nome não informado')

    const doc = _pjcp_digitos(p.documento)
    let tipo = null
    if (doc.length === 11) tipo = 'CPF'
    else if (doc.length === 14) tipo = 'CNPJ'
    else if (doc) avisos.push(rotulo + ': documento "' + p.documento + '" não é CPF nem CNPJ')
    else avisos.push(rotulo + ': documento não informado')

    return {
        nome: nome,
        tipoDocumentoFiscal:   tipo || (rotulo === 'reclamante' ? 'CPF' : 'CNPJ'),
        numeroDocumentoFiscal: tipo ? doc : null,      // parte: só dígitos
    }
}

function _pjcp_advogados(lista, tipo, avisos) {
    return [].concat(lista || []).filter(Boolean).map(a => {
        const doc = _pjcp_digitos(a.documento)
        if (doc && doc.length !== 11) {
            avisos.push('advogado "' + a.nome + '": CPF "' + a.documento + '" inválido')
        }
        return {
            nome:            String(a.nome || '').trim(),
            tipoDocumento:   'CPF',
            numeroDocumento: doc.length === 11 ? _pjcp_mascaraCpf(doc) : null,   // advogado: com máscara
            numeroOAB:       String(a.oab || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null,
            tipo:            tipo,
        }
    })
}

function _pjcp_cnj(t) {
    const d = _pjcp_digitos(t)
    if (d.length !== 20) return null
    return d.slice(0, 7) + '-' + d.slice(7, 9) + '.' + d.slice(9, 13) + '.' +
           d.slice(13, 14) + '.' + d.slice(14, 16) + '.' + d.slice(16, 20)
}

function _pjcp_data(t) {
    if (t == null || t === '') return null
    if (typeof t === 'number') {                       // epoch em ms, como a API do PJe devolve
        return new Date(t - 3 * 3600 * 1000).toISOString().slice(0, 10)
    }
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t))
    if (m) return m[1] + '-' + m[2] + '-' + m[3]
    m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(t))
    if (m) return m[3] + '-' + m[2] + '-' + m[1]
    return null
}

function _pjcp_valor(v) {
    if (v == null || v === '') return null
    if (typeof v === 'number') return isFinite(v) ? v : null
    const s = String(v).replace(/[^\d,.-]/g, '')
    // "284.429,98" (pt-BR) ou "284429.98" (API)
    const n = s.indexOf(',') >= 0 ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s)
    return isFinite(n) ? n : null
}

function _pjcp_digitos(t) { return String(t == null ? '' : t).replace(/\D/g, '') }

function _pjcp_mascaraCpf(d) {
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9)
}

function _pjcp_chaveNome(t) {
    return String(t == null ? '' : t)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/[^A-Z ]/g, '')
        .replace(/([A-Z])\1+/g, '$1')                  // CECATTO ≡ CECATO
        .replace(/\s+/g, ' ').trim()
}