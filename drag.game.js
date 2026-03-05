(() => {

/* =========================================
   STAGE + TILES
========================================= */

const stage = document.querySelector(".tile-stage");
if(!stage) return;

const tiles = Array.from(stage.querySelectorAll(".tile"));

let playMode = false;

/* =========================================
   GRID SNAP (hard click)
========================================= */

const GRID = 120;

function snap(v){
 return Math.round(v/GRID)*GRID;
}

/* =========================================
   TILE DRAGGING
========================================= */

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

  let left=snap(startLeft+dx);
  let top=snap(startTop+dy);

  tile.style.left=left+"px";
  tile.style.top=top+"px";

  if(playMode) updateTileBody(tile);

 });

 tile.addEventListener("pointerup",()=>{

  startX=null;
  startY=null;

 });

});

/* =========================================
   GAME TOGGLE
========================================= */

document.addEventListener("keydown",(e)=>{

 if(e.code==="KeyG"){
  toggleGame();
 }

});

function toggleGame(){

 playMode=!playMode;

 if(playMode){
  startGame();
 }else{
  location.reload();
 }

}

/* =========================================
   MATTER ENGINE
========================================= */

const Engine=Matter.Engine;
const World=Matter.World;
const Bodies=Matter.Bodies;
const Body=Matter.Body;
const Events=Matter.Events;

const engine=Engine.create();
const world=engine.world;

/* =========================================
   PLAYER
========================================= */

let player;
let playerEl;

let jumpCount=0;
const MAX_JUMPS=2;

/* =========================================
   TILE BODIES
========================================= */

let tileBodies=new Map();

function updateTileBody(tile){

 const body=tileBodies.get(tile);
 if(!body) return;

 const left=parseFloat(tile.style.left)||0;
 const top=parseFloat(tile.style.top)||0;

 Body.setPosition(body,{
  x:left+60,
  y:top+60
 });

}

/* =========================================
   KEYS + DOOR
========================================= */

let keys=[];
let keyIcons=[];
let door;
let doorEl;

let level=1;
const MAX_LEVELS=10;

let collected=0;
let totalKeys=1;

/* =========================================
   START GAME
========================================= */

function startGame(){

 tiles.forEach(t=>t.classList.add("play-mini"));

 const w=stage.clientWidth;
 const h=stage.clientHeight;

 player=Bodies.rectangle(100,100,40,40,{label:"player"});

 playerEl=document.createElement("div");
 playerEl.className="player";
 stage.appendChild(playerEl);

 const ground=Bodies.rectangle(w/2,h+40,w,80,{isStatic:true,label:"ground"});

 World.add(world,[player,ground]);

 createTileBodies();

 spawnLevel();

 Engine.run(engine);

 requestAnimationFrame(loop);

}

/* =========================================
   TILE COLLISION
========================================= */

function createTileBodies(){

 tiles.forEach(tile=>{

  const left=parseFloat(tile.style.left)||0;
  const top=parseFloat(tile.style.top)||0;

  const body=Bodies.rectangle(left+60,top+60,120,120,{isStatic:true});

  tileBodies.set(tile,body);

  World.add(world,body);

 });

}

/* =========================================
   LEVEL SPAWN
========================================= */

function spawnLevel(){

 collected=0;

 totalKeys=Math.min(1+Math.floor(level/2),5);

 spawnKeys(totalKeys);

 spawnDoor();

}

/* =========================================
   KEY SPAWN
========================================= */

function spawnKeys(n){

 for(let i=0;i<n;i++){

  let x,y;

  do{

   x=Math.random()*stage.clientWidth;
   y=Math.random()*stage.clientHeight*0.6;

  }while(positionInsideTile(x,y));

  const key=Bodies.circle(x,y,18,{isSensor:true,label:"key"});

  const icon=document.createElement("div");
  icon.className="key";
  stage.appendChild(icon);

  keys.push(key);
  keyIcons.push(icon);

  World.add(world,key);

 }

}

/* =========================================
   DOOR SPAWN
========================================= */

function spawnDoor(){

 let x,y;

 do{

  x=Math.random()*stage.clientWidth;
  y=Math.random()*stage.clientHeight*0.6;

 }while(positionInsideTile(x,y));

 door=Bodies.rectangle(x,y,60,90,{isSensor:true,label:"door"});

 doorEl=document.createElement("div");
 doorEl.className="door";
 stage.appendChild(doorEl);

 World.add(world,door);

}

/* =========================================
   SPAWN CHECK
========================================= */

function positionInsideTile(x,y){

 for(const tile of tiles){

  const left=parseFloat(tile.style.left)||0;
  const top=parseFloat(tile.style.top)||0;

  if(x>left&&x<left+120&&y>top&&y<top+120) return true;

 }

 return false;

}

/* =========================================
   COLLISIONS
========================================= */

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

   const i=keys.indexOf(key);

   World.remove(world,key);
   stage.removeChild(keyIcons[i]);

   keys.splice(i,1);
   keyIcons.splice(i,1);

   collected++;

  }

  if(a.label==="player"&&b.label==="door"||
     b.label==="player"&&a.label==="door"){

   if(collected>=totalKeys){

    doorEl.classList.add("open");

    setTimeout(()=>{

     nextLevel();

    },700);

   }

  }

 });

});

/* =========================================
   NEXT LEVEL
========================================= */

function nextLevel(){

 keys.forEach(k=>World.remove(world,k));
 keyIcons.forEach(el=>el.remove());

 keys=[];
 keyIcons=[];

 World.remove(world,door);
 doorEl.remove();

 level++;

 if(level>MAX_LEVELS){
  alert("You finished all levels!");
  location.reload();
 }

 spawnLevel();

 Body.setPosition(player,{x:100,y:100});

}

/* =========================================
   PLAYER CONTROLS
========================================= */

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

  Body.setVelocity(player,{x:-5,y:player.velocity.y});

 }

 if(e.code==="ArrowRight"){

  Body.setVelocity(player,{x:5,y:player.velocity.y});

 }

});

/* =========================================
   GAME LOOP
========================================= */

function loop(){

 playerEl.style.left=(player.position.x-20)+"px";
 playerEl.style.top=(player.position.y-20)+"px";

 keys.forEach((k,i)=>{

  keyIcons[i].style.left=(k.position.x-12)+"px";
  keyIcons[i].style.top=(k.position.y-12)+"px";

 });

 if(doorEl){

  doorEl.style.left=(door.position.x-30)+"px";
  doorEl.style.top=(door.position.y-45)+"px";

 }

 requestAnimationFrame(loop);

}

})();