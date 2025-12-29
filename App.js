
import { useState, useEffect, useRef, useCallback, createElement } from 'react';
import htm from 'htm';
import { GameState, PowerUpType } from './types.js';
import { QUIZ_DATA, HISTORY_ITEMS } from './constants.js';
import { audioService } from './services/audioService.js';

const html = htm.bind(createElement);

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
const SPECIAL_COLORS = {
  [PowerUpType.MAGNET]: '#facc15',
  [PowerUpType.BURST]: '#f472b6',
  [PowerUpType.GIANT]: '#22d3ee',
};

const STAGE_THEMES = [
  { bg: 'linear-gradient(to right, #064e3b, #065f46)', name: '古代・飛鳥の道' },
  { bg: 'linear-gradient(to right, #4c1d95, #5b21b6)', name: '奈良・平安の都' },
  { bg: 'linear-gradient(to right, #7f1d1d, #991b1b)', name: '戦国・乱世の砦' },
  { bg: 'linear-gradient(to right, #1e3a8a, #1e40af)', name: '江戸・明治の街' },
  { bg: 'linear-gradient(to right, #111827, #1f2937)', name: '未来・時空の回廊' },
];

const POWERUP_DURATION = 400; 
const COMBO_THRESHOLD = 1200; 
const BASE_GEM_COUNT = 55; 
const BURST_GEM_COUNT = 150; 
const MAX_COMBO = 1000;
const MAX_QUIZ_STOCK = 5;

const SubState = {
  NONE: 'NONE',
  QUIZ_INTRO: 'QUIZ_INTRO',
  STAGE_INTRO: 'STAGE_INTRO'
};

const App = () => {
  const [gameState, setGameState] = useState(GameState.TITLE);
  const [subState, setSubState] = useState(SubState.NONE);
  const [totalPoints, setTotalPoints] = useState(0); 
  const [stage, setStage] = useState(0);
  const [gachaCount, setGachaCount] = useState(0);
  const [collection, setCollection] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [lastGachaItem, setLastGachaItem] = useState(null);
  const [shake, setShake] = useState(0);
  const [powerUp, setPowerUp] = useState(PowerUpType.NONE);
  const [powerUpTimer, setPowerUpTimer] = useState(0);
  const [combo, setCombo] = useState(0);
  const [pendingQuizCount, setPendingQuizCount] = useState(0);

  const canvasRef = useRef(null);
  const gameData = useRef({
    player: { x: 150, y: 0, vx: 0, vy: 0, radius: 16, trail: [] },
    gems: [],
    particles: [],
    bgStars: [],
    lastGemTime: 0,
    powerUpTimer: 0,
    powerUpType: PowerUpType.NONE,
    combo: 0,
    totalPoints: 0,
    quizzesServedCount: 0,
  });

  const keys = useRef({});

  const createGem = (width, height, isInitial = false) => {
    const isSpecial = Math.random() < 0.012;
    const specialTypes = [PowerUpType.MAGNET, PowerUpType.BURST, PowerUpType.GIANT];
    return {
      x: isInitial ? Math.random() * width * 2 : width + Math.random() * width,
      y: Math.random() * (height - 100) + 50,
      vx: -(Math.random() * 2 + 5),
      id: Math.random(),
      active: true,
      type: Math.floor(Math.random() * COLORS.length),
      isSpecial,
      specialType: isSpecial ? specialTypes[Math.floor(Math.random() * specialTypes.length)] : PowerUpType.NONE
    };
  };

  const initLevel = useCallback((width, height) => {
    gameData.current.player.y = height / 2;
    gameData.current.player.x = 150;
    gameData.current.gems = Array.from({ length: BASE_GEM_COUNT }, () => createGem(width, height, true));
    gameData.current.particles = [];
    gameData.current.bgStars = Array.from({ length: 70 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.1
    }));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const kd = (e) => keys.current[e.key] = true;
    const ku = (e) => keys.current[e.key] = false;
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  useEffect(() => {
    let animationFrameId;

    const update = () => {
      if (gameState !== GameState.PLAYING || subState !== SubState.NONE) return;

      const { player, gems, particles, bgStars } = gameData.current;
      const accel = 1.2;
      const friction = 0.92;

      // 4方向移動の実装
      if (keys.current['ArrowUp'] || keys.current['w']) player.vy -= accel;
      if (keys.current['ArrowDown'] || keys.current['s']) player.vy += accel;
      if (keys.current['ArrowLeft'] || keys.current['a']) player.vx -= accel;
      if (keys.current['ArrowRight'] || keys.current['d']) player.vx += accel;

      player.vx *= friction;
      player.vy *= friction;
      player.x += player.vx;
      player.y += player.vy;

      // 画面端の制限
      const margin = player.radius;
      if (player.x < margin) { player.x = margin; player.vx = 0; }
      if (player.x > window.innerWidth - margin) { player.x = window.innerWidth - margin; player.vx = 0; }
      if (player.y < margin) { player.y = margin; player.vy = 0; }
      if (player.y > window.innerHeight - margin) { player.y = window.innerHeight - margin; player.vy = 0; }

      player.trail.unshift({ x: player.x, y: player.y });
      if (player.trail.length > 5) player.trail.pop();

      bgStars.forEach(star => {
        star.x -= star.speed;
        if (star.x < -10) star.x = window.innerWidth + 10;
      });

      if (gameData.current.powerUpTimer > 0) {
        gameData.current.powerUpTimer--;
        setPowerUpTimer(gameData.current.powerUpTimer);
        if (gameData.current.powerUpTimer === 0) {
          gameData.current.powerUpType = PowerUpType.NONE;
          setPowerUp(PowerUpType.NONE);
        }
      }

      const now = Date.now();
      const comboEnded = gameData.current.combo > 0 && now - gameData.current.lastGemTime > COMBO_THRESHOLD;
      const forceMaxCombo = gameData.current.combo >= MAX_COMBO;

      if (comboEnded || forceMaxCombo) {
        if (forceMaxCombo) gameData.current.combo = MAX_COMBO;
        const currentQuota = Math.floor(gameData.current.totalPoints / 100);
        const diff = currentQuota - gameData.current.quizzesServedCount;
        if (diff > 0) {
          setPendingQuizCount(Math.min(diff, MAX_QUIZ_STOCK));
          setSubState(SubState.QUIZ_INTRO);
          gameData.current.combo = 0;
          setCombo(0);
        } else {
          gameData.current.combo = 0;
          setCombo(0);
        }
      }

      const pRadius = gameData.current.powerUpType === PowerUpType.GIANT ? 80 : player.radius;
      const scrollSpeedBonus = gameData.current.powerUpType === PowerUpType.BURST ? 2.5 : 1.0;

      // 宝石の更新と再生成ロジック
      for (let i = gems.length - 1; i >= 0; i--) {
        const gem = gems[i];
        if (!gem.active) {
          gems[i] = createGem(window.innerWidth, window.innerHeight);
          continue;
        }

        gem.x += gem.vx * scrollSpeedBonus;

        if (gameData.current.powerUpType === PowerUpType.MAGNET) {
          const dx = player.x - gem.x;
          const dy = player.y - gem.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 320) {
            gem.x += dx * 0.15;
            gem.y += dy * 0.15;
          }
        }

        const dx = player.x - gem.x;
        const dy = player.y - gem.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < pRadius + 18) {
          gem.active = false;
          gameData.current.totalPoints++;
          setTotalPoints(gameData.current.totalPoints);
          gameData.current.combo++;
          setCombo(gameData.current.combo);
          gameData.current.lastGemTime = now;
          audioService.playGem(gameData.current.combo);

          if (gem.isSpecial) {
            audioService.playPowerUp();
            setShake(15);
            gameData.current.powerUpType = gem.specialType;
            gameData.current.powerUpTimer = POWERUP_DURATION;
            setPowerUp(gem.specialType);
          }

          for (let j = 0; j < 8; j++) {
            particles.push({
              x: gem.x, y: gem.y,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8 - 1,
              size: Math.random() * 3 + 1,
              life: 1.0,
              color: gem.isSpecial ? SPECIAL_COLORS[gem.specialType] : COLORS[gem.type]
            });
          }
        }

        if (gem.x < -100) {
          gems[i] = createGem(window.innerWidth, window.innerHeight);
        }
      }

      const targetCount = gameData.current.powerUpType === PowerUpType.BURST ? BURST_GEM_COUNT : BASE_GEM_COUNT;
      while (gems.length < targetCount) {
        gems.push(createGem(window.innerWidth, window.innerHeight));
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.03;
        if (p.life <= 0) particles.splice(i, 1);
      }
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas || gameState !== GameState.PLAYING) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { player, gems, particles, bgStars, powerUpType } = gameData.current;
      const theme = STAGE_THEMES[stage % STAGE_THEMES.length];

      const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      const colors = theme.bg.match(/#[a-fA-F0-9]{6}/g) || ['#0f172a', '#1e293b'];
      grad.addColorStop(0, colors[0]); grad.addColorStop(1, colors[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      bgStars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (shake > 0) {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      gems.forEach(gem => {
        if (!gem.active) return;
        // 視認性向上のための変更: サイズアップと常時グロー効果
        ctx.shadowBlur = gem.isSpecial ? 25 : 15;
        ctx.shadowColor = gem.isSpecial ? SPECIAL_COLORS[gem.specialType] : '#ffffff'; // 通常ジェムは白く光らせる
        
        ctx.font = gem.isSpecial ? '40px serif' : '28px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let icon = '💎';
        if (gem.isSpecial) {
          if (gem.specialType === PowerUpType.MAGNET) icon = '🧲';
          if (gem.specialType === PowerUpType.BURST) icon = '🌟';
          if (gem.specialType === PowerUpType.GIANT) icon = '🍄';
        }
        ctx.fillText(icon, gem.x, gem.y);
      });

      particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      player.trail.forEach((t, i) => {
        ctx.globalAlpha = (1 - i / player.trail.length) * 0.15;
        ctx.font = `${powerUpType === PowerUpType.GIANT ? 70 : 35}px serif`;
        ctx.fillText('🚀', t.x, t.y);
      });
      ctx.globalAlpha = 1.0;

      ctx.save();
      ctx.translate(player.x, player.y);
      const drawSize = powerUpType === PowerUpType.GIANT ? 80 : 40;
      ctx.font = `${drawSize}px serif`;
      ctx.shadowBlur = 10; ctx.shadowColor = '#fff';
      ctx.fillText('🚀', 0, 0);

      if (gameData.current.combo > 1) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        const txt = `${gameData.current.combo} コンボ`;
        ctx.strokeText(txt, 0, -drawSize / 2);
        ctx.fillText(txt, 0, -drawSize / 2);
      }
      ctx.restore();

      if (shake > 0) {
        setShake(prev => Math.max(0, prev - 1.0));
        ctx.restore();
      }
      animationFrameId = requestAnimationFrame(draw);
      update();
    };

    if (gameState === GameState.PLAYING) {
      draw();
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, subState, stage, shake]);

  const handleStart = () => {
    audioService.init();
    setGameState(GameState.PLAYING);
    setSubState(SubState.NONE);
    gameData.current.totalPoints = 0;
    gameData.current.quizzesServedCount = 0;
    setTotalPoints(0);
    if (canvasRef.current) initLevel(canvasRef.current.width, canvasRef.current.height);
  };

  const handleQuizAnswer = (index) => {
    if (index === QUIZ_DATA[currentQuizIndex].a) {
      audioService.playQuizCorrect();
      setGameState(GameState.GACHA);
      triggerGacha();
    } else {
      audioService.playQuizWrong();
      gameData.current.quizzesServedCount++;
      setPendingQuizCount(prev => Math.max(0, prev - 1));
      setGameState(GameState.PLAYING);
      setCurrentQuizIndex(Math.floor(Math.random() * QUIZ_DATA.length));
    }
  };

  const triggerGacha = () => {
    audioService.playGachaStart();
    setShake(40);
    setTimeout(() => {
      const uncollected = HISTORY_ITEMS.filter(item => !collection.includes(item.id));
      const chosen = uncollected.length > 0 
        ? uncollected[Math.floor(Math.random() * uncollected.length)]
        : HISTORY_ITEMS[Math.floor(Math.random() * HISTORY_ITEMS.length)];
      
      setLastGachaItem(chosen);
      const newCollection = Array.from(new Set([...collection, chosen.id]));
      setCollection(newCollection);
      audioService.playGachaReveal(chosen.rarity);
      setGachaCount(prev => prev + 1);
      gameData.current.quizzesServedCount++;
      setPendingQuizCount(prev => Math.max(0, prev - 1));
    }, 750);
  };

  const closeGacha = () => {
    setLastGachaItem(null);
    if (collection.length >= 50) {
      setGameState(GameState.ENDING);
      audioService.playEnding();
    } else if (pendingQuizCount > 0) {
      setCurrentQuizIndex(Math.floor(Math.random() * QUIZ_DATA.length));
      setGameState(GameState.QUIZ);
    } else if (gachaCount >= 5) {
      setSubState(SubState.STAGE_INTRO);
      setGameState(GameState.STAGECLEAR);
    } else {
      setGameState(GameState.PLAYING);
      setCurrentQuizIndex(Math.floor(Math.random() * QUIZ_DATA.length));
    }
  };

  return html`
    <div className="relative w-full h-full overflow-hidden text-white font-sans bg-slate-950 select-none touch-none">
      <canvas ref=${canvasRef} className="absolute inset-0 z-0" />

      ${/* UIオーバーレイ */''}
      ${gameState === GameState.PLAYING && subState === SubState.NONE && html`
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-xl p-3 px-5 rounded-2xl border border-white/10 shadow-2xl scale-90 origin-top-left">
            <div className="flex justify-between items-center mb-1">
              <div className="text-[10px] font-black tracking-widest text-blue-300">時空エネルギー</div>
              <div className="text-[10px] font-black">${totalPoints % 100}%</div>
            </div>
            <div className="w-48 h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5 p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_10px_#22d3ee]"
                style=${{ width: `${totalPoints % 100}%` }} 
              />
            </div>
            <div className="mt-1 flex justify-between items-center text-[9px] font-black text-blue-200">
               <span>累計歴史点: ${totalPoints}</span>
               ${pendingQuizCount > 0 && html`
                 <span className="text-amber-400 animate-pulse">📜 ミッション待機: ${pendingQuizCount}/5</span>
               `}
            </div>
            ${powerUp !== PowerUpType.NONE && html`
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm">
                  ${powerUp === PowerUpType.MAGNET ? '🧲' : powerUp === PowerUpType.GIANT ? '🍄' : '🌟'}
                </span>
                <div className="flex-1 h-1 bg-slate-700 rounded-full">
                  <div className="h-full bg-amber-400" style=${{ width: `${(powerUpTimer / POWERUP_DURATION) * 100}%` }} />
                </div>
              </div>
            `}
          </div>

          <div className="flex flex-col items-end gap-2 scale-90 origin-top-right">
            <div className="bg-black/80 backdrop-blur-xl p-3 px-5 rounded-2xl border border-white/10 text-right shadow-2xl">
              <div className="text-[9px] font-black tracking-widest text-pink-400 opacity-70">現在の時代</div>
              <div className="text-lg font-black">${STAGE_THEMES[stage % STAGE_THEMES.length].name}</div>
              <div className="text-[9px] font-bold mt-0.5 opacity-50">獲得遺物: ${collection.length}/50</div>
            </div>
            <button 
              onClick=${() => setGameState(GameState.COLLECTION)}
              className="pointer-events-auto bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 px-5 rounded-xl border border-white/10 shadow-xl transition-all flex items-center gap-2 group"
            >
              <span className="text-base group-hover:rotate-6 transition-transform">📖 歴史図鑑</span>
            </button>
          </div>
        </div>
      `}

      ${/* 静止説明画面 (クイズ導入) */''}
      ${subState === SubState.QUIZ_INTRO && html`
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50 p-6">
          <div className="text-center p-10 max-w-sm bg-slate-900 rounded-[40px] border-4 border-amber-500 shadow-2xl transform animate-scale-in">
             <div className="text-6xl mb-6">📜</div>
             <h2 className="text-3xl font-black mb-4 text-amber-400">歴史の試練</h2>
             <p className="text-base font-bold mb-8 opacity-80 leading-relaxed">
               時空エネルギーが溜まりました！<br/>
               歴史クイズに正解して、<br/>失われた遺物を回収しましょう。
             </p>
             <button 
               onClick=${() => {
                 setSubState(SubState.NONE);
                 setGameState(GameState.QUIZ);
               }}
               className="px-12 py-4 bg-amber-500 text-slate-950 text-xl font-black rounded-full hover:bg-amber-400 transition-all shadow-xl"
             >
               試練を開始する
             </button>
          </div>
        </div>
      `}

      ${/* タイトル画面 */''}
      ${gameState === GameState.TITLE && html`
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-50 p-6 text-center">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_#3b82f6_0%,_transparent_70%)]" />
          <h1 className="text-6xl md:text-8xl font-black mb-4 drop-shadow-[0_0_30px_rgba(59,130,246,0.5)] z-10 leading-none">
            <span className="text-rainbow">CHRONO</span><br/>
            <span className="text-rainbow">COLLECTOR</span>
          </h1>
          <p className="max-w-xs mb-10 text-base font-bold tracking-widest z-10 text-slate-400">
            時空の彼方に散った記憶を<br/>一つに束ね、未来を救え。
          </p>
          <button 
            onClick=${handleStart}
            className="z-10 px-12 py-5 bg-white text-slate-950 text-2xl font-black rounded-full shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:bg-slate-100 active:scale-95 transition-all"
          >
            冒険を始める
          </button>
        </div>
      `}

      ${/* クイズモーダル */''}
      ${gameState === GameState.QUIZ && subState === SubState.NONE && html`
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md z-50 p-6">
          <div className="bg-white p-8 rounded-[35px] w-full max-w-lg shadow-2xl border-t-8 border-blue-500">
            <div className="flex flex-col items-center gap-2 mb-6">
              <span className="bg-blue-600 text-white px-5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">HISTORICAL QUIZ</span>
              ${pendingQuizCount > 1 && html`
                <span className="text-blue-600 font-black text-[10px]">連続ミッション: 残り ${pendingQuizCount} 問</span>
              `}
            </div>
            <h2 className="text-xl md:text-2xl font-black mb-8 text-slate-900 text-center leading-snug">
              ${QUIZ_DATA[currentQuizIndex].q}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              ${QUIZ_DATA[currentQuizIndex].choices.map((choice, i) => html`
                <button
                  key=${i}
                  onClick=${() => handleQuizAnswer(i)}
                  className="p-4 text-base font-black bg-slate-100 hover:bg-blue-600 text-slate-800 hover:text-white rounded-2xl border border-slate-200 transition-all text-center shadow-sm active:scale-95"
                >
                  ${choice}
                </button>
              `)}
            </div>
          </div>
        </div>
      `}

      ${/* ガチャ結果 (コンパクト) */''}
      ${gameState === GameState.GACHA && html`
        <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-50">
          <div className="text-center animate-scale-in flex flex-col items-center">
            ${!lastGachaItem ? html`
              <div className="flex flex-col items-center">
                <div className="text-7xl animate-spin-slow mb-6 opacity-80">🌀</div>
                <h2 className="text-2xl font-black italic text-rainbow animate-pulse">遺物を回収中...</h2>
              </div>
            ` : html`
              <div className="bg-slate-900 p-8 rounded-[40px] border-2 border-white/20 flex flex-col items-center px-10 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                <div className="relative mb-6">
                  <div className="absolute inset-0 blur-2xl bg-white/10 animate-pulse" />
                  <div className="text-[100px] mb-2 filter drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-bounce relative z-10">
                    ${lastGachaItem.icon}
                  </div>
                  <div className=${`absolute -top-2 -right-4 px-4 py-1 rounded-full font-black text-xs shadow-xl border border-white z-20
                    ${lastGachaItem.rarity === 'SSR' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' : 
                      lastGachaItem.rarity === 'SR' ? 'bg-purple-600 text-white' : 
                      lastGachaItem.rarity === 'R' ? 'bg-blue-600 text-white' : 'bg-slate-600 text-white'}`}>
                    ${lastGachaItem.rarity}
                  </div>
                </div>
                <h3 className="text-3xl font-black mb-3 text-rainbow drop-shadow-lg">${lastGachaItem.name}</h3>
                <p className="max-w-xs text-xs font-bold opacity-70 mb-8 leading-relaxed text-center">
                  ${lastGachaItem.description}
                </p>
                <button 
                  onClick=${closeGacha}
                  className="px-10 py-4 bg-white text-slate-950 text-lg font-black rounded-full shadow-2xl hover:bg-slate-100 active:scale-90 transition-all"
                >
                   ${pendingQuizCount > 0 ? "次のミッションへ" : "冒険を再開する"}
                </button>
              </div>
            `}
          </div>
        </div>
      `}

      ${/* ステージクリア説明 */''}
      ${gameState === GameState.STAGECLEAR && html`
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95 backdrop-blur-3xl z-50 p-6">
          <div className="text-center p-10 max-w-sm bg-white/5 rounded-[50px] border border-white/10 shadow-2xl transform animate-scale-in">
            <div className="text-6xl mb-6">✨</div>
            <h2 className="text-4xl font-black mb-6 text-rainbow">時空同期完了</h2>
            <p className="text-lg font-bold mb-8 opacity-70">
              この時代の修復に成功しました！<br/>
              スコアを保持したまま、<br/>次なる時空へジャンプします。
            </p>
            <button 
              onClick=${() => {
                setStage(prev => prev + 1);
                setGachaCount(0);
                setSubState(SubState.NONE);
                setGameState(GameState.PLAYING);
              }}
              className="px-12 py-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-2xl font-black rounded-full shadow-2xl active:scale-95 transition-transform"
            >
              ワープを開始！
            </button>
          </div>
        </div>
      `}

      ${/* エンディング */''}
      ${gameState === GameState.ENDING && html`
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-[100] text-center p-8 overflow-y-auto">
          <div className="z-10 flex flex-col items-center max-w-lg">
            <div className="text-7xl mb-6 animate-bounce">🏛️</div>
            <h1 className="text-5xl font-black mb-4 text-rainbow drop-shadow-xl leading-none">GRAND<br/>CHRONO MASTER</h1>
            <h2 className="text-2xl font-black text-white/50 mb-10 tracking-[0.4em]">伝説の時空マスター</h2>
            <div className="grid grid-cols-10 gap-1.5 mb-10 p-4 bg-white/5 rounded-2xl backdrop-blur-sm">
              ${HISTORY_ITEMS.map(item => html`
                <span key=${item.id} className="text-base">${item.icon}</span>
              `)}
            </div>
            <p className="text-base font-bold text-slate-400 mb-12 leading-relaxed">
              全50種類の歴史的遺物をコンプリートしました！<br/>
              あなたは全ての時空を一つに繋ぎ合わせ、<br/>
              歴史の守護者として永遠に記憶されるでしょう。
            </p>
            <button 
              onClick=${() => window.location.reload()}
              className="px-14 py-6 bg-white text-black text-2xl font-black rounded-full shadow-2xl hover:scale-105"
            >
              もう一度冒険する
            </button>
          </div>
        </div>
      `}

      ${/* 図鑑UI */''}
      ${gameState === GameState.COLLECTION && html`
        <div className="absolute inset-0 bg-slate-950/98 backdrop-blur-3xl z-50 overflow-y-auto p-8 flex flex-col items-center">
          <div className="flex justify-between items-center mb-10 w-full max-w-4xl">
            <div>
              <h2 className="text-3xl font-black text-rainbow">時空博物館</h2>
              <div className="text-xs font-bold opacity-40 mt-1">アーカイブ数: ${collection.length} / 50</div>
            </div>
            <button 
              onClick=${() => setGameState(GameState.PLAYING)}
              className="bg-white/10 text-white px-6 py-2 rounded-xl font-black text-sm hover:bg-white/20 transition-all border border-white/10"
            >
              冒険に戻る
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full max-w-4xl pb-20">
            ${HISTORY_ITEMS.map((item) => {
              const isCollected = collection.includes(item.id);
              return html`
                <div 
                  key=${item.id}
                  className=${`relative p-5 rounded-[25px] border transition-all duration-300 group overflow-hidden
                    ${isCollected 
                      ? 'bg-white/5 border-white/10 shadow-lg scale-100 hover:scale-105' 
                      : 'bg-black/40 border-white/5 opacity-20 grayscale'}`}
                >
                  <div className="text-4xl mb-2 text-center group-hover:scale-110 transition-transform">
                    ${isCollected ? item.icon : '❓'}
                  </div>
                  <div className="text-[10px] font-black text-center truncate mb-1">
                    ${isCollected ? item.name : '未知の遺物'}
                  </div>
                  ${isCollected && html`
                    <div className="absolute inset-0 bg-slate-900/98 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 rounded-[25px] text-[8px] font-bold leading-relaxed text-center">
                      ${item.description}
                    </div>
                  `}
                </div>
              `;
            })}
          </div>
        </div>
      `}
    </div>
  `;
};

export default App;
