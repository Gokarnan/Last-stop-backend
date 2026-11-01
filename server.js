const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors({origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true}));
app.get('/', (_req,res)=>res.json({name:'LAST STOP: 3 AM backend',status:'online',transport:'Socket.IO'}));
app.get('/health', (_req,res)=>res.json({ok:true,rooms:rooms.size}));
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:process.env.CORS_ORIGIN?process.env.CORS_ORIGIN.split(','):true,methods:['GET','POST']},pingInterval:25000,pingTimeout:20000});
const rooms=new Map();
const rate=new Map();
const MAX_ROOMS=100, MAX_PLAYERS=4;
function clean(s,max=28){return String(s||'').replace(/[<>\\u0000-\\u001f]/g,'').trim().slice(0,max);}
function code(){return crypto.randomBytes(3).toString('hex').toUpperCase();}
function limited(socket){const now=Date.now(),a=rate.get(socket.id)||[];const recent=a.filter(t=>now-t<5000);if(recent.length>30)return true;recent.push(now);rate.set(socket.id,recent);return false;}
function ack(cb,data){if(typeof cb==='function')cb(data);}
function publicRooms(){return [...rooms.values()].filter(r=>r.visibility==='public'&&r.status==='waiting').map(r=>({code:r.code,name:r.name,players:r.players.size,maxPlayers:r.maxPlayers,status:r.status}));}
function lobby(room){return {code:room.code,name:room.name,status:room.status,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,host:p.id===room.host,ready:p.ready})),isHost:false};}
function emitLobby(room){for(const p of room.players.values()){const l=lobby(room);l.isHost=p.id===room.host;io.to(p.id).emit('lobby',l);}io.emit('rooms',publicRooms());}
function leave(socket){const room=rooms.get(socket.data.roomCode);if(!room)return;room.players.delete(socket.id);socket.leave(room.code);socket.data.roomCode=null;if(!room.players.size){rooms.delete(room.code);}else{if(room.host===socket.id)room.host=room.players.keys().next().value;emitLobby(room);}io.emit('rooms',publicRooms());}
io.on('connection',socket=>{
 socket.emit('rooms',publicRooms());
 socket.on('rooms:list',()=>socket.emit('rooms',publicRooms()));
 socket.on('room:create',(data,cb)=>{
  if(limited(socket))return ack(cb,{error:'Too many requests. Try again shortly.'});
  if(socket.data.roomCode)return ack(cb,{error:'Leave your current room first.'});
  if(rooms.size>=MAX_ROOMS)return ack(cb,{error:'Server room capacity reached.'});
  const name=clean(data?.playerName,18)||'Guest',roomName=clean(data?.name)||'Night Shift';
  const max=Math.max(2,Math.min(MAX_PLAYERS,Number(data?.maxPlayers)||4));
  let roomCode=code();while(rooms.has(roomCode))roomCode=code();
  const room={code:roomCode,name:roomName,password:String(data?.password||'').slice(0,64),visibility:data?.visibility==='private'?'private':'public',maxPlayers:max,status:'waiting',host:socket.id,players:new Map(),state:{night:1,started:false}};
  room.players.set(socket.id,{id:socket.id,name,ready:false});rooms.set(roomCode,room);socket.join(roomCode);socket.data.roomCode=roomCode;emitLobby(room);ack(cb,{message:`Room ${roomCode} created.`});
 });
 socket.on('room:join',(data,cb)=>{
  if(limited(socket))return ack(cb,{error:'Too many requests. Try again shortly.'});
  if(socket.data.roomCode)return ack(cb,{error:'Leave your current room first.'});
  const c=clean(data?.code,8).toUpperCase(),room=rooms.get(c);
  if(!room)return ack(cb,{error:'Room not found.'});
  if(room.status!=='waiting')return ack(cb,{error:'Game already started.'});
  if(room.players.size>=room.maxPlayers)return ack(cb,{error:'Room full.'});
  if(room.password&&room.password!==String(data?.password||''))return ack(cb,{error:'Incorrect password.'});
  const name=clean(data?.name,18)||'Guest';room.players.set(socket.id,{id:socket.id,name,ready:false});socket.join(c);socket.data.roomCode=c;emitLobby(room);ack(cb,{message:`Joined ${c}.`});
 });
 socket.on('room:ready',()=>{const r=rooms.get(socket.data.roomCode);if(!r)return;const p=r.players.get(socket.id);if(p){p.ready=!p.ready;emitLobby(r);}});
 socket.on('game:start',()=>{const r=rooms.get(socket.data.roomCode);if(!r||r.host!==socket.id||r.status!=='waiting')return; if(r.players.size<1)return;r.status='playing';r.state.started=true;io.to(r.code).emit('game:start',{night:1});emitLobby(r);});
 socket.on('player:move',data=>{const r=rooms.get(socket.data.roomCode);if(!r||r.status!=='playing'||!data)return;const p=r.players.get(socket.id);if(!p)return;const pos=data.position||{};const safe={x:Number(pos.x)||0,y:0,z:Number(pos.z)||0,rotation:Number(data.rotation)||0};safe.x=Math.max(-30,Math.min(30,safe.x));safe.z=Math.max(-40,Math.min(20,safe.z));socket.to(r.code).emit('player:moved',{id:socket.id,...safe});});
 socket.on('game:action',action=>{const r=rooms.get(socket.data.roomCode);if(!r||r.status!=='playing'||limited(socket))return;const type=clean(action?.type,24);if(!['cook','serve','door','cctv','telephone'].includes(type))return;socket.to(r.code).emit('game:event',{type,by:r.players.get(socket.id)?.name||'Player'});});
 socket.on('disconnect',()=>{leave(socket);rate.delete(socket.id);});
 socket.on('room:leave',()=>leave(socket));
});
const port=process.env.PORT||3000;
server.listen(port,'0.0.0.0',()=>console.log(`LAST STOP server listening on ${port}`));
