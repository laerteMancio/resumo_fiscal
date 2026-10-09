import {database,identity,access,reply} from '../server/backend.js'
export default async function handler(req,res) {
  if(req.method!=='POST') return reply(res,405,{error:'Método não permitido'})
  try {
    const db=database(),user=await identity(req,db)
    if(!user) return reply(res,401,{error:'Entre novamente na sua conta.'})
    if(!(await access(db,user)).allowed) return reply(res,403,{error:'Sua assinatura não está ativa.'})
    const {error}=await db.from('report_usage').insert({user_id:user.id})
    if(error) throw error
    return reply(res,200,{allowed:true})
  }catch{return reply(res,503,{error:'Não foi possível autorizar o relatório. Tente novamente.'})}
}
