'use strict';
const MiniGames={
  canvas:null,ctx:null,mode:'stars',running:false,stars:[],asteroids:[],score:0,_raf:null,
  init(canvasEl){
    this.canvas=canvasEl;this.ctx=canvasEl.getContext('2d');
    this._resize();window.addEventListener('resize',()=>this._resize());
    this._initStars();
    this.canvas.addEventListener('click',e=>this._onClick(e));
    this.running=true;this._tick();
  },
  _resize(){if(!this.canvas)return;this.canvas.width=window.innerWidth;this.canvas.height=window.innerHeight;},
  _initStars(){
    this.stars=[];
    for(let i=0;i<180;i++)this.stars.push({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:Math.random()*1.5+0.3,a:Math.random(),da:Math.random()*0.005+0.001,vx:(Math.random()-0.5)*0.15,vy:(Math.random()-0.5)*0.08});
  },
  _spawnAsteroid(){
    if(this.asteroids.length>=6)return;
    const fromLeft=Math.random()<0.5;
    this.asteroids.push({x:fromLeft?-30:window.innerWidth+30,y:Math.random()*window.innerHeight,r:Math.random()*18+10,vx:(Math.random()*1.2+0.5)*(fromLeft?1:-1),vy:(Math.random()-0.5)*0.8,rot:0,rotV:Math.random()*0.04-0.02,hp:3});
  },
  _tick(){
    if(!this.running)return;
    this._raf=requestAnimationFrame(()=>this._tick());
    if(!this.ctx)return;
    const W=this.canvas.width,H=this.canvas.height;
    this.ctx.clearRect(0,0,W,H);
    this.ctx.fillStyle='rgba(0,0,0,0.15)';this.ctx.fillRect(0,0,W,H);
    this._drawStars(W,H);
    if(this.mode==='asteroid'){this._tickAsteroids(W,H);this._drawAsteroids();}
  },
  _drawStars(W,H){
    const ctx=this.ctx;
    this.stars.forEach(s=>{
      s.a+=s.da;if(s.a>1||s.a<0.05)s.da=-s.da;
      s.x+=s.vx;s.y+=s.vy;
      if(s.x<0)s.x=W;if(s.x>W)s.x=0;if(s.y<0)s.y=H;if(s.y>H)s.y=0;
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,'+s.a.toFixed(2)+')';ctx.fill();
    });
  },
  _tickAsteroids(W,H){
    if(Math.random()<0.018)this._spawnAsteroid();
    this.asteroids=this.asteroids.filter(a=>{a.x+=a.vx;a.y+=a.vy;a.rot+=a.rotV;return a.x>-60&&a.x<W+60&&a.y>-60&&a.y<H+60&&a.hp>0;});
  },
  _drawAsteroids(){
    const ctx=this.ctx;
    this.asteroids.forEach(a=>{
      ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);ctx.beginPath();
      for(let i=0;i<7;i++){const ang=(i/7)*Math.PI*2;const r=a.r*(0.8+Math.sin(i*2.5)*0.2);i===0?ctx.moveTo(Math.cos(ang)*r,Math.sin(ang)*r):ctx.lineTo(Math.cos(ang)*r,Math.sin(ang)*r);}
      ctx.closePath();ctx.fillStyle='rgba(100,80,60,0.75)';ctx.fill();ctx.strokeStyle='rgba(200,170,130,0.8)';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
    });
    if(this.asteroids.length){ctx.fillStyle='rgba(255,220,100,0.9)';ctx.font='bold 13px monospace';ctx.fillText('Score: '+this.score,16,28);}
  },
  _onClick(e){
    if(this.mode!=='asteroid')return;
    const rect=this.canvas.getBoundingClientRect();const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    this.asteroids=this.asteroids.filter(a=>{const dx=mx-a.x,dy=my-a.y;if(Math.sqrt(dx*dx+dy*dy)<a.r+5){a.hp--;if(a.hp<=0){this.score++;return false;}}return true;});
  },
  setMode(m){this.mode=m;if(m==='asteroid'&&!this.asteroids.length)this._spawnAsteroid();},
  stop(){this.running=false;if(this._raf){cancelAnimationFrame(this._raf);this._raf=null;}},
};
window.MiniGames=MiniGames;
