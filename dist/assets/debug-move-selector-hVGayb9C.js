import{n as e,r as t,t as n}from"./index-Du7ol1m4.js";function r(r,i,a){let o=t(),s=new Set(n()),c=[...o].sort((e,t)=>{let n=s.has(e.id)?0:1,r=s.has(t.id)?0:1;return n===r?e.name.localeCompare(t.name):n-r}),l=document.createElement(`div`);l.className=`debug-move-selector`;let u=document.createElement(`button`);u.className=`debug-toggle`,u.textContent=`FX`,u.title=`Debug Move Animations`;let d=document.createElement(`div`);d.className=`debug-panel`,d.style.display=`none`;let f=document.createElement(`div`);f.className=`debug-title`,f.textContent=`Move Animations`,d.appendChild(f);let p=document.createElement(`input`);p.type=`text`,p.placeholder=`Filter moves...`,p.className=`debug-filter`,d.appendChild(p);let m=document.createElement(`select`);m.size=10,m.className=`debug-select`;function h(e){m.innerHTML=``;let t=e.toLowerCase();for(let e of c){if(t&&!e.name.toLowerCase().includes(t)&&!e.type.toLowerCase().includes(t)&&!e.category.toLowerCase().includes(t))continue;let n=document.createElement(`option`);n.value=e.id;let r=s.has(e.id);n.textContent=`${r?`●`:`○`} ${e.name} (${e.type}) [${e.category}]`,r||(n.style.opacity=`0.5`),m.appendChild(n)}}h(``),d.appendChild(m);let g=document.createElement(`button`);g.className=`debug-play`,g.textContent=`Play Animation`,d.appendChild(g);let _=document.createElement(`div`);_.className=`debug-status`,d.appendChild(_),u.addEventListener(`click`,()=>{let e=d.style.display!==`none`;d.style.display=e?`none`:`flex`}),p.addEventListener(`input`,()=>{h(p.value)}),g.addEventListener(`click`,async()=>{let t=m.value;if(!t){_.textContent=`Select a move first`;return}let n=e(t);if(!n){_.textContent=`No animation for: ${t}`;return}if(r.isPlaying){_.textContent=`Animation already playing...`;return}let i={player:0,slot:0},a={player:1,slot:0};_.textContent=`Playing: ${t}...`,g.disabled=!0;try{await r.play(n,i,[a]),_.textContent=`Done: ${t}`}catch(e){_.textContent=`Error: ${e.message}`}finally{g.disabled=!1}});let v=document.createElement(`style`);return v.textContent=`
    .debug-move-selector {
      position: fixed;
      bottom: 12px;
      right: 12px;
      z-index: 9999;
      font-family: monospace;
      font-size: 11px;
    }
    .debug-toggle {
      background: rgba(0, 0, 0, 0.75);
      color: #0f0;
      border: 1px solid #0f0;
      padding: 4px 10px;
      cursor: pointer;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      float: right;
    }
    .debug-toggle:hover {
      background: rgba(0, 60, 0, 0.9);
    }
    .debug-panel {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: rgba(0, 0, 0, 0.85);
      border: 1px solid #0f0;
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 4px;
      width: 260px;
      max-height: 350px;
    }
    .debug-title {
      color: #0f0;
      font-weight: bold;
      text-align: center;
      font-size: 12px;
    }
    .debug-filter {
      background: #111;
      color: #0f0;
      border: 1px solid #333;
      padding: 4px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 11px;
      outline: none;
    }
    .debug-filter:focus {
      border-color: #0f0;
    }
    .debug-select {
      background: #111;
      color: #ccc;
      border: 1px solid #333;
      border-radius: 3px;
      font-family: monospace;
      font-size: 10px;
      outline: none;
      flex: 1;
      min-height: 140px;
    }
    .debug-select option {
      padding: 2px 4px;
    }
    .debug-select option:checked {
      background: #0a3a0a;
      color: #0f0;
    }
    .debug-play {
      background: #0a3a0a;
      color: #0f0;
      border: 1px solid #0f0;
      padding: 6px;
      cursor: pointer;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      font-weight: bold;
    }
    .debug-play:hover:not(:disabled) {
      background: #0a5a0a;
    }
    .debug-play:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .debug-status {
      color: #888;
      font-size: 10px;
      text-align: center;
      min-height: 14px;
    }
  `,l.appendChild(v),l.appendChild(d),l.appendChild(u),{el:l}}export{r as createDebugMoveSelector};