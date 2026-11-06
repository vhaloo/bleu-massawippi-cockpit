/** Explicit, conditional publication of a private admin-only measurement snapshot.
 * Default is a read-only dry run. No editorial document, rule or role is changed. */
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import{createRequire}from'node:module';
async function main(){
const arg=name=>process.argv.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const cliHome=arg('--cli-home'),input=arg('--snapshot'),proof=arg('--proof-dir'),apply=process.argv.includes('--apply');
if(!cliHome||!input||!proof)throw Error('--cli-home, --snapshot et --proof-dir requis.');
const text=await fs.readFile(input,'utf8'),snapshot=JSON.parse(text);
if(snapshot.schemaVersion!==1||!snapshot.capturedAt||Buffer.byteLength(text)>700000)throw Error('Relevé invalide ou trop volumineux.');
function check(value){if(!value||typeof value!=='object')return;for(const[key,item]of Object.entries(value)){if(/password|token|cookie|private.?key|authorization/i.test(key))throw Error('Champ secret interdit.');check(item);}}check(snapshot);
if(snapshot.billing&&Math.abs(snapshot.billing.charges.reduce((sum,row)=>sum+row.amountCad,0)-snapshot.billing.totalCad)>.005)throw Error('Total de facturation incohérent.');
const req=createRequire(import.meta.url),auth=req(path.join(cliHome,'lib/auth.js')),account=auth.getGlobalDefaultAccount();if(!account?.tokens?.refresh_token)throw Error('Connexion Firebase CLI requise.');
const credential=await auth.getAccessToken(account.tokens.refresh_token,account.tokens.scope.split(' ')),headers={Authorization:`Bearer ${credential.access_token}`,'Content-Type':'application/json'};
const root='projects/bleu-massawippi-cockpit-5d860/databases/(default)/documents',name=`${root}/privateContentVersions/admin-infrastructure-current`,base='https://firestore.googleapis.com/v1/';
const response=await fetch(base+name,{headers});if(![200,404].includes(response.status))throw Error(`Lecture préalable HTTP ${response.status}`);const before=response.ok?await response.json():null;
if(before&&before.fields?.kind?.stringValue!=='admin-infrastructure')throw Error('Document existant inattendu; aucune écriture.');
const snapshotHash=crypto.createHash('sha256').update(text).digest('hex');
if(before?.fields?.contentHash?.stringValue===snapshotHash){console.log(JSON.stringify({verified:true,writes:0,unchanged:true}));return;}
if(before?.fields?.capturedAt?.stringValue && Date.parse(snapshot.capturedAt)<Date.parse(before.fields.capturedAt.stringValue))throw Error('Un relevé plus récent existe déjà; aucune écriture.');
const now=new Date().toISOString(),stamp=now.replace(/[-:.TZ]/g,''),dir=path.resolve(proof,stamp);await fs.mkdir(path.resolve(proof),{recursive:true});await fs.mkdir(dir,{recursive:false});await fs.writeFile(path.join(dir,'AVANT.json'),JSON.stringify(before,null,2));
const encode=value=>value===null?{nullValue:null}:Array.isArray(value)?{arrayValue:{values:value.map(encode)}}:typeof value==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]))}}:typeof value==='boolean'?{booleanValue:value}:typeof value==='number'?Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value}:{stringValue:String(value)};
const fields={kind:{stringValue:'admin-infrastructure'},contentId:{stringValue:'admin-infrastructure'},createdAt:{timestampValue:now},snapshot:encode(snapshot)};
const version=`${root}/privateContentVersions/admin-infrastructure-${stamp}`;
const pointer={kind:fields.kind,contentId:fields.contentId,createdAt:fields.createdAt,versionId:{stringValue:version.split('/').at(-1)},capturedAt:{stringValue:snapshot.capturedAt},contentHash:{stringValue:snapshotHash}};
const writes=[{update:{name:version,fields},currentDocument:{exists:false}},{update:{name,fields:pointer},currentDocument:before?{updateTime:before.updateTime}:{exists:false}}];
await fs.writeFile(path.join(dir,'PREPARATION.json'),JSON.stringify({apply,document:name,writes:2,sha256:crypto.createHash('sha256').update(text).digest('hex'),snapshotCapturedAt:snapshot.capturedAt},null,2));
if(!apply){console.log(JSON.stringify({dryRun:true,writes:0,plannedWrites:2,proof:dir}));return;}
const commit=await fetch(base+root.replace(/\/documents$/,'')+'/documents:commit',{method:'POST',headers,body:JSON.stringify({writes})});if(!commit.ok)throw Error(`Écriture conditionnelle refusée HTTP ${commit.status}`);
const result=await commit.json();await fs.writeFile(path.join(dir,'RESULTAT.json'),JSON.stringify(result,null,2));const saved=await(await fetch(base+name,{headers})).json(),savedVersion=await(await fetch(base+version,{headers})).json();if(saved.fields?.versionId?.stringValue!==version.split('/').at(-1)||savedVersion.fields?.snapshot?.mapValue?.fields?.capturedAt?.stringValue!==snapshot.capturedAt)throw Error('Vérification du relevé enregistré échouée.');await fs.writeFile(path.join(dir,'APRES.json'),JSON.stringify({pointer:saved,version:savedVersion},null,2));console.log(JSON.stringify({applied:true,verified:true,writes:2,editorialWrites:0,rulesChanged:false,proof:dir}));
}
await main();
