// Commercial quantities remain separated by issuer, product, description and unit.
const first = (node, name) => node?.getElementsByTagNameNS('*', name)?.[0]?.textContent?.trim() || ''
function scaled(value, places) {
  if (!new RegExp(`^\\d+(\\.\\d{1,${places}})?$`).test(value)) return null
  const [whole, fraction=''] = value.split('.')
  return BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0'))
}
export function extractProductItems(inf) {
  return [...inf.getElementsByTagNameNS('*','det')].flatMap(det => {
    const prod=det.getElementsByTagNameNS('*','prod')[0]
    return prod ? [{code:first(prod,'cProd'),name:first(prod,'xProd')||'Sem descrição',unit:first(prod,'uCom').toUpperCase()||'Não informada',quantity:scaled(first(prod,'qCom'),4),value:scaled(first(prod,'vProd'),2)}] : []
  })
}
export function summarizeProducts(notes) {
  const groups=new Map(), seen=new Set()
  for(const note of notes) {
    if(!['100','150'].includes(note.status)||seen.has(note.key))continue
    seen.add(note.key)
    for(const item of note.productItems||[]) {
      const key=JSON.stringify([note.cnpj,item.code,item.name,item.unit])
      const group=groups.get(key)||{key,code:item.code,name:item.name,unit:item.unit,quantity:0n,value:0n,missingQuantity:0,missingValue:0}
      if(item.quantity===null)group.missingQuantity++;else group.quantity+=item.quantity
      if(item.value===null)group.missingValue++;else group.value+=item.value
      groups.set(key,group)
    }
  }
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.code.localeCompare(b.code))
}
export function formatProductValue(value) {
  return 'R$ '+new Intl.NumberFormat('pt-BR').format(value/100n)+','+String(value%100n).padStart(2,'0')
}
