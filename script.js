const Memory = {
    init: () => { 
        if(!localStorage.getItem('spirit_meet')) localStorage.setItem('spirit_meet', Date.now());
        if(!localStorage.getItem('spirit_joy_lv')) localStorage.setItem('spirit_joy_lv', 0);
    },
    get: (k) => localStorage.getItem('spirit_'+k),
    set: (k, v) => localStorage.setItem('spirit_'+k, v),
    addStar: (num = 1) => { let s = parseInt(Memory.get('stars')||0)+num; Memory.set('stars', s); return s; },
    addJoy: () => { let j = parseInt(Memory.get('joy_lv')||0)+1; Memory.set('joy_lv', j); return j; },
    refresh: () => {
        const n = Memory.get('name'); if(!n) return;
        const days = Math.floor((Date.now() - Memory.get('meet'))/86400000)+1;
        document.getElementById('badge-ui').innerHTML = `${n}的陪伴者<br>陪伴 ${days} 天 | 星星 ${Memory.get('stars')||0} | 幸福 Lv.${Memory.get('joy_lv')}`;
    }
};

const dom = {
    spirit: document.getElementById('spirit'),
    bWrap: document.getElementById('breath-wrap'),
    tilt: document.getElementById('tilt-box'),
    bubble: document.getElementById('bubble'),
    mouth: document.getElementById('mouth'),
    face: document.getElementById('face'),
    vent: document.getElementById('vent-area'),
    zzz: document.getElementById('zzz'),
    joyAura: document.getElementById('joy-aura'),
    eyes: document.querySelectorAll('.eye'),
    blushes: document.querySelectorAll('.blush')
};

let currentMode = 'idle', breathTimer = null, focusInt = null;
let isPetting = false, petIntensity = 0, petStartPos = {x:0, y:0}, isSuperHappy = false;

window.onload = () => { Memory.init(); createStars(); updateTimeTheme(); if(!Memory.get('name')) document.getElementById('onboarding').style.display='flex'; else welcomeUser(); initIntensityDecay(); };

// --- 膨胀与消肿核心逻辑 ---
function initIntensityDecay() {
    setInterval(() => {
        // 如果不在揉，且已经胀大了，就慢慢缩小
        if(!isPetting && petIntensity > 0) {
            petIntensity -= 1.8; 
            if(petIntensity < 0) petIntensity = 0;
            updateSpiritVisuals(0, 0);
        }
    }, 100);
}

function updateSpiritVisuals(dx, dy) {
    if(currentMode !== 'idle' || isSuperHappy) return;
    
    const baseScale = 1 + (petIntensity / 100) * 0.7; 
    const skew = dx * 0.4;
    const scaleX = baseScale * (1 - Math.abs(dy)/220);
    const scaleY = baseScale * (1 + Math.abs(dy)/220);
    
    // 手机端硬件加速
    dom.spirit.style.transform = `translate3d(${dx}px, ${dy}px, 0) skew(${skew}deg) scale(${scaleX}, ${scaleY})`;
    dom.face.style.transform = `translate3d(${dx*0.7}px, ${dy*0.7}px, 0)`;
    
    const p = petIntensity / 100;
    dom.spirit.style.background = `rgb(255, ${255 - p*30}, ${255 - p*15})`;
}

function triggerSurprise() {
    isPetting = false; isSuperHappy = true;
    Memory.addJoy(); Memory.addStar(5); Memory.refresh();
    dom.spirit.style.transition = "transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.5s";
    dom.spirit.classList.add('swallowing', 'surprise-glow');
    dom.joyAura.style.display = 'block';
    dom.eyes.forEach(e => e.classList.add('happy'));
    const msg = SPIRIT_DATA.surpriseMsgs[Math.floor(Math.random()*SPIRIT_DATA.surpriseMsgs.length)];
    showMessage(`(✿◡‿◡) ${msg}`);
    for(let i=0; i<3; i++) setTimeout(createBurst, i*300);
    setTimeout(() => {
        isSuperHappy = false; petIntensity = 0;
        dom.spirit.classList.remove('swallowing', 'surprise-glow');
        dom.spirit.style.transform = ""; dom.spirit.style.background = "";
        dom.eyes.forEach(e => e.className = 'eye');
        setTimeout(() => { if(!isSuperHappy) dom.joyAura.style.display = 'none'; }, 30000);
    }, 3000);
}

// --- 交互判定（修复实时膨胀） ---
const handleInteractionStart = (e, x, y) => {
    if(e.cancelable) e.preventDefault();
    if(currentMode !== 'idle' || isSuperHappy) return;
    
    isPetting = true; petStartPos = {x, y};
    
    // 关键修复：交互开始时关掉过渡，实现实时膨胀
    dom.spirit.style.transition = "none";
    
    dom.eyes.forEach(e => e.classList.add('petting'));
    dom.blushes.forEach(b => b.classList.add('shy'));
};

const handleInteractionMove = (e, x, y) => {
    if(!isPetting) return;
    if(e.cancelable) e.preventDefault();
    
    // 增加强度
    petIntensity += 0.35; 
    if(petIntensity >= 100) { triggerSurprise(); return; }

    const r = dom.spirit.getBoundingClientRect();
    const dx = (x - (r.left + r.width/2))/10, dy = (y - (r.top + r.height/2))/10;
    
    // 使用 requestAnimationFrame 保证渲染频率与屏幕刷新同步
    requestAnimationFrame(() => updateSpiritVisuals(dx, dy));
};

const handleInteractionEnd = (e, x, y) => {
    if(!isPetting) return;
    isPetting = false;
    
    // 关键修复：结束交互，重新开启平滑过渡
    dom.spirit.style.transition = "transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.5s";
    
    const dist = Math.sqrt(Math.pow(x - petStartPos.x, 2) + Math.pow(y - petStartPos.y, 2));
    if(dist < 15) handlePoke();
    else if(petIntensity < 90) showMessage(SPIRIT_DATA.petMsgs[Math.floor(Math.random()*SPIRIT_DATA.petMsgs.length)]);

    dom.eyes.forEach(e => e.classList.remove('petting'));
    dom.blushes.forEach(b => b.classList.remove('shy'));
    dom.spirit.style.transform = ""; dom.face.style.transform = "";
};

// 绑定事件
dom.spirit.addEventListener('mousedown', e => handleInteractionStart(e, e.clientX, e.clientY));
window.addEventListener('mouseup', e => handleInteractionEnd(e, e.clientX, e.clientY));
window.addEventListener('mousemove', e => handleInteractionMove(e, e.clientX, e.clientY));
dom.spirit.addEventListener('touchstart', e => handleInteractionStart(e, e.touches[0].clientX, e.touches[0].clientY), {passive:false});
window.addEventListener('touchend', e => { const t = e.changedTouches[0]; handleInteractionEnd(e, t.clientX, t.clientY); }, {passive:false});
window.addEventListener('touchmove', e => handleInteractionMove(e, e.touches[0].clientX, e.touches[0].clientY), {passive:false});

// --- 模式逻辑（保持不变） ---
function switchMode(mode, el) {
    clearTimeout(breathTimer); currentMode = mode;
    dom.bWrap.className = 'breath-wrap'; dom.spirit.className = 'spirit'; dom.spirit.style.transform = "";
    dom.vent.style.display = 'none'; dom.zzz.style.display = 'none'; dom.bubble.style.opacity = 1;
    dom.eyes.forEach(e => e.className = 'eye'); dom.mouth.className = 'mouth';
    document.querySelectorAll('.dock-item').forEach(d => d.classList.remove('active')); el.classList.add('active');
    if(mode !== 'sleep') updateTimeTheme();
    if(mode === 'idle') welcomeUser();
    else if(mode === 'breath') runBreathCycle();
    else if(mode === 'vent') { dom.vent.style.display = 'flex'; showMessage("把烦恼写在这里，我会努力吃掉它的！"); }
    else if(mode === 'sleep') enterSleep();
}
function enterSleep() { document.body.style.background = "#020617"; dom.bWrap.classList.add('is-sleeping-wrap'); dom.zzz.style.display = 'block'; dom.eyes.forEach(e => e.classList.add('sleeping')); showMessage("晚安。安心睡吧... 呼..."); setTimeout(() => { if(currentMode === 'sleep') dom.bubble.style.opacity = 0; }, 4000); }
function handleSpiritClick() { if(currentMode === 'sleep') { dom.bubble.style.opacity = 1; showMessage(`唔... ${Memory.get('name')}... 做个好梦... ( ˘ω˘ )`); setTimeout(() => { if(currentMode === 'sleep') dom.bubble.style.opacity = 0; }, 3000); } }
function runBreathCycle() { if(currentMode !== 'breath') return; const step = () => { if(currentMode !== 'breath') return; showMessage("慢慢吸气..."); dom.bWrap.className = 'breath-wrap breath-inhale'; breathTimer = setTimeout(() => { if(currentMode !== 'breath') return; showMessage("停住一会儿..."); dom.bWrap.className = 'breath-wrap breath-hold'; breathTimer = setTimeout(() => { if(currentMode !== 'breath') return; showMessage("缓缓呼气..."); dom.bWrap.className = 'breath-wrap breath-exhale'; breathTimer = setTimeout(step, 6000); }, 2000); }, 4000); }; step(); }
function startFocus() { toggleMenu('bag-menu'); currentMode = 'focus'; document.getElementById('main-dock').style.display='none'; document.getElementById('focus-timer').style.display='block'; document.getElementById('exit-focus').style.display='block'; dom.bWrap.classList.add('is-focusing-wrap'); dom.eyes.forEach(e => e.classList.add('focusing')); showMessage("我会乖乖陪着你的。加油哦！"); let time = 25*60; focusInt = setInterval(() => { time--; let m = Math.floor(time/60), s = time%60; document.getElementById('focus-timer').innerText = `${m}:${s < 10?'0'+s:s}`; if(time <= 0) stopFocus(true); }, 1000); }
function stopFocus(fin = false) { clearInterval(focusInt); document.getElementById('main-dock').style.display='flex'; document.getElementById('focus-timer').style.display='none'; document.getElementById('exit-focus').style.display='none'; currentMode = 'idle'; switchMode('idle', document.querySelector('.dock-item')); if(fin) { showMessage("25分钟到啦！你真棒！"); createBurst(); } }
function runEat(cb) { dom.spirit.classList.add('munching'); dom.eyes.forEach(e => e.classList.add('happy')); setTimeout(() => { dom.spirit.classList.remove('munching'); dom.mouth.classList.remove('open'); dom.spirit.classList.add('swallowing'); setTimeout(() => { dom.spirit.classList.remove('swallowing'); if(cb) cb(); setTimeout(() => dom.eyes.forEach(e => e.className = 'eye'), 1000); }, 600); }, 2000); }
function giveGift(emoji, name) { toggleMenu('bag-menu'); showMessage(`${Memory.get('name')} 送了我${name}！`); dom.mouth.classList.add('open'); dom.eyes.forEach(e => e.classList.add('happy')); setTimeout(() => runEat(), 800); }
function startSwallowing() { const val = document.getElementById('vent-input').value.trim(); if(!val) return; document.getElementById('vent-input').value = ""; dom.mouth.classList.add('open'); dom.eyes.forEach(e => e.classList.add('happy')); showMessage("啊——呜！全吃掉！"); setTimeout(() => runEat(() => { const s = Memory.addStar(); Memory.refresh(); showMessage(`存下了第 ${s} 颗守护星。`); createBurst(); }), 800); }
function giveNote() { toggleMenu('note-menu'); showMessage(`(递纸条)："${SPIRIT_DATA.notes[Math.floor(Math.random()*SPIRIT_DATA.notes.length)]}"`); }
function toggleMenu(id) { const m = document.getElementById(id); const open = m.style.display==='flex'; document.querySelectorAll('.pop-menu').forEach(p=>p.style.display='none'); m.style.display=open?'none':'flex'; }
function saveName() { const n = document.getElementById('name-input').value.trim(); if(n) { Memory.set('name', n); document.getElementById('onboarding').style.display='none'; welcomeUser(); } }
function welcomeUser() { Memory.refresh(); showMessage(`${Memory.get('name')}，你回来啦。`); }
function updateTimeTheme() { const h = new Date().getHours(); let b = "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)"; if(h>=5 && h<9) b = "linear-gradient(180deg, #ff9a9e 0%, #fad0c4 100%)"; else if(h>=9 && h<17) b = "linear-gradient(180deg, #a1c4fd 0%, #c2e9fb 100%)"; else if(h>=17 && h<20) b = "linear-gradient(180deg, #f6d365 0%, #fda085 100%)"; document.body.style.background = b; }
function createStars() { const c = document.getElementById('stars-container'); for(let i=0; i<40; i++) { const s = document.createElement('div'); s.style.position='absolute'; s.style.left=Math.random()*100+'%'; s.style.top=Math.random()*100+'%'; s.style.width='2px'; s.style.height='2px'; s.style.background='white'; s.style.opacity=Math.random()*0.4; c.appendChild(s); } }
function createBurst() { for(let i=0; i<10; i++) { const p = document.createElement('div'); p.innerText="✨"; p.style.position="fixed"; p.style.left="50%"; p.style.top="60%"; p.style.transition="1.5s ease-out"; document.body.appendChild(p); const a=Math.random()*Math.PI*2; setTimeout(() => { p.style.transform=`translate(${Math.cos(a)*150}px, ${Math.sin(a)*150}px) scale(0)`; p.style.opacity=0; }, 50); setTimeout(()=>p.remove(), 1500); } }
function handlePoke() { const n = Memory.get('name'); dom.spirit.style.transition = "transform 0.1s ease-out"; dom.spirit.style.transform = "scale(0.85)"; setTimeout(() => { dom.spirit.style.transition = "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"; dom.spirit.style.transform = "scale(1.1) translateY(-15px)"; showMessage(SPIRIT_DATA.pokeMsgs[Math.floor(Math.random()*SPIRIT_DATA.pokeMsgs.length)]); setTimeout(() => { if(!isPetting) dom.spirit.style.transform = ""; }, 400); }, 100); };

document.addEventListener('mousemove', (e) => {
    if(currentMode !== 'idle' || isPetting || isSuperHappy) return;
    const r = dom.spirit.getBoundingClientRect(); const cx = r.left + r.width/2; const cy = r.top + r.height/2;
    const a = Math.atan2(e.clientY-cy, e.clientX-cx);
    dom.eyes.forEach(eye => { if(!eye.classList.contains('happy')) eye.style.transform=`translate(${Math.cos(a)*4}px, ${Math.sin(a)*4}px)`; });
    const rx=-(e.clientY-cy)/window.innerHeight*15, ry=(e.clientX-cx)/window.innerWidth*15;
    dom.tilt.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg)`;
});
