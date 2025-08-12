'use strict';

// Secondary safety shim (if some loader wipes the head shim)
if (typeof window !== 'undefined' && typeof window.invoke === 'undefined') {
  window.invoke = function noopInvoke() {};
}

// Error to Move Log
window.addEventListener('error', (ev) => {
  const msg = ev?.message || 'Unknown error';
  const stack = ev?.error?.stack ? `<pre style="white-space:pre-wrap;color:#9ca3af">${ev.error.stack}</pre>` : '';
  const box = document.getElementById('log');
  if (box) box.innerHTML = `<div style="color:#fca5a5"><b>Runtime Error:</b> ${msg}</div>${stack}` + box.innerHTML;
});

// ====== Constants & State ======
const SIZE = 8;
const RED = 'red';
const BLACK = 'black';

const state = {
  board: [],
  selected: null,
  turn: RED,
  advanced: false,
  chainFrom: null,
  score: { red: 0, black: 0 },
  logEl: null, boardEl: null, ariaEl: null
};

const within = (r,c)=> r>=0 && r<SIZE && c>=0 && c<SIZE;
const log = (msg)=> state.logEl.innerHTML = `<div>${msg}</div>` + state.logEl.innerHTML;
const announce = (t)=> state.ariaEl.textContent = t;

// ====== Setup ======
function makeEmptyBoard(){
  return Array.from({length: SIZE}, ()=> Array.from({length: SIZE}, ()=> ({piece:null})));
}
function setupPieces(b){
  for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++){
    const dark = (r+c)%2===1; if(!dark) continue;
    if (r<=2) b[r][c].piece = { color: BLACK, king:false };
    if (r>=5) b[r][c].piece = { color: RED,   king:false };
  }
}
function resetGame(){
  state.board = makeEmptyBoard(); setupPieces(state.board);
  state.selected=null; state.chainFrom=null; state.turn=RED;
  state.score.red=0; state.score.black=0;
  render(); updateScoreUI();
  log(`<b>New game.</b> Red to move.`); announce('New game. Red to move.');
}

// ====== Rules ======
const forwardDirs = (color)=> color===RED ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
function legalSteps(r,c){
  const sq=state.board[r][c]; if(!sq?.piece) return [];
  const {color,king} = sq.piece;
  const dirs = king ? [[-1,-1],[-1,1],[1,-1],[1,1]] : forwardDirs(color);
  const out=[]; for(const [dr,dc] of dirs){ const nr=r+dr, nc=c+dc; if(within(nr,nc) && !state.board[nr][nc].piece) out.push([nr,nc]); }
  return out;
}
function captureMoves(r,c){
  const sq=state.board[r][c]; if(!sq?.piece) return [];
  const {color,king} = sq.piece;
  const dirs = king ? [[-1,-1],[-1,1],[1,-1],[1,1]] : forwardDirs(color);
  const caps=[];
  for(const [dr,dc] of dirs){
    const mr=r+dr, mc=c+dc, tr=r+2*dr, tc=c+2*dc;
    if(!within(tr,tc) || !within(mr,mc)) continue;
    const middle = state.board[mr][mc];
    if (middle?.piece && middle.piece.color!==sq.piece.color && !state.board[tr][tc].piece){
      caps.push([tr,tc,mr,mc]);
    }
  }
  return caps;
}
function anyCaptureAvailable(color){
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
    const p = state.board[r][c].piece;
    if(p && p.color===color && captureMoves(r,c).length) return true;
  }
  return false;
}
function maybeKinging(r, piece){
  if(!state.advanced || piece.king) return piece;
  if(piece.color===RED && r===0) return {...piece, king:true};
  if(piece.color===BLACK && r===SIZE-1) return {...piece, king:true};
  return piece;
}
function movePiece(from,to){
  const [fr,fc]=from,[tr,tc]=to;
  const moving = state.board[fr][fc].piece;
  state.board[fr][fc].piece=null;
  state.board[tr][tc].piece=maybeKinging(tr,moving);
}
function computeTargetsForSelection(sr,sc){
  const piece=state.board[sr][sc].piece; if(!piece) return {steps:[],caps:[]};
  const mustCapture = state.advanced && !state.chainFrom && anyCaptureAvailable(state.turn);
  const caps = captureMoves(sr,sc);
  if(state.advanced && (state.chainFrom || mustCapture)) return {steps:[],caps};
  return {steps: legalSteps(sr,sc), caps};
}
function removePiece(r,c){ state.board[r][c].piece=null; }
function endTurn(){ state.selected=null; state.chainFrom=null; state.turn = state.turn===RED ? BLACK:RED; render(); announce('Move complete.'); }

// ====== Scoring / Game Over ======
function countPieces(color){
  let n=0; for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ const p=state.board[r][c].piece; if(p && p.color===color) n++; }
  return n;
}
function updateScoreUI(){
  const redRemain = countPieces(RED), blackRemain = countPieces(BLACK);
  document.getElementById('scoreRed').textContent = state.score.red;
  document.getElementById('scoreBlack').textContent = state.score.black;
  document.getElementById('remainRed').textContent = redRemain;
  document.getElementById('remainBlack').textContent = blackRemain;
}
function checkGameOver(){
  const redRemain=countPieces(RED), blackRemain=countPieces(BLACK);
  if(redRemain===0 || blackRemain===0){
    const winner = redRemain>0 ? 'Red' : 'Black';
    log(`<b>Game Over:</b> ${winner} wins!`); announce(`${winner} wins!`);
  }
}

// ====== Rendering ======
function render(){
  const boardEl=state.boardEl; boardEl.innerHTML='';
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
    const isDark=(r+c)%2===1;
    const div=document.createElement('div');
    div.className = `square ${isDark?'dark':'light'}`;
    div.setAttribute('role','gridcell');
    div.dataset.r=r; div.dataset.c=c;

    const piece=state.board[r][c].piece;
    if(piece){
      const p=document.createElement('div');
      p.className=`piece ${piece.color} ${piece.king?'k':''}`;
      p.setAttribute('aria-label', `${piece.color}${piece.king?' king':''} at ${r},${c}`);
      p.title=`${piece.color.toUpperCase()}${piece.king?' (King)':''}`;
      if(state.turn===piece.color && (!state.chainFrom || (state.chainFrom[0]===r && state.chainFrom[1]===c))) p.classList.add('selectable');
      div.appendChild(p);
    }

    if(state.selected){
      const [sr,sc]=state.selected;
      const {steps,caps}=computeTargetsForSelection(sr,sc);
      const targets=new Set(steps.map(x=>`${x[0]}-${x[1]}`));
      for(const [tr,tc] of caps.map(x=>[x[0],x[1]])) targets.add(`${tr}-${tc}`);
      if(targets.has(`${r}-${c}`)) div.classList.add('hint');
    }

    div.addEventListener('click', onSquareClick);
    boardEl.appendChild(div);
  }
  document.getElementById('turnPill').innerHTML = `Turn: <b>${state.turn===RED?'Red':'Black'}</b>`;
  document.getElementById('modePill').textContent = state.advanced ? 'Advanced' : 'Simple';
  updateScoreUI();
}

// ====== Interaction ======
function onSquareClick(e){
  const r=Number(e.currentTarget.dataset.r), c=Number(e.currentTarget.dataset.c);
  const cell=state.board[r][c];

  // select piece
  if(cell.piece && cell.piece.color===state.turn){
    if(state.chainFrom && (state.chainFrom[0]!==r || state.chainFrom[1]!==c)){
      log(`<span style="color:#fca5a5">Must continue capture with the same piece.</span>`); announce('Must continue capture with the same piece.'); return;
    }
    state.selected=[r,c]; render(); return;
  }

  // move piece
  if(state.selected && !cell.piece){
    const [sr,sc]=state.selected;
    const {steps,caps}=computeTargetsForSelection(sr,sc);
    const isStep = new Set(steps.map(([rr,cc])=>`${rr}-${cc}`)).has(`${r}-${c}`);
    const capIndex = caps.findIndex(([rr,cc])=> rr===r && cc===c);

    if(isStep){
      if(state.advanced && (state.chainFrom || anyCaptureAvailable(state.turn))){
        log(`<span style="color:#fca5a5">Capture available — you must take it.</span>`); announce('Capture available — you must take it.'); return;
      }
      movePiece([sr,sc],[r,c]); log(`${state.turn===RED?'🔴':'⚫'} <b>${state.turn}</b> moved ${sr},${sc} → ${r},${c}`);
      endTurn(); return;
    }

    if(capIndex!==-1){
      const [tr,tc,mr,mc]=caps[capIndex];
      movePiece([sr,sc],[tr,tc]);
      const capturedColor = state.board[mr][mc].piece?.color || (state.turn===RED?BLACK:RED);
      removePiece(mr,mc);
      if(state.turn===RED) state.score.red++; else state.score.black++;
      log(`${state.turn===RED?'🔴':'⚫'} <b>${state.turn}</b> captured ${capturedColor} at ${mr},${mc} → landed ${tr},${tc}`);

      state.selected=[tr,tc]; state.chainFrom=[tr,tc];
      const more=captureMoves(tr,tc);
      updateScoreUI(); checkGameOver();
      if(state.advanced && more.length){ render(); announce('Another capture is available. Continue with the same piece.'); return; }
      endTurn(); return;
    }

    log(`<span style="color:#fca5a5">Illegal move.</span>`); announce('Illegal move.');
  }
}

// ====== Tests (click “Run Tests”) ======
function runTests(){
  const results=[]; const assert=(name,cond)=>results.push({name,pass:!!cond});
  const backup=JSON.parse(JSON.stringify(state.board));
  const backupTurn=state.turn, backupAdv=state.advanced, backupChain=state.chainFrom?[...state.chainFrom]:null, backupScore={...state.score};

  resetGame();
  let steps=legalSteps(5,0); assert('Red at (5,0) can step to (4,1)', steps.some(x=>x[0]===4&&x[1]===1));
  steps=legalSteps(2,1); assert('Black at (2,1) has forward step', steps.some(x=>x[0]===3&&(x[1]===0||x[1]===2)));

  state.board=makeEmptyBoard(); state.board[3][2].piece={color:RED,king:false}; state.board[2][3].piece={color:BLACK,king:false};
  let caps=captureMoves(3,2); assert('Red capture 3,2 -> 1,4', caps.some(x=>x[0]===1&&x[1]===4));

  state.advanced=true; const becameKing=maybeKinging(0,{color:RED,king:false}).king===true; assert('Kinging works', becameKing);

  state.board=makeEmptyBoard(); state.advanced=false; state.board[5][0].piece={color:RED,king:false}; movePiece([5,0],[4,1]);
  assert('Origin empty after move', state.board[5][0].piece===null);
  assert('Target has piece', state.board[4][1].piece?.color===RED);

  // Forced capture tests
  state.board=makeEmptyBoard(); state.advanced=true; state.turn=RED;
  state.board[5][0].piece={color:RED,king:false}; state.board[3][2].piece={color:RED,king:false}; state.board[2][3].piece={color:BLACK,king:false};
  assert('anyCaptureAvailable true', anyCaptureAvailable(RED)===true);
  let t=computeTargetsForSelection(5,0); assert('Forced capture blocks steps for others', t.steps.length===0 && t.caps.length===0);
  t=computeTargetsForSelection(3,2); assert('Capturing piece shows caps', t.caps.length>0 && t.steps.length===0);

  // Multi-jump (no kinging)
  state.board=makeEmptyBoard(); state.advanced=true; state.turn=RED;
  state.board[5][1].piece={color:RED,king:false}; state.board[4][2].piece={color:BLACK,king:false}; state.board[2][4].piece={color:BLACK,king:false};
  let c1=captureMoves(5,1); assert('First jump to (3,3)', c1.some(x=>x[0]===3&&x[1]===3));
  state.board[5][1].piece=null; state.board[4][2].piece=null; state.board[3][3].piece={color:RED,king:false};
  let c2=captureMoves(3,3); assert('Second jump to (1,5)', c2.some(x=>x[0]===1&&x[1]===5));

  // King then continue backward
  state.board=makeEmptyBoard(); state.advanced=true; state.turn=RED;
  state.board[2][1].piece={color:RED,king:false}; state.board[1][2].piece={color:BLACK,king:false}; state.board[1][4].piece={color:BLACK,king:false};
  let cFirst=captureMoves(2,1); assert('First capture to (0,3)', cFirst.some(x=>x[0]===0&&x[1]===3));
  state.board[2][1].piece=null; state.board[1][2].piece=null; state.board[0][3].piece=maybeKinging(0,{color:RED,king:false});
  let cFollow=captureMoves(0,3); assert('After kinging, backward capture to (2,5)', cFollow.some(x=>x[0]===2&&x[1]===5));

  // Score tests
  state.board=makeEmptyBoard(); state.turn=RED; state.advanced=true; state.score.red=0; state.score.black=0;
  state.board[3][2].piece={color:RED,king:false}; state.board[2][3].piece={color:BLACK,king:false};
  movePiece([3,2],[1,4]); state.board[2][3].piece=null; state.score.red++; updateScoreUI();
  assert('Score red increments', state.score.red===1);
  assert('Black remaining decreased', countPieces(BLACK)===11);

  // Invoke shim tests
  assert('invoke shim exists', typeof window.invoke==='function');
  let ok=true; try{ invoke(); }catch(e){ ok=false; } assert('invoke callable', ok);

  // Restore
  state.board=backup; state.turn=backupTurn; state.advanced=backupAdv; state.chainFrom=backupChain; state.score=backupScore;
  render(); updateScoreUI();

  const passed=results.filter(r=>r.pass).length;
  log(`<b>Tests:</b> ${passed}/${results.length} passed.`);
  results.forEach(r=>log(`${r.pass?'✅':'❌'} ${r.name}`));
  return results;
}

// ====== Wire-up ======
window.addEventListener('DOMContentLoaded', ()=>{
  state.boardEl=document.getElementById('board');
  state.logEl=document.getElementById('log');
  state.ariaEl=document.getElementById('aria-status');

  document.getElementById('newGameBtn').addEventListener('click', resetGame);
  document.getElementById('toggleCapturesBtn').addEventListener('click', (e)=>{
    state.advanced=!state.advanced; state.chainFrom=null;
    e.currentTarget.setAttribute('aria-pressed', String(state.advanced));
    e.currentTarget.textContent = state.advanced ? 'Disable Captures & Kinging' : 'Enable Captures & Kinging';
    render();
    log(`<b>Mode:</b> ${state.advanced ? 'Advanced (forced captures + multi-jump + kinging continues)' : 'Simple (single step)'}`);
  });
  document.getElementById('runTestsBtn').addEventListener('click', runTests);

  resetGame();
  log('Ready. Click a piece to move.');
});
