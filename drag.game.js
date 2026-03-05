(() => {

/* BASIC SETUP */

const stage = document.querySelector(".tile-stage");
if(!stage) return;

const tiles = Array.from(stage.querySelectorAll(".tile"));

let playMode = false;

/* GRID + HARD SNAP SETTINGS */

const GRID = 120;
const SNAP_DISTANCE = 30;

/* TILE DRAGGING */

function clamp(n,min,max){
 return Math.min(max,Math.max(min,n));
}

function snap(v){
 return Math.round(v/GRID)*GRID;
}

tiles.forEach(tile=>{

 tile.style.position="absolute";

 let startX,startY,startLeft,startTop;

 tile.addEventListener("pointerdown",(e)=>{

  startX=e.clientX;
  startY=e.clientY;

  startLeft=parseFloat(tile.style.left)||0;
  startTop=parseFloat(tile.style.top)||0;

  tile.setPointerCapture(e.pointerId);

 });

 tile.addEventListener("pointermove",(e)=>{

  if(startX==null) return;

  let dx=e.clientX-startX;
  let dy=e.clientY-startY;

  let left=startLeft+dx;
  let top=startTop+dy;

  left=snap(left);
  top=snap(top);

  tile.style.left=left+"px";
  tile.style.top=top+"px";

 });

 tile.addEventListener("pointerup",()=>{

  startX=null;
  startY=null;

 });

});

/* ===============================
   GAME MODE
================================ */

document.addEventListener("keydown",(e)=>{

 if(e.code==="KeyG"){
  toggleGame();
 }

});

/* ===============================
   MATTER PHYSICS
================================ */

const Engine=Matter.Engine;
const World=Matter.World;
const Bodies=Matter.Bodies;
const Body=Matter.Body;
const Events=Matter.Events;

const engine=Engine.create();

const world=engine.world;

let player;
let ground;
let tileBodies=[];

let jumpCount=0;
const MAX_JUMPS=2;

let keys=[];
let door;

let level=1;
let collected=0;
let totalKeys=1;

/* ===============================
   GAME START
================================ */

function toggleGame(){

 playMode=!playMode;

 if(playMode){

  startGame();

 }else{

  location.reload();

 }

}

/* ===============================
   START GAME
================================ */

function startGame(){

 tiles.forEach(t=>{
  t.classList.add("play-mini");
 });

 const width=stage.clientWidth;
 const height=stage.clientHeight;

 player=Bodies.rectangle(100,100,40,40,{label:"player"});

 ground=Bodies.rectangle(width/2,height+40,width,80,{isStatic:true,label:"ground"});

 World.add(world,[player,ground]);

 createTileBodies();

 spawnLevel();

 Engine.run(engine);

 requestAnimationFrame(loop);

}

/* ===============================
   TILE COLLISION BODIES
================================ */

function createTileBodies(){

 tiles.forEach(tile=>{

  const left=parseFloat(tile.style.left)||0;
  const top=parseFloat(tile.style.top)||0;

  const body=Bodies.rectangle(
   left+60,
   top+60,
   120,
   120,
   {isStatic:true,label:"tile"}
  );

  tileBodies.push({tile,body});

  World.add(world,body);

 });

}

/* ===============================
   LEVEL SPAWN
================================ */

function spawnLevel(){

 collected=0;

 totalKeys=Math.min(1+Math.floor(level/2),5);

 spawnKeys(totalKeys);

 spawnDoor();

}

/* ===============================
   SPAWN KEYS
================================ */

function spawnKeys(count){

 for(let i=0;i<count;i++){

  let x,y;

  do{

   x=Math.random()*stage.clientWidth;
   y=Math.random()*stage.clientHeight*0.6;

  }while(positionInsideTile(x,y));

  const key=Bodies.circle(x,y,20,{isSensor:true,label:"key"});

  keys.push(key);

  World.add(world,key);

 }

}

/* ===============================
   SPAWN DOOR
================================ */

function spawnDoor(){

 let x,y;

 do{

  x=Math.random()*stage.clientWidth;
  y=Math.random()*stage.clientHeight*0.6;

 }while(positionInsideTile(x,y));

 door=Bodies.rectangle(x,y,60,80,{isSensor:true,label:"door"});

 World.add(world,door);

}

/* ===============================
   KEY SPAWN CHECK
================================ */

function positionInsideTile(x,y){

 for(const tile of tiles){

  const left=parseFloat(tile.style.left)||0;
  const top=parseFloat(tile.style.top)||0;

  if(
   x>left &&
   x<left+120 &&
   y>top &&
   y<top+120
  ){
   return true;
  }

 }

 return false;

}

/* ===============================
   COLLISIONS
================================ */

Events.on(engine,"collisionStart",(event)=>{

 event.pairs.forEach(pair=>{

  const a=pair.bodyA;
  const b=pair.bodyB;

  if(a.label==="player"&&b.label==="ground"||
     b.label==="player"&&a.label==="ground"){

   jumpCount=0;

  }

  if(a.label==="player"&&b.label==="key"||
     b.label==="player"&&a.label==="key"){

   const key=a.label==="key"?a:b;

   World.remove(world,key);

   collected++;

  }

  if(a.label==="player"&&b.label==="door"||
     b.label==="player"&&a.label==="door"){

   if(collected>=totalKeys){

    level++;

    resetLevel();

   }

  }

 });

});

/* ===============================
   RESET LEVEL
================================ */

function resetLevel(){

 keys.forEach(k=>World.remove(world,k));
 keys=[];

 World.remove(world,door);

 spawnLevel();

 Body.setPosition(player,{x:100,y:100});

}

/* ===============================
   PLAYER CONTROLS
================================ */

document.addEventListener("keydown",(e)=>{

 if(!playMode) return;

 if(e.code==="Space"){

  if(jumpCount<MAX_JUMPS){

   Body.setVelocity(player,{
    x:player.velocity.x,
    y:-12
   });

   jumpCount++;

  }

 }

 if(e.code==="ArrowLeft"){

  Body.setVelocity(player,{
   x:-5,
   y:player.velocity.y
  });

 }

 if(e.code==="ArrowRight"){

  Body.setVelocity(player,{
   x:5,
   y:player.velocity.y
  });

 }

});

/* ===============================
   GAME LOOP
================================ */

function loop(){

 const el=document.getElementById("player");

 if(el){

  el.style.left=player.position.x+"px";
  el.style.top=player.position.y+"px";

 }

 requestAnimationFrame(loop);

}

})();