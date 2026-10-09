import {timingSafeEqual} from 'node:crypto'
export function validToken(received,expected) {
  if(typeof received!=='string'||!expected)return false
  const a=Buffer.from(received),b=Buffer.from(expected)
  return a.length===b.length && timingSafeEqual(a,b)
}
const supported=new Set(['PURCHASE_APPROVED','PURCHASE_COMPLETE','PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_CANCELED','PURCHASE_DELAYED','PURCHASE_EXPIRED','SUBSCRIPTION_CANCELLATION'])
export function normalize(event,config) {
  if(!supported.has(event.event))return null
  if(event.version!=='2.0.0'||!event.id||!Number.isFinite(event.creation_date))throw new Error('Evento inválido')
  const d=event.data||{}
  if(String(d.product?.id)!==String(config.product))throw new Error('Produto incorreto')
  const email=(d.buyer?.email||d.subscriber?.email||'').trim().toLowerCase()
  const subscriber=d.subscription?.subscriber?.code||d.subscriber?.code
  if(!email.includes('@')||!subscriber)throw new Error('Assinante ausente')
  const planId=String(d.subscription?.plan?.id||'')
  const plan=planId===config.monthly?'monthly':planId===config.annual?'annual':null
  if(!plan)throw new Error('Plano não configurado')
  const paid=['PURCHASE_APPROVED','PURCHASE_COMPLETE'].includes(event.event)
  const next=d.purchase?.date_next_charge||d.date_next_charge
  let until=null
  if(paid){
    if(!Number.isFinite(next)||next<=d.purchase?.approved_date)throw new Error('Vencimento ausente ou inválido')
    until=new Date(next).toISOString()
  }
  if(event.event!=='SUBSCRIPTION_CANCELLATION'&&!d.purchase?.transaction)throw new Error('Transação ausente')
  return {p_event_id:event.id,p_event_type:event.event,p_created_at:new Date(event.creation_date).toISOString(),p_email:email,p_subscriber:String(subscriber),p_transaction:d.purchase?.transaction||null,p_plan:plan,p_valid_until:until}
}
