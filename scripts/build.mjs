import {mkdir,copyFile,cp,readFile} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await copyFile('worker/index.js','dist/server/index.js');await copyFile('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
const source=await readFile('worker/index.js','utf8');const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));if(typeof mod.default.fetch!=='function')throw Error('Invalid Worker');
const html=await (await mod.default.fetch(new Request('http://localhost/'),{},{})).text();
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new Function(script);console.log('Worker and browser JavaScript validated.');