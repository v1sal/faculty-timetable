import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import worker from '../worker/index.js';
const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_schedule.sql','utf8'));const env={DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this},async all(){return {results:db.prepare(sql).all(...values)}},async first(){return db.prepare(sql).get(...values)},async run(){const info=db.prepare(sql).run(...values);return {meta:{changes:info.changes}}}}}}};
const request=(method,path='/api/sessions',body,extra={})=>worker.fetch(new Request('http://localhost'+path,{method,headers:{'oai-authenticated-user-id':'owner','Origin':'http://localhost','Content-Type':'application/json',...extra},...(body?{body:JSON.stringify(body)}:{})}),env);
const base={professor:'Professor A',subject:'Computer science',room:'A-201',groups:['CS-101','CS-102'],day:1,start:'09:00',end:'10:30',kind:'Lecture',notes:'Example'};
test('database CRUD, conflicts, and authorization',async()=>{
let result=await request('POST',undefined,base);assert.equal(result.status,201);let entry=await result.json();
let list=await(await request('GET')).json();assert.equal(list.sessions.length,1);assert.deepEqual(list.sessions[0].groups,base.groups);
for(const overlap of [{professor:'professor a',room:'B-202',groups:['XX']},{professor:'Other',room:' a-201 ',groups:['XX']},{professor:'Other',room:'B-202',groups:['cs-102']}]){assert.equal((await request('POST',undefined,{...base,...overlap,start:'10:00',end:'11:00'})).status,409);}
assert.equal((await request('POST',undefined,{...base,start:'10:30',end:'12:00'})).status,201);
assert.equal((await request('POST',undefined,{...base,day:2})).status,201);
assert.equal((await request('POST',undefined,{...base,start:'11:00',end:'10:00'})).status,400);
assert.equal((await request('POST',undefined,{...base,groups:[]})).status,400);
assert.equal((await request('POST',undefined,base,{'Origin':'http://attacker.example'})).status,403);
const anonymous=await worker.fetch(new Request('http://localhost/api/sessions'),env);assert.equal(anonymous.status,401);
assert.equal((await request('PUT','/api/sessions/'+entry.id,{...base,subject:'Updated subject'})).status,200);
assert.equal((await request('PUT','/api/sessions/'+entry.id,{...base,end:'11:00'})).status,409);
list=await(await request('GET')).json();assert.equal(list.sessions.find(x=>x.id===entry.id).subject,'Updated subject');
assert.equal((await request('DELETE','/api/sessions/'+entry.id)).status,200);
assert.equal((await request('PUT','/api/sessions/'+entry.id,base)).status,404);
assert.equal((await(await request('GET')).json()).sessions.length,2);
});