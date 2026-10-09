console.log('ligou?')
async function criaBotaoGerarPJC() {
    console.log('antes')
    let janela = /processo\/\d+\/tarefa\/\d+\/minutar/.test(location.href)
    if (!janela) return
    console.log('depois')
    await aguardarElemento('.botoes-pendencia-analise button')
    await suspender()
    let elemento = document.querySelector('.botoes-pendencia-analise')
    let botaoID = id('botao', 'gerarPJC')
    let remove = [...document.querySelectorAll('#' + botaoID)].map(d => d.remove())
    let botao = criaBotaoAzul({
        id: botaoID,
        ancestral: '.botoes-pendencia-analise',
        texto: 'Gerar PJC',
        acao: () => buscarDadosEBaixarOPJC()
    })
}

async function buscarDadosEBaixarOPJC() {
    let idProc = location.href.match(/processo\/(\d+)\/tarefa/)[1]
    if (!idProc) return
    let processo = await buscarProcesso(idProc)
    let partes = await buscarProcesso(idProc, '/partes')
    let deslocamentos = await buscarProcesso(idProc, '/historicodeslocamentos', true)
    let origem = deslocamentos.find(d => d?.orgaoJulgadorOrigem?.descricao?.includes('Vara do Trabalho'))?.orgaoJulgadorOrigem?.id
    let {valorDaCausa, numero, autuadoEm} = processo
    let {ATIVO, PASSIVO} = partes
    console.clear()
    console.log('AutomaTor deslocamentos: ', deslocamentos)
    console.log('AutomaTor deslocamentos: ', origem)
    console.log('AutomaTor processo: ', processo)
    console.log('AutomaTor partes: ', partes)
    console.log('AutomaTor valorDaCausa: ', valorDaCausa)
    console.log('AutomaTor numero: ', numero)
    console.log('AutomaTor ATIVO: ', ATIVO)
    console.log('AutomaTor PASSIVO: ', PASSIVO)
    let reclamante = ATIVO[0]
    let reclamada = PASSIVO[0]
    let editor = document.querySelector('pje-editor-documento .conteudo').children[2]
    let tabela = editor.querySelector('table')
    let r = await pjcGerarPjc({
        processo: {
            numeroProcesso: numero,
            autuacao: autuadoEm.slice(0, 10),
            valorDaCausa,
            reclamante,
            reclamada,
        },
        tabela,
        dataLiquidacao: '31/10/2026',
        setor: origem

    })
    if (r.ok) _baixarArquivo(r.bytes, r.nome, 'application/octet-stream')
    return
}

/*
const r = await pjcGerarPjc({
    processo: {
        numeroProcesso: '0011965-83.2025.5.15.0089',
        autuacao:       '13/11/2025',            // ou '2025-11-13'
        valorDaCausa:   'R$ 284.429,98',         // ou 284429.98
        reclamante:     { nome, documento },
        reclamada:      { nome, documento },     // ou uma lista
        advogadosReclamante: [{ nome, documento, oab }],
        advogadosReclamada:  [{ nome, documento, oab }],
    },
    tabela:         elementoTable,
    dataLiquidacao: '30/09/2026',                // obrigatória
    setor:          76,                          // opcional
})
*/
criaBotaoGerarPJC()

function id(...partes){
	return ['automaTor', ...partes].filter(Boolean).join('_')
}

async function aguardarElemento(
	seletor				= '',
	configuracao	= {}
){
	let {
		atributos		= false,
		caracteres	= false,
		desconectar = true,
		xpath				= false,
	} = configuracao

	let elemento	= ''
	
	return new Promise(
		resolver => {
			if(xpath)
				elemento	= selecionarElementoPorXpath(seletor)
			else
				elemento	= selecionar(seletor)
			if(elemento){
				relatar('Elemento encontrado: ',elemento,'mutacao')
				resolver(elemento)
			}
			let observador = new MutationObserver(
				mudanca => {
					relatar('Mudança: ',mudanca,'mutacao')
					relatar('Aguardando elemento "'+seletor+'"...','mutacao')
					if(xpath)
						elemento	= selecionarElementoPorXpath(seletor)
					else
						elemento	= selecionar(seletor)
					if(elemento){
						relatar('Elemento encontrado: ',elemento,'mutacao')
						if(desconectar)
							observador.disconnect()
						resolver(elemento)
					}
				}
			)
			observador.observe(
				document,
				{
					childList:			true,
					subtree:				true,
					attributes:			atributos,
					characterData:	caracteres
				}
			)
		}
	)
}

function selecionar(
	seletor		= '',
	ancestral	= '',
	todos			= false
){

	relatar('🔎 Procurando elemento…',seletor,'dom')
	seletor	= seletor.trim()
	if(!seletor){
		relatar('Seletor vazio:',seletor,'dom')
		return ''
	}

	let elemento = ''

	if(!ancestral || typeof ancestral != 'object'){
		ancestral = document
		relatar('🔎 Procurando elemento relativo ao ancestral:',ancestral,'dom')
	}

	try{
		if(todos)
			elemento = ancestral.querySelectorAll(seletor) || ''
		else	
			elemento = ancestral.querySelector(seletor) || ''
		if(!elemento)
			relatar('Não encontrado:',seletor,'dom')
		else
			relatar('Selecionado: ',elemento,'dom')
		return elemento
	}
	catch(erro){
		relatar('Erro:',erro,'erro')
		return ''
	}

}


function selecionarElementoPorXpath(seletor=''){

	if(!seletor){
		relatar('Seletor vazio:',seletor,'dom')
		return ''
	}

	try{
		let elemento = document.evaluate(
			seletor,
			document,
			null,
			XPathResult.FIRST_ORDERED_NODE_TYPE,
			null
		).singleNodeValue || ''
		if(!elemento)
			relatar('Não encontrado:',seletor,'dom')
		else
			relatar('Selecionado: ',elemento,'dom')
		return elemento
	}
	catch(erro){
		relatar('Erro:',erro,'erro')
		return ''
	}

}

async function suspender(milissegundos=1000){
	relatar('Aguardando ' + milissegundos + ' milissegundos…','','automacao')
	return new Promise(
		resolver => setTimeout(resolver,milissegundos)
	)
}

function _baixarArquivo(conteudo, nomeArquivo, tipo){
    const blob = new Blob([conteudo], { type: tipo })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nomeArquivo
    a.click()
    URL.revokeObjectURL(a.href)
}


// Faz a requisição com o mesmo tratamento de erro, mas devolve a Response crua
async function rota_fetchBruto(url = '', opcoes = {}) {
	try {
		relatar('GET ' + url, '', 'requisicao')
		let r = await fetch(url, {
			method: 'GET', mode: 'cors', credentials: 'include',
			...opcoes
		})
		if (!r.ok) { relatar('HTTP ' + r.status, url, 'erro'); return null }
		return r
	} catch (e) { relatar('fetch erro: ' + e.message, url, 'erro'); return null }
}

// rota_fetch passa a ser só "bruto + json", com o mesmo comportamento de antes
async function rota_fetch(url = '') {
	let r = await rota_fetchBruto(url, { headers: rota_cabecalhos() })
	if (!r) return null
	try {
		let dados = await r.json()
		relatar('Resposta de ' + url, dados, 'resposta')
		return dados
	} catch (e) { relatar('json inválido: ' + e.message, url, 'erro'); return null }
}

function rota_cabecalhos(aceita = 'application/json, text/plain, */*'){
	return {
		'Idempotency-Key':  criarChaveDeIdempotencia(),
		'X-Grau-Instancia': '1',
		'X-XSRF-TOKEN':     rota_token(),
		'Content-Type':     'application/json',
		'Accept':           aceita,
	}
}

function rota_token(){
	return cookie_obter('Xsrf-Token') || cookie_obter('XSRF-TOKEN')
}

function criarChaveDeIdempotencia() {
  return crypto.randomUUID() // 122 bits de entropia, formato padrão UUID v4
}

async function buscarProcesso(i, path = '', array = false) {
	let dados = await rota_fetch(
		location.origin + '/pje-comum-api/api/processos/id/' + i + path
	)
	if (Array.isArray(dados)) {
        if (array) return dados
        return dados[0] || null
    }
	return dados || null
}

criaBotaoGerarPJC()

function relatar(
	rotulo		= '',
	conteudo	= '',
	tipo			= '',
	ativada		= false
){
	
	let diagnosticar = false
	if(!diagnosticar)
		return

	let extensao	= '%c' + EXTENSAO.short_name
	let corExtensao	= 'hsl(180,100%,	25%)'
	let corRotulo		= 'hsl(0,	100%,	5%)'

	if(tipo === 'execucao'){
		if(diagnosticar?.execucao){
			relatorio()
		}
	}

	if(tipo === 'armazenamento'){
		if(diagnosticar?.armazenamento){
			corRotulo			= 'hsl(0,	0%,	30%)'
			rotulo				= '💾 Armazenamento - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'autogigs'){
		if(diagnosticar?.autogigs){
			corRotulo			= 'hsl(0,	0%,	30%)'
			rotulo				= '🤖 AutoGIGS - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'automacao'){
		if(diagnosticar?.automacao){
			corRotulo			= 'hsl(0,	0%,	30%)'
			rotulo				= '🤖 Automação - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'configuracao'){
		if(diagnosticar?.configuracao){
			corRotulo			= 'hsl(275, 100%, 40%)'
			rotulo				= '🔑 CONFIGURAÇÃO - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'contexto'){
		if(diagnosticar?.contexto){
			corRotulo			= 'hsla(189, 100%, 40%, 1.00)'
			rotulo				= '🌐 CONTEXTO - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'dom'){
		if(diagnosticar?.dom){
			corRotulo			= 'hsla(266, 100%, 40%, 1.00)'
			rotulo				= '📜 DOM - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'erro'){
		if(diagnosticar?.erro){
			corRotulo			= 'hsl(0,	100%,	40%)'
			rotulo				= '❌ ERRO - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'requisicao'){
		if(diagnosticar?.requisicao){
			corRotulo			= 'hsla(0, 100%, 30%, 1.00)'
			rotulo				= '📤 Requisição - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'resposta'){
		if(diagnosticar?.resposta){
			corRotulo			= 'hsl(120,100%,	30%)'
			rotulo				= '📩 Resposta - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'mutacao'){
		if(diagnosticar?.mutacao){
			corRotulo			= 'hsl(300, 100%, 30%)'
			rotulo				= '🔍 ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'navegador'){
		if(diagnosticar?.navegador){
			corRotulo			= 'hsl(300, 100%, 30%)'
			rotulo				= '🌐 ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'selecao'){
		if(diagnosticar?.selecao){
			corRotulo			= 'hsl(300, 100%, 30%)'
			rotulo				= '🖱️ ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'texto'){
		if(diagnosticar?.texto){
			corRotulo			= 'hsl(300, 100%, 30%)'
			rotulo				= '📄 ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'worker'){
		if(diagnosticar?.worker){
			corRotulo			= 'hsl(50,	100%,	20%)'
			rotulo				= '👷‍♀️ Worker - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'xhr'){
		if(diagnosticar?.xhr){
			corRotulo			= 'hsl(50,	100%,	20%)'
			rotulo				= '📤 XHR - ' + rotulo
			relatorio()
		}
	}

	if(tipo === 'teste'){
		if(diagnosticar?.teste){
			corRotulo			= 'hsl(39, 100%, 30%)'
			rotulo				= '🧪 ' + rotulo
			relatorio()
		}
	}


	function relatorio(){
		let estilo = `
			border-radius:3px;
			color:hsla(0,100%,100%,1);
			display:inline-block;
			font-weight:600;
			padding:0 3px;
		`
		let estiloExtensao	= estilo + `
			background:${corExtensao};
		`
		let estiloRotulo		= estilo + `
			background:${corRotulo};
			margin:0 0 0 3px;
		`
		rotulo = '%c' + rotulo
		if(!conteudo)
			console.log(extensao + rotulo, estiloExtensao, estiloRotulo)
		else
			console.log(extensao + rotulo, estiloExtensao, estiloRotulo, conteudo)
	}

}

function cookie_obter(nome = ''){
	relatar('🔎 Procurando cookie:', nome, 'dom')

	let todos					= `; ${document.cookie}`
	let prefixo				= `; ${nome}=`
	let indiceInicio	= todos.indexOf(prefixo)

	if(indiceInicio === -1)
		return ''

	let inicioValor		= indiceInicio + prefixo.length
	let indiceFim			= todos.indexOf(';', inicioValor)

	let valor					= indiceFim === -1
		? todos.substring(inicioValor)
		: todos.substring(inicioValor, indiceFim)

	if(valor)
		relatar(`🍪 Cookie ${nome} encontrado:`,valor,'dom')

	return decodeURIComponent(valor)

}