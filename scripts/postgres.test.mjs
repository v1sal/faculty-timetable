import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';import configHandler from '../api/config.js';
test('PostgreSQL enforces admin rights and atomic schedule conflicts',async()=>{
 const db=new PGlite({extensions:{btree_gist}});await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
 await db.exec(await readFile('supabase/schemas/001_timetable.sql','utf8'));
 const admin='00000000-0000-4000-8000-000000000001',viewer='00000000-0000-4000-8000-000000000002';
 await db.query('insert into auth.users values($1),($2)',[admin,viewer]);await db.query('insert into public.timetable_admins values($1)',[admin]);
 const role=async(name,id='')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+name);};
 const insert=(p='Faculty 1',room='Room 1',groups=['Group 1'],start='09:00',end='10:30',day=1)=>db.query('insert into public.sessions(professor,subject,room,groups,day,start,"end",kind) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[p,'Subject',room,groups,day,start,end,'Lecture']);
 await role('anon');assert.equal((await db.query('select * from public.sessions')).rows.length,0);await assert.rejects(insert(),e=>e.code==='42501');
 await role('authenticated',viewer);await assert.rejects(insert(),e=>e.code==='42501');await assert.rejects(db.query('insert into public.timetable_admins values($1)',[viewer]),e=>e.code==='42501');assert.equal((await db.query('select * from public.timetable_admins')).rows.length,0);
 await role('authenticated',admin);const id=(await insert()).rows[0].id;
 for(const [p,r,g] of [['faculty 1','Room 2',['Other']],['Other',' room 1 ',['Other']],['Other','Room 2',['group 1']]])await assert.rejects(insert(p,r,g,'10:00','11:00'),e=>e.code==='23P01');
 assert.equal((await db.query('select count(*)::int as n from public.sessions')).rows[0].n,1);
 await insert('Faculty 1','Room 1',['Group 1'],'10:30','12:00');
 await insert('Faculty 1','Room 1',['Group 1'],'09:00','10:30',2);
 await assert.rejects(insert('Other','Room 3',['Other'],'12:00','11:00'),e=>e.code==='23514');
 await assert.rejects(insert('Other','Room 3',[' '],'13:00','14:00'),e=>e.code==='23514');
 await db.query('update public.sessions set subject=$1 where id=$2',['Changed',id]);
 await assert.rejects(db.query('update public.sessions set "end"=$1 where id=$2',['11:00',id]),e=>e.code==='23P01');
 await role('authenticated',viewer);assert.equal((await db.query('select * from public.sessions')).rows.length,3);
 assert.equal((await db.query('update public.sessions set subject=$1 where id=$2 returning id',['Unauthorized',id])).rows.length,0);
 assert.equal((await db.query('delete from public.sessions where id=$1 returning id',[id])).rows.length,0);
 await assert.rejects(db.query('select * from private.schedule_bookings'),e=>e.code==='42501');
 await role('anon');assert.equal((await db.query('select * from public.sessions')).rows.length,3);
 await role('authenticated',admin);await db.query('delete from public.sessions where id=$1',[id]);await insert(); // Released booking can be reused.
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from private.schedule_bookings')).rows[0].n,9);await db.close();
});
test('Vercel config exposes only public Supabase connection keys',()=>{
 const saved={...process.env};const run=()=>{const res={statusCode:200,setHeader(){},status(s){this.statusCode=s;return this},json(value){this.value=value;return this}};configHandler({method:'GET'},res);return res;};
 try{delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;assert.equal(run().statusCode,503);process.env.SUPABASE_URL='https://project.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_secret_test';assert.equal(run().statusCode,503);process.env.SUPABASE_PUBLISHABLE_KEY='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x';assert.equal(run().statusCode,503);process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';assert.equal(run().value.key,'sb_publishable_test');}
 finally{for(const key of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});