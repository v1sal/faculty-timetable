
import {createClient} from '@supabase/supabase-js';
let client;
export async function initialize(){const response=await fetch('/api/config');const config=await response.json();if(!response.ok)throw Error(config.error);client=createClient(config.url,config.key);}
export async function getAccess(){if(!client)throw Error('The database is not connected yet.');const {data:{session}}=await client.auth.getSession();if(!session)return {user:null,isAdmin:false};const {data,error}=await client.from('timetable_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();if(error)throw Error('Admin permissions are unavailable. Check that the Supabase schema has been applied.');return {user:session.user,isAdmin:!!data};}
export function onAuthChange(callback){client.auth.onAuthStateChange(callback);}
export async function login(email,password){if(!client)throw Error('The database is not connected yet.');const {error}=await client.auth.signInWithPassword({email,password});if(error)throw Error(error.message);}
export async function logout(){const {error}=await client.auth.signOut();if(error)throw Error(error.message);}
const normalize=r=>({...r,start:r.start.slice(0,5),end:r.end.slice(0,5)});
function fail(error){if(error.code==='23P01')throw Error('Schedule conflict: this professor, room, or student group already has a class during this time.');if(error.code==='42501')throw Error('Admin permission is required to change schedules.');if(error.code==='23514')throw Error('Check the required fields, groups, and start and end times.');throw Error(error.message||'The schedule request failed.');}
export async function scheduleRequest(path,options={}){
 if(!client)throw Error('The database is not connected yet.');
 const method=options.method||'GET',id=path.split('/')[3];
 if(method==='GET'){const sessions=[];for(let offset=0;;offset+=1000){const {data,error}=await client.from('sessions').select('*').order('day').order('start').order('id').range(offset,offset+999);if(error)fail(error);sessions.push(...data.map(normalize));if(data.length<1000)break;}return {sessions};}
 if(method==='DELETE'){const {data,error}=await client.from('sessions').delete().eq('id',decodeURIComponent(id)).select('id');if(error)fail(error);if(!data.length)throw Error('The class was removed or your account does not have admin permission.');return {ok:true};}
 const raw=JSON.parse(options.body);const s={};for(const key of ['professor','subject','room']){s[key]=String(raw[key]??'').trim();if(!s[key]||s[key].length>120)throw Error('Professor, subject, and room are required.');}
 s.groups=[...new Set((raw.groups||[]).map(x=>String(x).trim()).filter(Boolean))];if(!s.groups.length||s.groups.length>30||s.groups.some(g=>g.length>60))throw Error('Add 1 to 30 student groups.');
 s.day=Number(raw.day);s.start=raw.start;s.end=raw.end;s.kind=raw.kind;s.notes=String(raw.notes||'').trim();s.updated_at=new Date().toISOString();
 if(!Number.isInteger(s.day)||s.day<1||s.day>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)||s.end<=s.start)throw Error('Choose a day and an end time after the start time.');
 const query=method==='POST'?client.from('sessions').insert(s):client.from('sessions').update(s).eq('id',decodeURIComponent(id));const {data,error}=await query.select('*').single();if(error)fail(error);return normalize(data);
}
