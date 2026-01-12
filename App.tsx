
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RefreshCcw, Home, Star, Trophy, Rocket, Cloud, Sparkles } from 'lucide-react';

/**
 * このアプリケーションはGemini API等の外部通信を一切使用しません。
 * 全ての計算、問題作成、音声生成はデバイス内（ローカル）で行われます。
 * そのため、Google Cloud等の利用料金は発生しません。
 */

enum GameState {
  START,
  READY,
  FLASHING,
  ANSWERING,
  RESULT
}

interface GameConfig {
  name: string;
  count: number;
  interval: number;
  maxValue: number;
  color: string;
  icon: string;
  message: string;
}

const DIFFICULTY_LEVELS: GameConfig[] = [
  { name: 'たまご級', count: 2, interval: 1200, maxValue: 5, color: 'bg-yellow-400', icon: '🥚', message: 'まずは 2つから！' },
  { name: 'ひよこ級', count: 3, interval: 1000, maxValue: 9, color: 'bg-green-400', icon: '🐤', message: '3つに ちょうせん！' },
  { name: 'うさぎ級', count: 5, interval: 800, maxValue: 9, color: 'bg-pink-400', icon: '🐰', message: 'どんどん いくよ！' },
  { name: 'くま級', count: 7, interval: 600, maxValue: 9, color: 'bg-orange-400', icon: '🐻', message: 'キミなら できる！' },
  { name: 'らいおん級', count: 10, interval: 400, maxValue: 15, color: 'bg-red-500', icon: '🦁', message: 'あんざんマスター！' },
];

const PRAISE_MESSAGES = ["すごすぎる！", "てんさい！", "かんぺき！", "そのちょうし！", "きらきら！", "かっこいい！"];

const playTone = (freq: number, type: OscillatorType, duration: number, volume: number = 0.1) => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn("Audio Context failed", e);
  }
};

const sounds = {
  flash: () => playTone(880, 'sine', 0.1, 0.05),
  click: () => playTone(440, 'triangle', 0.05, 0.05),
  correct: () => {
    playTone(523.25, 'sine', 0.4, 0.1);
    setTimeout(() => playTone(659.25, 'sine', 0.4, 0.1), 100);
    setTimeout(() => playTone(783.99, 'sine', 0.4, 0.1), 200);
    setTimeout(() => playTone(1046.5, 'sine', 0.6, 0.1), 300);
  },
  wrong: () => {
    playTone(220, 'sawtooth', 0.3, 0.05);
    setTimeout(() => playTone(180, 'sawtooth', 0.3, 0.05), 150);
  },
  start: () => playTone(587.33, 'sine', 0.2, 0.1),
};

const NumberButton: React.FC<{ value: string; onClick: (v: string) => void; color?: string }> = ({ value, onClick, color = "bg-white" }) => (
  <button
    onClick={() => { sounds.click(); onClick(value); }}
    className={`w-20 h-20 sm:w-28 sm:h-28 m-1 sm:m-2 ${color} rounded-[32px] shadow-[0_10px_0_#CBD5E1] active:shadow-none active:translate-y-[10px] text-4xl sm:text-5xl font-black flex items-center justify-center transition-all border-4 border-slate-100 text-slate-700`}
  >
    {value}
  </button>
);

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [config, setConfig] = useState<GameConfig>(DIFFICULTY_LEVELS[0]);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [correctAnswer, setCorrectAnswer] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [praise, setPraise] = useState("");
  const flashTimerRef = useRef<number | null>(null);

  const startGame = useCallback(() => {
    sounds.start();
    const newNumbers = Array.from({ length: config.count }, () => 
      Math.floor(Math.random() * config.maxValue) + 1
    );
    setNumbers(newNumbers);
    setCorrectAnswer(newNumbers.reduce((a, b) => a + b, 0));
    setGameState(GameState.READY);
    setUserAnswer('');
  }, [config]);

  useEffect(() => {
    if (gameState === GameState.FLASHING) {
      let idx = 0;
      setCurrentIndex(0);
      sounds.flash();
      flashTimerRef.current = window.setInterval(() => {
        idx++;
        if (idx < numbers.length) {
          setCurrentIndex(idx);
          sounds.flash();
        } else {
          if (flashTimerRef.current) clearInterval(flashTimerRef.current);
          setTimeout(() => {
            setGameState(GameState.ANSWERING);
            setCurrentIndex(-1);
          }, config.interval);
        }
      }, config.interval);
      return () => { if (flashTimerRef.current) clearInterval(flashTimerRef.current); };
    }
  }, [gameState, numbers, config.interval]);

  const handleNumClick = (val: string) => {
    if (val === 'C') setUserAnswer('');
    else if (userAnswer.length < 3) setUserAnswer(prev => prev + val);
  };

  const checkAnswer = () => {
    const isCorrect = parseInt(userAnswer) === correctAnswer;
    if (isCorrect) {
      sounds.correct();
      setScore(s => s + (config.count * 10) + (streak * 5));
      setStreak(s => s + 1);
      setPraise(PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)]);
    } else {
      sounds.wrong();
      setStreak(0);
      setPraise("おしかったね！");
    }
    setGameState(GameState.RESULT);
  };

  const progress = currentIndex >= 0 ? ((currentIndex + 1) / numbers.length) * 100 : 0;

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-12 relative overflow-hidden bg-[#3ABFF8]">
      <Cloud className="absolute top-10 left-10 text-white/40 w-32 h-32 animate-floating" />
      <Cloud className="absolute bottom-20 right-10 text-white/40 w-48 h-48 animate-floating" style={{ animationDelay: '1s' }} />
      <Star className="absolute top-20 right-20 text-yellow-200 w-16 h-16 animate-pulse" fill="currentColor" />
      <Rocket className="absolute bottom-10 left-10 text-red-400 w-24 h-24 -rotate-45 animate-floating" />

      {gameState === GameState.START && (
        <div className="text-center animate-pop-in max-w-6xl w-full z-10 px-4 landscape-compact">
          <div className="bg-orange-500 text-white px-10 py-2 rounded-full inline-block font-black text-xl lg:text-2xl mb-4 shadow-lg border-b-4 border-orange-700">小学校1年生向け</div>
          
          <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black text-yellow-400 mb-6 lg:mb-10 text-outline tracking-tight leading-[1.1] flex flex-wrap justify-center gap-x-6">
            <span className="inline-block whitespace-nowrap">フラッシュ</span>
            <span className="inline-block whitespace-nowrap">暗算</span>
            <span className="inline-block whitespace-nowrap">キッズ！</span>
          </h1>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6 mb-8 lg:mb-14 px-2">
            {DIFFICULTY_LEVELS.map((level) => (
              <button key={level.name} onClick={() => { sounds.click(); setConfig(level); }}
                className={`p-4 sm:p-6 rounded-[32px] text-white font-black text-lg sm:text-xl shadow-xl transition-all transform hover:scale-105 active:scale-95 border-b-[8px] border-black/20 ${level.color} ${config.name === level.name ? 'ring-[8px] ring-white scale-105' : 'opacity-80'}`}
              >
                <div className="text-4xl sm:text-5xl mb-1">{level.icon}</div>
                <div className="whitespace-nowrap">{level.name}</div>
              </button>
            ))}
          </div>
          <button onClick={startGame} className="group relative w-full max-w-lg mx-auto bg-green-500 hover:bg-green-400 text-white font-black text-4xl lg:text-6xl py-8 lg:py-10 rounded-[60px] shadow-[0_15px_0_#166534] active:shadow-none active:translate-y-4 transition-all flex items-center justify-center gap-6 lg:gap-8">
            <Play size={56} fill="white" strokeWidth={3} />
            <span>あそぶ！</span>
          </button>
        </div>
      )}

      {gameState === GameState.READY && (
        <div className="text-center animate-pop-in z-10 landscape-compact">
          <div className="bg-white px-12 py-5 rounded-full shadow-2xl mb-12 border-4 border-blue-400">
            <span className="text-3xl sm:text-4xl font-black text-blue-500">{config.message}</span>
          </div>
          <h2 className="text-[120px] sm:text-[180px] font-black text-white text-outline-dark mb-16 italic leading-none">Ready?</h2>
          <button onClick={() => { sounds.click(); setGameState(GameState.FLASHING); }} className="bg-red-500 hover:bg-red-400 text-white text-6xl sm:text-8xl font-black px-24 py-10 rounded-[60px] shadow-[0_15px_0_#991b1b] active:shadow-none active:translate-y-4 transition-all">GO!!</button>
        </div>
      )}

      {gameState === GameState.FLASHING && (
        <div className="flex flex-col items-center justify-center w-full z-10">
          <div className="relative">
            <div className="absolute inset-0 bg-white/30 blur-[100px] rounded-full scale-150 animate-pulse" />
            <div className={`text-[350px] sm:text-[500px] lg:text-[650px] font-black tabular-nums leading-none relative z-10 text-outline drop-shadow-[0_20px_0_rgba(0,0,0,0.1)] transition-transform duration-100 ${currentIndex % 3 === 0 ? 'text-orange-400' : currentIndex % 3 === 1 ? 'text-green-400' : 'text-blue-400'}`}>
              {currentIndex >= 0 ? numbers[currentIndex] : ''}
            </div>
          </div>
          <div className="fixed bottom-12 w-full max-w-2xl px-12">
            <div className="relative h-16 bg-white/20 rounded-full border-4 border-white/50 backdrop-blur-xl shadow-2xl overflow-hidden p-2">
              <div className="h-full bg-gradient-to-r from-green-400 to-yellow-300 rounded-full transition-all duration-300 ease-out relative shadow-inner" style={{ width: `${progress}%` }}>
                {progress > 0 && <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2"><Star className="text-white fill-white animate-spin-slow" size={40} /></div>}
              </div>
            </div>
            <div className="text-center mt-4 text-white font-black text-2xl text-outline-dark tracking-widest opacity-80">{currentIndex + 1} / {numbers.length}</div>
          </div>
        </div>
      )}

      {gameState === GameState.ANSWERING && (
        <div className="w-full max-w-6xl animate-pop-in flex flex-col landscape:flex-row items-center justify-center gap-10 lg:gap-20 z-10 px-4 landscape-compact">
          <div className="flex flex-col items-center">
            <div className="mb-10 text-4xl sm:text-5xl font-black text-white text-outline-dark bg-yellow-400 px-16 py-6 rounded-[50px] shadow-xl border-b-8 border-yellow-600 rotate-1">ぜんぶで いくつ？</div>
            <div className="w-80 h-40 sm:w-[450px] sm:h-52 bg-white rounded-[60px] border-[12px] border-blue-400 flex items-center justify-center text-[120px] font-black text-blue-600 shadow-[inset_0_10px_25px_rgba(0,0,0,0.15)]">{userAnswer || <span className="text-blue-100 italic">?</span>}</div>
          </div>
          <div className="bg-white/40 p-6 sm:p-10 rounded-[60px] backdrop-blur-md border-4 border-white/50 shadow-2xl">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0'].map((btn) => (
                <NumberButton key={btn} value={btn} onClick={handleNumClick} color={btn === 'C' ? 'bg-red-50' : 'bg-white'} />
              ))}
              <button onClick={() => { sounds.click(); checkAnswer(); }} disabled={!userAnswer} className={`w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 m-1 rounded-[32px] shadow-[0_10px_0_#166534] text-white font-black flex items-center justify-center text-4xl transition-all border-4 border-white ${userAnswer ? 'bg-green-500 hover:bg-green-400 active:translate-y-3 active:shadow-none' : 'bg-gray-400 shadow-[0_10px_0_#334155] cursor-not-allowed opacity-50'}`}>OK!</button>
            </div>
          </div>
        </div>
      )}

      {gameState === GameState.RESULT && (
        <div className="w-full max-w-7xl animate-pop-in z-10 px-4 landscape-compact">
          <div className="bg-white p-10 lg:p-16 rounded-[80px] shadow-2xl border-[15px] border-yellow-300 flex flex-col landscape:flex-row gap-12 items-center relative">
            <div className="absolute -top-16 left-1/2 landscape:left-1/4 -translate-x-1/2 scale-[2.2]">
              {parseInt(userAnswer) === correctAnswer ? (
                <div className="bg-yellow-400 p-4 rounded-full shadow-2xl border-4 border-white"><Trophy size={48} className="text-white animate-bounce" /></div>
              ) : (
                <div className="bg-blue-100 p-4 rounded-full shadow-2xl border-4 border-white text-5xl">🌈</div>
              )}
            </div>
            <div className="flex-1 text-center landscape:text-left mt-10 landscape:mt-0">
              <h2 className={`text-6xl lg:text-8xl font-black mb-8 italic tracking-tighter ${parseInt(userAnswer) === correctAnswer ? 'text-green-500' : 'text-blue-500'}`}>{praise}</h2>
              {streak > 1 && parseInt(userAnswer) === correctAnswer && <div className="mb-8 bg-orange-100 text-orange-600 font-black px-10 py-4 rounded-full inline-flex items-center gap-4 animate-bounce text-2xl"><Sparkles size={32} /> {streak}かい れんぞく せいかい！</div>}
              <div className="space-y-6 bg-blue-50 p-10 rounded-[50px] border-4 border-blue-100">
                <div className="flex justify-between items-center gap-10">
                  <span className="text-blue-400 font-black text-3xl italic">せいかい</span>
                  <span className="font-black text-8xl text-green-500 text-outline leading-none">{correctAnswer}</span>
                </div>
                <div className="h-1.5 bg-blue-200 w-full rounded-full" />
                <div className="flex justify-between items-center gap-10">
                  <span className="text-blue-400 font-black text-3xl italic">きみの答え</span>
                  <span className="font-black text-8xl text-blue-600 text-outline leading-none">{userAnswer}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-6 w-full landscape:w-80">
              <button onClick={startGame} className="bg-orange-500 hover:bg-orange-400 text-white font-black py-8 rounded-[45px] flex flex-col items-center justify-center gap-3 shadow-[0_12px_0_#9a3412] active:shadow-none active:translate-y-3 transition-all border-4 border-orange-200"><RefreshCcw size={56} /><span className="text-3xl">もう一回！</span></button>
              <button onClick={() => { sounds.click(); setGameState(GameState.START); }} className="bg-blue-500 hover:bg-blue-400 text-white font-black py-8 rounded-[45px] flex flex-col items-center justify-center gap-3 shadow-[0_12px_0_#1e40af] active:shadow-none active:translate-y-3 transition-all border-4 border-blue-200"><Home size={56} /><span className="text-3xl">おわる</span></button>
            </div>
          </div>
        </div>
      )}

      {gameState !== GameState.START && (
        <div className="fixed top-8 left-10 right-10 flex justify-between items-start z-50 animate-pop-in">
          <div className="bg-white/95 backdrop-blur-md px-10 py-5 rounded-[45px] shadow-2xl border-4 border-yellow-300 flex items-center gap-5">
            <div className="bg-yellow-400 p-4 rounded-2xl shadow-inner"><Star className="text-white fill-white" size={36} /></div>
            <span className="font-black text-5xl text-blue-600 tabular-nums">{score}</span>
          </div>
          {gameState !== GameState.FLASHING && (
            <div className={`text-white px-10 py-6 rounded-[45px] shadow-2xl font-black text-3xl border-b-[10px] border-black/20 transform rotate-2 ${config.color} flex items-center gap-5`}>
              <span className="text-5xl">{config.icon}</span> 
              <span className="landscape:inline hidden">{config.name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
