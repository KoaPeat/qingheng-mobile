import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist','qingheng-2.1.1-open.1');
await fs.mkdir(out,{recursive:true});
for(const name of ['web','worker','docs','scripts','tests'])await fs.cp(path.join(root,name),path.join(out,name),{recursive:true});
for(const name of ['package.json','README.md','README.en.md','LICENSE','NOTICE.md','SECURITY.md','CONTRIBUTING.md','CHANGELOG.md'])await fs.copyFile(path.join(root,name),path.join(out,name));
// Copy only the allow-listed project files; no Git history, local credentials or user backups.
console.log(`Release directory: ${out}\nDeploy only its web/ directory as your static site.`);
