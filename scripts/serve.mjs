import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','web');
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),relative=decodeURIComponent(url.pathname),target=path.resolve(root,'.'+(relative.endsWith('/')?relative+'index.html':relative));
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end('Forbidden');return;}
  const data=await fs.readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Qingheng: http://127.0.0.1:${port}/\nFictional demo: http://127.0.0.1:${port}/?demo=1`));
