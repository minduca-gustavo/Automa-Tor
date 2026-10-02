#!/usr/bin/env python3
"""
comparar_pjc.py — compara dois .PJC estruturalmente.

Uso:
    python3 comparar_pjc.py GABARITO.PJC GERADO.PJC [--com-valores]

"Idêntico" aqui quer dizer: mesmos parâmetros, mesmas verbas, mesmas fórmulas,
mesmas ocorrências (datas, quantidades, flags), mesmos reflexos ligados às
mesmas bases. Campos que o PJe-Calc gera na hora (ids, versões, hashes, data
de criação) são ignorados. Valores apurados pelo Regerar (devido, base,
índices) também, salvo com --com-valores.

Cada elemento é identificado por um caminho estável em vez do id:
    verba[13º SALÁRIO]/ocorrencia[2025-10-09]/quantidade
Referências entre objetos (internalRef) são trocadas pelo nome do alvo.
"""
import sys, zipfile, datetime as dt
import xml.etree.ElementTree as ET

BRT = dt.timezone(dt.timedelta(hours=-3))

# Gerados pelo sistema: nunca vão coincidir.
VOLATEIS = {'id', 'versao', 'hashCodeLiquidacao', 'dataCriacao', 'usuarioCriador',
            'hashCalculoCorreto', 'hashAtualizacaoCorreto', 'informacaoUltimoIndice',
            'externalRef'}

# Apurados pelo Regerar: só comparados com --com-valores.
APURADOS = {'devido', 'devidoIntegral', 'base', 'baseIntegral', 'indiceAcumulado',
            'indiceAcumuladoDaMulta', 'indiceMulta', 'taxaDeJurosParaDataDemissao',
            'valorDescontoSimplificadoIrpf', 'baseHonorario', 'indiceCorrecaoHonorario',
            'indiceCorrecaoCustasConhecimentoReclamado', 'pisoCustasConhecimentoReclamado',
            'tetoCustasConhecimentoReclamante'}

# A cópia do estado inicial dentro de cada ocorrência é redundante para a
# comparação: as divergências relevantes já aparecem na ocorrência em si.
IGNORAR_RAMOS = {'ocorrenciaOriginal'}

VERBAS = {'Calculada', 'Reflexo', 'Informada'}


def ler(caminho):
    if zipfile.is_zipfile(caminho):
        z = zipfile.ZipFile(caminho)
        bruto = z.read(z.namelist()[0])
    else:
        bruto = open(caminho, 'rb').read()
    texto = bruto.decode('iso-8859-1')
    if texto.startswith('<?xml'):
        texto = texto.split('?>', 1)[1]
    return ET.fromstring(texto)


def data(v):
    try:
        return dt.datetime.fromtimestamp(int(v) / 1000, BRT).strftime('%Y-%m-%d')
    except (TypeError, ValueError):
        return v


def indexar_nomes(raiz):
    """id → nome, para traduzir internalRef em algo comparável."""
    nomes = {}
    for el in raiz.iter():
        i, n = el.find('id'), el.find('nome')
        if i is not None and i.text:
            nomes.setdefault(i.text, (n.text if n is not None and n.text else el.tag))
    return nomes


def achatar(raiz, com_valores):
    nomes = indexar_nomes(raiz)
    saida = {}

    def rotulo(el, pai_caminho, irmaos_iguais):
        """Rótulo estável para um filho de lista (Set/List)."""
        if el.tag == 'internalRef':
            return None
        nome = el.findtext('nome')
        if nome:
            return f"{el.tag}[{nome.strip()}]"
        di = el.findtext('dataInicial') or el.findtext('competencia') or el.findtext('data')
        if di:
            df = el.findtext('dataFinal')
            r = data(di) + (('→' + data(df)) if df and df != di else '')
            return f"{el.tag}[{r}]"
        desc = el.findtext('descricao')
        if desc:
            return f"{el.tag}[{desc.strip()}]"
        return f"{el.tag}[{irmaos_iguais}]"

    def rec(el, caminho, visitados):
        filhos = list(el)
        if not filhos:
            return
        lista = el.tag in ('Set', 'List')
        contagem = {}
        for f in filhos:
            if f.tag in VOLATEIS or f.tag in IGNORAR_RAMOS:
                continue
            if not com_valores and f.tag in APURADOS:
                continue
            if f.tag == 'internalRef':
                saida[caminho + '/→'] = nomes.get(f.text, f.text)
                continue
            if lista:
                contagem[f.tag] = contagem.get(f.tag, 0) + 1
                seg = rotulo(f, caminho, contagem[f.tag])
            else:
                seg = f.tag
            novo = caminho + '/' + seg
            if len(f) == 0:
                v = f.text
                if v and v.isdigit() and len(v) == 13 and 'data' in f.tag.lower() \
                        or f.tag in ('periodoInicial', 'periodoFinal', 'competencia',
                                     'apartirDeOutroIndice', 'apartirDeOutroJuros'):
                    v = data(v)
                saida[novo] = v
            elif f.tag in VERBAS and f.findtext('nome'):
                # O XStream grava cada verba onde a encontra primeiro — às vezes
                # dentro da fórmula de um reflexo. Canonizamos: toda verba vai
                # para verba[NOME] na raiz, e no lugar dela fica a referência.
                nome = f.findtext('nome').strip()
                if lista and caminho.endswith('verbas/Set'):
                    pass
                else:
                    saida[novo + '/→'] = nome
                pendentes.append((f, nome))
            else:
                rec(f, novo, visitados)

    pendentes = []
    rec(raiz, 'Calculo', frozenset())
    feitas = set()
    while pendentes:
        f, nome = pendentes.pop()
        if nome in feitas:
            continue
        feitas.add(nome)
        saida[f'verba[{nome}]/tipo'] = f.tag
        rec(f, f'verba[{nome}]', frozenset())
    # As entradas de verbas/Set ficam só como inventário.
    return {k: v for k, v in saida.items() if '/verbas/Set/' not in k}


def principal():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    com_valores = '--com-valores' in sys.argv
    if len(args) != 2:
        print(__doc__)
        sys.exit(2)

    a = achatar(ler(args[0]), com_valores)
    b = achatar(ler(args[1]), com_valores)

    so_a = sorted(k for k in a if k not in b)
    so_b = sorted(k for k in b if k not in a)
    difere = sorted(k for k in a if k in b and a[k] != b[k])

    print(f"Campos comparados: gabarito={len(a)}  gerado={len(b)}")
    print(f"Divergentes: {len(difere)}   Só no gabarito: {len(so_a)}   Só no gerado: {len(so_b)}\n")

    if difere:
        print("── VALORES DIFERENTES ──")
        for k in difere:
            print(f"  {k}\n      gabarito: {a[k]!r}\n      gerado:   {b[k]!r}")
    if so_a:
        print("\n── FALTAM NO GERADO ──")
        for k in so_a:
            print(f"  {k} = {a[k]!r}")
    if so_b:
        print("\n── SOBRAM NO GERADO ──")
        for k in so_b:
            print(f"  {k} = {b[k]!r}")

    sys.exit(0 if not (difere or so_a or so_b) else 1)


if __name__ == '__main__':
    principal()