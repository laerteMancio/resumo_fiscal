import {database,identity,access,reply} from '../server/backend.js'
export default async function handler(req,res) {
  if(req.method!=='GET') return reply(res,405,{error:'Método não permitido'})
  try {
    const db=database(),user=await identity(req,db)
    if(!user) return reply(res,401,{error:'Entre na sua conta.'})
    if(!(await access(db,user)).administrator) return reply(res,403,{error:'Acesso restrito.'})
    const [payments,usage,subscriptions]=await Promise.all([db.from('payments').select('email,plan,status,valid_until').order('valid_until',{ascending:false}).limit(200),db.from('report_usage').select('*',{head:true,count:'exact'}),db.from('subscriptions').select('email,cancelled').limit(200)])
    if(payments.error||usage.error||subscriptions.error) throw new Error()
    return reply(res,200,{payments:payments.data,reportRequests:usage.count,subscriptions:subscriptions.data})
  } catch{return reply(res,503,{error:'Não foi possível carregar o painel.'})}
}
