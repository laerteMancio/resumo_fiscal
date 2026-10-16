// Quantidades NF-e usam até 4 casas decimais: soma inteira para não acumular erro binário.
const SCALE = 10000n
const LITRE_UNITS = new Set(['L', 'LT', 'LTS', 'LITRO', 'LITROS'])
// Lista explícita de combustíveis de varejo. Produtos ANP desconhecidos não são inferidos pelo nome.
const FUELS = new Set([
  '320102001', '320102002', '320102003', '320103001',
  '810101001', '810101002',
  '820101033', '820101034', '820101011', '820101003', '820101013', '820101012',
  '420106001', '420106002', '420301004',
  '220101005', '220101006'
])
const SALES_CFOPS = new Set(['5656', '6656'])
function first(node, name) {
  return node?.getElementsByTagNameNS('*', name)?.[0]?.textContent?.trim() || ''
}
function quantity(value) {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, '0'))
}
function isLitres(value) { return LITRE_UNITS.has(value.trim().toUpperCase()) }
export function formatLitres(scaled) {
  const n = BigInt(scaled)
  return `${new Intl.NumberFormat('pt-BR').format(n / SCALE)},${String(n % SCALE).padStart(4, '0')}`
}
export function extractFuelItems(inf) {
  return [...inf.getElementsByTagNameNS('*', 'det')].flatMap(det => {
    const product = det.getElementsByTagNameNS('*', 'prod')[0]
    if (!product) return []
    const anp = first(product, 'cProdANP')
    const name = first(product, 'xProd') || first(product, 'descANP') || 'Produto sem descrição'
    // Produtos sem grupo ANP não entram por similaridade de nome; apenas alertamos casos suspeitos.
    if (!anp && !/^(GASOLINA|ETANOL|DIESEL|[ÓO]LEO\s+DIESEL|GNV)\b/i.test(name)) return []
    const item = {anp, name, itemNumber: det.getAttribute('nItem') || '', cfop: first(product, 'CFOP'), scaledLitres: null, reason: null}
    if (!anp) item.reason = 'Sem código ANP: conferir cadastro do produto'
    else if (!FUELS.has(anp)) item.reason = 'Código ANP fora da lista de combustíveis suportados'
    else if (!SALES_CFOPS.has(item.cfop)) item.reason = 'Operação fora das vendas de combustível ao consumidor (CFOP 5656/6656)'
    else if (isLitres(first(product, 'uCom'))) {
      item.scaledLitres = quantity(first(product, 'qCom'))
      if (item.scaledLitres === null) item.reason = 'Quantidade comercial inválida'
    } else if (isLitres(first(product, 'uTrib'))) {
      item.scaledLitres = quantity(first(product, 'qTrib'))
      if (item.scaledLitres === null) item.reason = 'Quantidade tributável inválida'
    } else item.reason = 'Unidade sem quantidade explícita em litros; não convertida'
    return [item]
  })
}
export function summarizeFuels(notes, imported = notes) {
  const groups = new Map(), daily = new Map(), issues = []
  const authorized = n => ['100', '150'].includes(n.status)
  const keys = new Set(imported.filter(authorized).map(n => n.key))
  const seen = new Set()
  let scaledTotal = 0n, countedItems = 0
  for (const note of notes) {
    if (!authorized(note) || seen.has(note.key)) continue
    seen.add(note.key)
    const items = note.fuelItems || []
    if (!items.length) continue
    const excludedReason = note.direction !== '1' || note.purpose !== '1'
      ? 'Documento de entrada, devolução ou finalidade diferente de venda normal'
      : note.references?.some(ref => keys.has(ref))
        ? 'Documento referencia outra nota autorizada importada; conferir possível duplicidade da venda'
        : null
    for (const item of items) {
      const reason = excludedReason || item.reason
      if (reason || item.scaledLitres === null) {
        issues.push({file:note.fileName, number:note.number, item:item.itemNumber, name:item.name, anp:item.anp, reason:reason || 'Quantidade indisponível'})
        continue
      }
      const group = groups.get(item.anp) || {anp:item.anp, names:new Set(), scaledLitres:0n}
      group.names.add(item.name);group.scaledLitres += item.scaledLitres;groups.set(item.anp,group)
      scaledTotal += item.scaledLitres;countedItems++
      const day = `${note.date.getFullYear()}-${String(note.date.getMonth()+1).padStart(2,'0')}-${String(note.date.getDate()).padStart(2,'0')}`
      daily.set(day,(daily.get(day)||0n)+item.scaledLitres)
    }
  }
  return {scaledTotal,countedItems,daily,issues,groups:[...groups.values()].map(g=>({...g,name:[...g.names].sort().join(' / ')})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))}
}
