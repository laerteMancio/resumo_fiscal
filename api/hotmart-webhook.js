import {database,reply} from '../server/backend.js'
import {validToken,normalize} from '../server/hotmart.js'
export default async function handler(req,res) {
  if(req.method!=='POST')return reply(res,405,{error:'Método não permitido'})
  const {HOTMART_HOTTOK,HOTMART_PRODUCT_ID,HOTMART_MONTHLY_PLAN_ID,HOTMART_ANNUAL_PLAN_ID}=process.env
  if(!HOTMART_HOTTOK||!HOTMART_PRODUCT_ID||!HOTMART_MONTHLY_PLAN_ID||!HOTMART_ANNUAL_PLAN_ID)return reply(res,503,{error:'Integração não configurada'})
  if(!validToken(req.headers['x-hotmart-hottok'],HOTMART_HOTTOK))return reply(res,401,{error:'Não autorizado'})
  let args
  try {args=normalize(typeof req.body==='string'?JSON.parse(req.body):req.body,{product:HOTMART_PRODUCT_ID,monthly:HOTMART_MONTHLY_PLAN_ID,annual:HOTMART_ANNUAL_PLAN_ID})}
  catch{return reply(res,400,{error:'Evento inválido; confira produto, plano, assinante e vencimento.'})}
  if(!args)return reply(res,200,{ignored:true})
  try {
    const {data,error}=await database().rpc('apply_hotmart_event',args)
    if(error)throw error
    return reply(res,200,{result:data})
  }catch{return reply(res,503,{error:'Falha no processamento. Reenvie o evento.'})}
}
