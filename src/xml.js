import {extractProductItems} from './products.js'
import {extractFuelItems} from './fuels.js'

export function first(node, name) {
  const list = node?.getElementsByTagNameNS('*', name)
  return list?.[0]?.textContent?.trim() || ''
}

function parseDate(value) {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

export function parseXml(text, fileName) {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  if (xml.getElementsByTagNameNS('*', 'parsererror').length) throw new Error('XML malformado')
  const inf = xml.getElementsByTagNameNS('*', 'infNFe')[0]
  if (!inf) throw new Error('Não é uma NF-e/NFC-e reconhecida')

  const ide = inf.getElementsByTagNameNS('*', 'ide')[0]
  const emit = inf.getElementsByTagNameNS('*', 'emit')[0]
  const dest = inf.getElementsByTagNameNS('*', 'dest')[0]
  const total = inf.getElementsByTagNameNS('*', 'ICMSTot')[0]
  const prot = xml.getElementsByTagNameNS('*', 'infProt')[0]
  const date = parseDate(first(ide, 'dhEmi') || first(ide, 'dEmi'))
  if (!['55', '65'].includes(first(ide, 'mod'))) throw new Error('Modelo não suportado')
  if (!date) throw new Error('Data de emissão não encontrada')

  return {
    fileName,
    direction: first(ide, 'tpNF'),
    purpose: first(ide, 'finNFe'),
    references: [...ide.getElementsByTagNameNS('*', 'refNFe')].map(n => n.textContent.trim()),
    fuelItems: extractFuelItems(inf),
    productItems: extractProductItems(inf),
    cnpj: first(emit, 'CNPJ'),
    date,
    model: first(ide, 'mod') === '65' ? 'NFC-e' : 'NF-e',
    number: first(ide, 'nNF') || '-',
    series: first(ide, 'serie') || '-',
    issuer: first(emit, 'xNome') || first(emit, 'xFant') || 'Não informado',
    recipient: first(dest, 'xNome') || 'Consumidor não identificado',
    value: Number(first(total, 'vNF').replace(',', '.')) || 0,
    key: (inf.getAttribute('Id') || '').replace(/^NFe/, ''),
    status: first(prot, 'cStat') || (prot ? 'Processada' : 'Sem protocolo')
  }
}

