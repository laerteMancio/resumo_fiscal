import {database,identity,access,reply} from '../server/backend.js'
export default async function handler(req,res) {
  if(req.method!=='GET') return reply(res,405,{error:'Método não permitido'})
  try {
    const db=database(),user=await identity(req,db)
    if(!user) return reply(res,401,{error:'Entre com um e-mail confirmado.'})
    return reply(res,200,{...(await access(db,user)),email:user.email})
  } catch {return reply(res,503,{error:'Não foi possível verificar sua assinatura. Tente novamente.'})}
}
