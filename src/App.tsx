import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'motion/react';

const radicalsData = [
  { radical: '木', hex: '#f97316' },
  { radical: '水', hex: '#06b6d4' },
  { radical: '火', hex: '#ef4444' },
  { radical: '人', hex: '#eab308' },
  { radical: '手', hex: '#a855f7' },
  { radical: '口', hex: '#22c55e' },
  { radical: '草', hex: '#4ade80' },
  { radical: '女', hex: '#ec4899' },
  { radical: '辵', hex: '#8b5cf6' },
  { radical: '月', hex: '#f43f5e' },
  { radical: '言', hex: '#3b82f6' },
  { radical: '日', hex: '#facc15' },
];

const wordsMap: Record<string, string[]> = {
  '木': "木 校 林 森 枝 板 杯 椅 桌 梅 桃 柳 根 樹 橋 村 材 植 棉 棋 棍".split(' '),
  '水': "水 河 海 洗 江 流 浪 汗 淚 池 洋 活 涼 深 清 滿 渴 游 波".split(' '),
  '口': "口 吃 喝 唱 叫 吹 吐 吸 呼 哈 呢 哇 哪 吧 味 吵 嘴 哭".split(' '),
  '手': "打 拍 拉 推 接 捉 拿 找 把 提 排 掉 掃 掛 搬 搖 擦 抬 指".split(' '),
  '火': "火 炒 烤 燒 燈 煙 爐 灰 災 炎 炭 然 照 熊 熟 熱 點 煮".split(' '),
  '人': "人 你 他 們 仔 作 住 位 伴 伯 伸 似 但 低 休 停 傘 備 傷".split(' '),
  '草': "草 花 茶 菜 葉 落 苗 苦 芽 蘋 芳 芬 蓋 藏 蕉 蓮 藥 萬 英".split(' '),
  '女': "女 媽 姐 妹 奶 她 好 如 姓 妮 妙 娘 娃 婆 婚 婦 姑 姨".split(' '),
  '辵': "進 退 近 遠 逃 過 追 迎 送 速 連 迷 遊 運 道 達 選 還 邊".split(' '),
  '肉': "肉 肚 肌 肝 腸 胃 背 胖 臉 腿 腳 腦 肩 肥 胸 腰 脫".split(' '),
  '月': "月 服 期 朋 朝 望 朗".split(' '),
  '言': "言 說 話 語 認 識 讀 課 誰 記 許 詩 請 謝 講 詞 試 誠".split(' '),
  '日': "日 早 明 星 春 昨 時 晚 晴 暖 暗 晨 景 暑 曉".split(' ')
};

const wordsBank = Object.entries(wordsMap).flatMap(([radical, words]) => 
  words.map(word => ({ word, radical }))
);

type Obstacle = { id: number; x: number; y: number; speed: number; hit: boolean; rotation: number };

const generateQuestion = () => {
  const wordObj = wordsBank[Math.floor(Math.random() * wordsBank.length)];
  const correctRadical = radicalsData.find(r => r.radical === wordObj.radical)!;
  const wrongOptions = radicalsData.filter(r => r.radical !== correctRadical.radical);
  const wrongRadical = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
  return {
    word: wordObj.word,
    correctRadical,
    wrongRadical,
    isLeftCorrect: Math.random() > 0.5
  };
};

export default function App() {
  const [gameState, setGameState] = useState<'start' | 'playing'>('start');
  const [score, setScore] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [, setFloatingTextsVal] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(generateQuestion);
  const level = Math.min(5, Math.floor(score / 1000) + 1);
  
  const currentQuestionRef = useRef(currentQuestion);
  useEffect(() => { currentQuestionRef.current = currentQuestion; }, [currentQuestion]);
  
  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = gameState === 'playing'; }, [gameState]);
  
  const levelRef = useRef(level);
  useEffect(() => { levelRef.current = level; }, [level]);

  const leftPercent = useMotionValue(50);
  const topPercent = useMotionValue(80);
  const tiltAngle = useMotionValue(0);

  const t1X = useMotionValue(25);
  const t1Y = useMotionValue(30);
  const t2X = useMotionValue(75);
  const t2Y = useMotionValue(30);

  const gammaRef = useRef<number | null>(null);
  const betaRef = useRef<number | null>(null);
  const keysDownRef = useRef<Set<string>>(new Set());
  const obstaclesRef = useRef<Obstacle[]>([]);
  const cooldownRef = useRef(0);
  const damageCooldownRef = useRef(0);
  
  const targetPhysics = useRef({
    left: { vx: 0.05, vy: 0.03, x: 25, y: 30 },
    right: { vx: -0.04, vy: 0.06, x: 75, y: 30 }
  });

  const floatingTextsRef = useRef<{id:number, text:string, x:number, y:number, color:string}[]>([]);
  const explosionsRef = useRef<{id:number, x:number, y:number, color:string, particles:{angle:number, distance:number, size:number}[]}[]>([]);
  const [, setExplosionsVal] = useState(0);

  const playSuccessSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) {}
  }, []);

  const playFailSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) {}
  }, []);

  const playWarningBeep = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) {}
  }, []);

  const addFloatingText = useCallback((text: string, x: number, y: number, color: string) => {
    const id = Date.now() + Math.random();
    floatingTextsRef.current.push({id, text, x, y, color});
    setFloatingTextsVal(v => v + 1);
    
    setTimeout(() => {
      floatingTextsRef.current = floatingTextsRef.current.filter(t => t.id !== id);
      setFloatingTextsVal(v => v + 1);
    }, 1500);
  }, []);

  const addExplosion = useCallback((x: number, y: number, color: string) => {
    const id = Date.now() + Math.random();
    const particles = Array.from({ length: 24 }).map((_, i) => ({
      angle: (i / 24) * Math.PI * 2 + Math.random() * 0.2,
      distance: Math.random() * 150 + 40,
      size: Math.random() * 1 + 0.5
    }));
    explosionsRef.current.push({ id, x, y, color, particles });
    setExplosionsVal(v => v + 1);
    
    setTimeout(() => {
      explosionsRef.current = explosionsRef.current.filter(e => e.id !== id);
      setExplosionsVal(v => v + 1);
    }, 800);
  }, []);

  // Main game logic loop
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      gammaRef.current = e.gamma;
      betaRef.current = e.beta;
    };
    window.addEventListener('deviceorientation', handleOrientation);

    const handleKeyDown = (e: KeyboardEvent) => keysDownRef.current.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keysDownRef.current.delete(e.key);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let frameId: number;
    let lastTime = performance.now();
    
    const loop = (time: number) => {
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;
      const dtScale = dt / 16;
      const currentLvl = levelRef.current;

      if (isPlayingRef.current) {
        if (cooldownRef.current > 0) cooldownRef.current -= dt;
        if (damageCooldownRef.current > 0) damageCooldownRef.current -= dt;

        let changeX = 0;
        let changeY = 0;
        let targetTilt = 0;
        
        // Tilt Control (Gyro)
        const gamma = gammaRef.current;
        if (gamma !== null && Math.abs(gamma) > 5) {
          const boundedGamma = Math.max(-45, Math.min(45, gamma));
          changeX = +(boundedGamma / 45) * 2.5 * dtScale;
          targetTilt = (boundedGamma / 45) * 30;
        }

        const beta = betaRef.current;
        if (beta !== null) {
          let boundedBeta = beta - 45; // Assume 45deg is flat/neutral
          if (Math.abs(boundedBeta) > 5) {
            boundedBeta = Math.max(-45, Math.min(45, boundedBeta));
            changeY = +(boundedBeta / 45) * 2.5 * dtScale;
          }
        }

        // Keyboard Control
        const keys = keysDownRef.current;
        if (keys.has('ArrowLeft')) { changeX = -1.5 * dtScale; targetTilt = -25; }
        if (keys.has('ArrowRight')) { changeX = 1.5 * dtScale; targetTilt = 25; }
        if (keys.has('ArrowUp')) { changeY = -1.5 * dtScale; }
        if (keys.has('ArrowDown')) { changeY = 1.5 * dtScale; }

        if (changeX !== 0 || changeY !== 0) {
          leftPercent.set(Math.min(Math.max(leftPercent.get() + changeX, 10), 90));
          topPercent.set(Math.min(Math.max(topPercent.get() + changeY, 15), 90));
        }

        const currentTilt = tiltAngle.get();
        tiltAngle.set(currentTilt + (targetTilt - currentTilt) * 0.15);

        // Target Floating Physics (Speed scales with level)
        const tp = targetPhysics.current;
        const speedMult = 1 + (currentLvl - 1) * 0.5;
        tp.left.x += tp.left.vx * dtScale * speedMult;
        tp.left.y += tp.left.vy * dtScale * speedMult;
        if (tp.left.x < 15 || tp.left.x > 45) tp.left.vx *= -1;
        if (tp.left.y < 20 || tp.left.y > 60) tp.left.vy *= -1;
        t1X.set(tp.left.x);
        t1Y.set(tp.left.y);

        tp.right.x += tp.right.vx * dtScale * speedMult;
        tp.right.y += tp.right.vy * dtScale * speedMult;
        if (tp.right.x < 55 || tp.right.x > 85) tp.right.vx *= -1;
        if (tp.right.y < 20 || tp.right.y > 60) tp.right.vy *= -1;
        t2X.set(tp.right.x);
        t2Y.set(tp.right.y);

        // Meteorite Spawn
        const spawnRate = 0.01 + (currentLvl * 0.01);
        if (Math.random() < spawnRate) {
          obstaclesRef.current.push({
            id: Date.now() + Math.random(),
            x: Math.random() * 80 + 10,
            y: -10,
            speed: Math.random() * 0.6 + 0.4 + (currentLvl * 0.5),
            hit: false,
            rotation: Math.random() * 360,
          });
        }

        const shipX = leftPercent.get();
        const shipY = topPercent.get();

        // Ship-Target Collision
        let hitZone: string | null = null;
        if (Math.hypot(tp.left.x - shipX, tp.left.y - shipY) < 12) hitZone = 'left';
        else if (Math.hypot(tp.right.x - shipX, tp.right.y - shipY) < 12) hitZone = 'right';

        if (hitZone && cooldownRef.current <= 0) {
          const q = currentQuestionRef.current;
          const isCorrect = (hitZone === 'left' && q.isLeftCorrect) || (hitZone === 'right' && !q.isLeftCorrect);
          if (isCorrect) {
            setScore(s => s + 100);
            playSuccessSound();
            addFloatingText("+100", shipX, shipY - 10, "text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,1)]");
            addExplosion(shipX, shipY, q.correctRadical.hex);
            
            setCurrentQuestion(generateQuestion());
            cooldownRef.current = 1500; 
          } else {
            setScore(s => Math.max(0, s - 20));
            playFailSound();
            addFloatingText("-20", shipX, shipY - 10, "text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,1)]");
            
            // Bounce ship to center bottom
            leftPercent.set(50);
            topPercent.set(80);
            tiltAngle.set(0);
            cooldownRef.current = 1000;
          }
        }

        // Meteorite Update & Collision
        let didHitObstacle = false;
        obstaclesRef.current.forEach(obs => {
          obs.y += obs.speed * dtScale;
          obs.rotation += obs.speed * 2;
          
          if (!obs.hit) {
            // Shrink distance check to 50% of visual size
            if (Math.hypot((obs.x - shipX)*0.8, obs.y - shipY) < 4) {
              obs.hit = true;
              didHitObstacle = true;
            }
          }
        });

        if (didHitObstacle && damageCooldownRef.current <= 0) {
          setScore(s => Math.max(0, s - 10));
          addFloatingText("-10", shipX, shipY - 10, "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,1)]");
          playWarningBeep();
          
          damageCooldownRef.current = 1500;

          const el = document.getElementById('damage-flash');
          if (el) {
            el.style.opacity = '1';
            setTimeout(() => { el.style.opacity = '0' }, 300);
          }
          
          const shipEl = document.getElementById('spaceship-container');
          if (shipEl) {
            shipEl.style.animation = 'damageBlink 0.2s infinite alternate';
            setTimeout(() => { shipEl.style.animation = 'none' }, 1500);
          }
        }

        obstaclesRef.current = obstaclesRef.current.filter(o => o.y < 120 && !o.hit);
        
        // Sync obstacles rendering
        setObstacles([...obstaclesRef.current]);
      }
      frameId = requestAnimationFrame(loop);
    };
    
    frameId = requestAnimationFrame(loop);
    
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(frameId);
    };
  }, [leftPercent, topPercent, tiltAngle, t1X, t1Y, t2X, t2Y, playWarningBeep, playSuccessSound, playFailSound, addFloatingText, addExplosion]);

  const startGame = async () => {
    if (
      typeof window.DeviceOrientationEvent !== 'undefined' &&
      typeof (window.DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permission = await (window.DeviceOrientationEvent as any).requestPermission();
        if (permission !== 'granted') {
          alert('未能獲取陀螺儀權限。請允許權限，或使用鍵盤（方向鍵）遊玩。');
        }
      } catch (err) {
        console.error('Permission request failed:', err);
      }
    }
    
    // Play sound to initialize audio context
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtx.resume();
    } catch(e) {}
    
    leftPercent.set(50);
    topPercent.set(80);
    tiltAngle.set(0);
    setScore(0);
    setCurrentQuestion(generateQuestion());
    obstaclesRef.current = [];
    setObstacles([]);
    targetPhysics.current = {
      left: { vx: 0.05, vy: 0.03, x: 25, y: 30 },
      right: { vx: -0.04, vy: 0.06, x: 75, y: 30 }
    };
    setGameState('playing');
  };

  const warpStars = useMemo(() => Array.from({ length: 40 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: Math.random() * 0.5 + 0.5
  })), []);

  const leftTarget = currentQuestion.isLeftCorrect ? currentQuestion.correctRadical : currentQuestion.wrongRadical;
  const rightTarget = currentQuestion.isLeftCorrect ? currentQuestion.wrongRadical : currentQuestion.correctRadical;

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-indigo-950 to-slate-900 text-white overflow-hidden flex flex-col font-sans select-none touch-none">
      <style>{`
        @keyframes warp {
          0% { transform: translateY(-100vh); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes damageBlink {
          0% { opacity: 1; filter: drop-shadow(0 0 10px rgba(239,68,68,1)); }
          100% { opacity: 0.3; filter: drop-shadow(0 0 20px rgba(239,68,68,1)); }
        }
      `}</style>

      {/* Warp Speed Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {warpStars.map(star => (
          <div 
            key={star.id}
            className="absolute w-[2px] bg-gradient-to-b from-transparent via-white to-transparent opacity-80"
            style={{
              left: `${star.left}%`,
              height: '40px',
              animationName: 'warp',
              animationDuration: `${gameState === 'playing' ? star.duration / (1 + (level - 1)*0.2) : star.duration * 3}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationDelay: `${star.delay}s`
            }}
          />
        ))}
      </div>

      <div 
        id="damage-flash" 
        className="absolute inset-0 bg-red-600/60 z-50 pointer-events-none transition-opacity duration-300"
        style={{ opacity: 0 }}
      />
      
      {/* Floating Texts Layer */}
      {floatingTextsRef.current.map(ft => (
        <motion.div
           key={ft.id}
           className={`absolute z-50 font-black text-4xl lg:text-5xl text-center pointer-events-none ${ft.color}`}
           initial={{ opacity: 1, scale: 0.5, y: 0 }}
           animate={{ opacity: 0, scale: 1.5, y: -50 }}
           transition={{ duration: 1.5, ease: "easeOut" }}
           style={{ left: `${ft.x}%`, top: `${ft.y}%`, x: '-50%', y: '-50%' }}
        >
           {ft.text}
        </motion.div>
      ))}

      {/* Explosions Layer */}
      {explosionsRef.current.map(exp => (
        <div key={exp.id} className="absolute pointer-events-none z-40" style={{ left: `${exp.x}%`, top: `${exp.y}%` }}>
          {exp.particles.map((p, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 md:w-3 md:h-3 rounded-full origin-center mix-blend-screen"
              style={{ 
                backgroundColor: exp.color, 
                boxShadow: `0 0 15px ${exp.color}`, 
                x: '-50%', 
                y: '-50%' 
              }}
              initial={{ x: '-50%', y: '-50%', opacity: 1, scale: p.size }}
              animate={{ 
                x: `calc(-50% + ${Math.cos(p.angle) * p.distance}px)`, 
                y: `calc(-50% + ${Math.sin(p.angle) * p.distance}px)`, 
                opacity: 0, 
                scale: p.size * 0.2
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          ))}
        </div>
      ))}

      <AnimatePresence>
        {gameState === 'start' && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-indigo-950/95 backdrop-blur-sm"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4 font-mono text-lime-300 text-center px-4">小一專注力航行者</h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-md text-center">
              請讓裝置保持水平
              <br />
              <span className="text-sm text-slate-400 mt-2 block">(電腦用戶可使用方向鍵操作)</span>
            </p>
            <button 
              onClick={startGame}
              className="px-8 py-5 bg-fuchsia-500 hover:bg-fuchsia-400 active:scale-95 transition-all text-white text-2xl md:text-3xl font-bold rounded-full shadow-[0_0_20px_rgba(217,70,239,0.5)] cursor-pointer"
            >
              🚀 點擊開始航行
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Surface */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        {/* Top Header */}
        <div className="flex justify-between items-start px-4 md:px-8 pt-8 w-full">
          <div className="bg-slate-900/80 border-2 border-lime-400 px-6 py-2 rounded-xl backdrop-blur-md shadow-[0_0_15px_rgba(163,230,53,0.3)] pointer-events-none flex items-center space-x-4">
             <div className="text-center">
                 <div className="text-xs text-lime-300 font-bold uppercase tracking-widest text-center">關卡</div>
                 <div className="text-2xl font-black text-white text-center tabular-nums">Level {level}</div>
             </div>
             <div className="w-px h-10 bg-lime-400/30"></div>
             <div className="text-center">
                 <div className="text-xs text-lime-300 font-bold uppercase tracking-widest text-center">分數</div>
                 <div className="text-2xl font-black text-white text-center tabular-nums">{score}</div>
             </div>
          </div>
          
          <motion.h2 className="text-xl md:text-3xl font-bold text-lime-300 bg-slate-900/80 py-2 px-6 rounded-full backdrop-blur-md shadow-lg border border-lime-300/30 text-center max-w-md pointer-events-none">
             移動到正確部件
          </motion.h2>
        </div>

        {/* Space Stations */}
        <motion.div 
          className="absolute w-[70px] md:w-[100px] flex flex-col justify-center items-center pointer-events-none"
          style={{ left: useTransform(t1X, v=>`${v}%`), top: useTransform(t1Y, v=>`${v}%`), x: '-50%', y: '-50%' }}
        >
          <div className="relative w-full aspect-square flex items-center justify-center">
            <div className="absolute inset-0 border-[4px] border-dashed rounded-full animate-[spin_15s_linear_infinite]" style={{ borderColor: leftTarget.hex }} />
            <div className="absolute inset-1.5 border-2 rounded-full animate-[spin_20s_linear_infinite_reverse]" style={{ borderColor: leftTarget.hex, opacity: 0.5 }} />
            <div className="relative z-10 w-11 h-11 md:w-14 md:h-14 bg-slate-900 border-2 md:border-4 rounded-full flex flex-col items-center justify-center shadow-lg" style={{ borderColor: leftTarget.hex, boxShadow: `0 0 20px ${leftTarget.hex}66` }}>
              <span className="text-xl md:text-2xl font-black text-white">{leftTarget.radical}</span>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="absolute w-[70px] md:w-[100px] flex flex-col justify-center items-center pointer-events-none"
          style={{ left: useTransform(t2X, v=>`${v}%`), top: useTransform(t2Y, v=>`${v}%`), x: '-50%', y: '-50%' }}
        >
          <div className="relative w-full aspect-square flex items-center justify-center">
            <div className="absolute inset-0 border-[4px] border-dashed rounded-full animate-[spin_15s_linear_infinite]" style={{ borderColor: rightTarget.hex }} />
            <div className="absolute inset-1.5 border-2 rounded-full animate-[spin_20s_linear_infinite_reverse]" style={{ borderColor: rightTarget.hex, opacity: 0.5 }} />
            <div className="relative z-10 w-11 h-11 md:w-14 md:h-14 bg-slate-900 border-2 md:border-4 rounded-full flex flex-col items-center justify-center shadow-lg" style={{ borderColor: rightTarget.hex, boxShadow: `0 0 20px ${rightTarget.hex}66` }}>
              <span className="text-xl md:text-2xl font-black text-white">{rightTarget.radical}</span>
            </div>
          </div>
        </motion.div>

        {/* Meteorites */}
        {obstacles.map(obs => (
          <div
            key={obs.id}
            className="absolute z-10 pointer-events-none"
            style={{
              left: `${obs.x}%`,
              top: `${obs.y}%`,
              transform: `translate(-50%, -50%) rotate(${obs.rotation}deg)`,
              filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.5))'
            }}
          >
            <svg viewBox="0 0 64 64" className="w-10 h-10 md:w-14 md:h-14">
              <path d="M 12 24 L 20 10 L 40 8 L 54 20 L 58 40 L 44 56 L 24 58 L 10 46 Z" fill="#57534e" stroke="#78716c" strokeWidth="4" />
              <circle cx="24" cy="24" r="4" fill="#44403c" />
              <circle cx="40" cy="36" r="6" fill="#44403c" />
              <circle cx="20" cy="40" r="3" fill="#44403c" />
            </svg>
          </div>
        ))}

        {/* Spaceship */}
        <motion.div 
          id="spaceship-container"
          style={{ 
            left: useTransform(leftPercent, v => `${v}%`), 
            top: useTransform(topPercent, v => `${v}%`), 
            x: '-50%', y: '-50%', 
            rotate: tiltAngle 
          }}
          className="absolute w-24 h-32 md:w-32 md:h-40 z-20 pointer-events-none"
        >
          <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-2xl overflow-visible">
            {/* Engine Thrust */}
            <g style={{ transformOrigin: '50% 100%', animation: 'spin 0.2s infinite alternate' }}>
              <ellipse cx="50" cy="115" rx="8" ry="15" fill="#facc15" />
              <ellipse cx="50" cy="115" rx="4" ry="25" fill="#ef4444" opacity="0.8" />
            </g>
            <path d="M 30 70 L 10 110 L 30 100 Z" fill="#ef4444" />
            <path d="M 70 70 L 90 110 L 70 100 Z" fill="#ef4444" />
            <rect x="30" y="30" width="40" height="70" rx="20" fill="#e2e8f0" />
            <path d="M 30 40 Q 50 -10 70 40 Z" fill="#cbd5e1" />
            <circle cx="50" cy="55" r="16" fill="#cffafe" stroke="#475569" strokeWidth="4" />
            <text x="50" y="57" dominantBaseline="middle" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#0f172a">
              {currentQuestion.word}
            </text>
            <rect x="40" y="100" width="20" height="10" fill="#475569" />
          </svg>
        </motion.div>

        {/* Instructions */}
        <div className="absolute bottom-10 left-0 right-0 text-center text-slate-400 text-lg md:text-xl font-medium tracking-wide">
          左右/前後傾斜來控制太空船
          <br/>
          ( ⬅️ ➡️ ⬆️ ⬇️ )
        </div>
      </div>
    </div>
  );
}

