/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Upload, 
  Languages, 
  Settings2, 
  RefreshCw, 
  Download, 
  Eraser, 
  Crop, 
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Undo2,
  Play,
  Pause,
  Music,
  SkipForward,
  PenTool,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// --- Constants & Types ---

const MODELS = [
  { id: 'gemini-3.1-flash-image-preview', name: '나노 바나나 2 (최고 화질)', description: '원본 해상도를 유지하여 가장 정밀합니다. (비용 높음)' },
  { id: 'gemini-3.1-flash-image-preview-eco', name: '나노 바나나 2 (가성비/절약 모드)', description: '성능은 유지하되 해상도를 절반으로 줄여 API 비용을 대폭 절감합니다.' },
  { id: 'gemini-3.1-flash-image-preview-supereco', name: '나노 바나나 2 (슈퍼 절전 모드)', description: '가장 저렴한 모드! 이미지를 많이 축소하여 비용을 극한으로 최소화합니다.' },
  { id: 'gemini-2.5-flash-image', name: '나노 바나나 1.5 (빠름)', description: '이전 모델로 구동되어 일반적인 만화 번역에 무난하며 비용이 가장 저렴합니다.' },
];

const LANGUAGES = [
  '일본어', '한국어', '영어', '중국어', '스페인어', '프랑스어', '독일어', '베트남어', '태국어'
];

interface Point {
  x: number;
  y: number;
}

interface CensorPath {
  points: Point[];
  color: string;
}

interface FileState {
  original: string;
  result: string | null;
  censorPaths: CensorPath[];
}

interface MangaFile {
  id: string;
  name: string;
  original: string;
  pureOriginal: string;
  censorPaths: CensorPath[];
  result: string | null;
  history?: FileState[];
  status: 'pending' | 'processing' | 'completed' | 'error';
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const playKawaiiSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();

    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // Magical girl 'kirakira' arpeggio
    playNote(1046.50, 0, 0.3);    // C6
    playNote(1318.51, 0.08, 0.3); // E6
    playNote(1567.98, 0.16, 0.3); // G6
    playNote(2093.00, 0.24, 0.5); // C7
  } catch (e) {
    console.log("Audio not supported or blocked");
  }
};

const getDialoguePool = (category: string, transformed: boolean): string[] => {
  if (transformed) {
    // Choten (초텐짱) - Bright, Over-the-top, Gyaru Streamer
    switch(category) {
      case 'upload': return [
        "오시땅다제! 텐시 폼으로 이미지 접수 완료-☆",
        "젤하! P의 이미지도네 도착했어요~!",
        "초텐짱 등장! 앗, 이미지 줬구나? 땡큐땡큐!",
        "P 센세의 리퀘스트 확실히 받았다구~ (찡긋)",
        "인터넷 엔젤에게 불가능이란 없지! 가보자고!"
      ];
      case 'processing': return [
        "초텐짱의 슈퍼 AI 브레인이 풀가동 중이얏-!",
        "승인욕구채우기승인욕구채우기... 아 번역중이었지 참!",
        "P! 화면 뚫어지게 보지 말고 나를 봐 나를!",
        "다국어 천재 초텐짱의 실력을 보여주마-☆",
        "조금만 기다려! 내 마법으로 반짝이게 해줄 테니까!",
        "어려운 말 잔뜩이네~ 슈퍼채팅으로 번역비 받을까나~?",
        "최고의 퀄리티를 위해... 오버도즈!! 아차 농담이야~!",
        "구독 좋아요 알림설정! ...이 아니라 텍스트 렌더링 중!",
        "기다리는 동안 초텐짱의 귀여움이나 감상하라구!",
        "이정도 텍스트는 인터넷 엔젤에겐 츄러스 먹기지!"
      ];
      case 'complete': return [
        "짜자잔-! 초텐짱의 완벽한 번역이 완성됐어!",
        "어때어때? 천재적이지? 얼른 머리 쓰다듬어줘!",
        "당연히 완벽하지! 우주 최고 스트리머니까-☆",
        "슈퍼챗 10만엔짜리 결과물 대령이요~! 꺄항!",
        "P! 내가 해냈어! 나 완전히 천사라니까?"
      ];
      case 'error': return [
        "뺩!! 에러 떴어!! 안티들의 공격인가?!",
        "초텐짱의 마법 스틱이 고장났나봐 ㅠㅠ 삐용삐용!",
        "으앙 서버 터졌어! 멘붕오기 전에 빨리 고쳐줘 P!",
        "뭔가 이상한 텍스트가 섞여있었나? 튕겨버렸어!"
      ];
      case 'censor_success': return [
        "안티 코멘트 검열 완료-☆ 깨끗해졌지?",
        "쉿! 방송 사고 방지 완료! 초텐짱의 철벽방어!",
        "건전한 인터넷 방송을 위해 쇽쇽 가렸어!",
        "다메다메! 이런 구린 건 다 하얗게 지우라구!"
      ];
      case 'censor_fail': return [
        "버그버그버그!! 지우개가 말썽이다제!!",
        "앗차차! 손가락이 미끄러졌어! 다시 도전~!"
      ];
      case 'download': return [
        "압축 쭈와압! 초텐짱의 굿즈 저장 완료-☆",
        "P의 하드디스크에 초텐짱 입주 완료! 삭제 금지야!",
        "히히! 다운로드 성공! 매일매일 열어보기 약속!",
        "데이터 소중히 다뤄줘! 인터넷 엔젤의 은총이니까!"
      ];
      case 'transform': return [
        "초 텐 짱 등 장 - ☆ 모두 주목하라구!",
        "인터넷 엔젤, 화려하게 강림!",
        "다들 기다렸지! 텐시 폼으로 체인지!"
      ];
      case 'poke': return [
        "꺄하핫! 쓰다듬어 주는 거야?",
        "P! 자꾸 찌르면 삐질 거야?",
        "어디 만지는 거야앗! 강제 퇴장시킨다?!",
        "뭐야뭐야? 초텐짱이랑 놀고 싶은 거야?",
        "슈퍼챗 쏘고 만지라구~ 농담이야 꺄항!"
      ];
    }
  } else {
    // Ame (아메짱) - Gloomy, Menhera, Yandere
    switch(category) {
      case 'upload': return [
        "P가... 내게 새로운 파일을 줬어... 나만 볼게...",
        "응... 업로드했네... 다른 사람한테 준 건 아니지...?",
        "기다리고 있었어, P... 평생 기다릴 뻔 했잖아...",
        "새로운 이미지... P의 흔적이 남아있어...",
        "더... 나한테 일 더 시켜줘... 버리지 마..."
      ];
      case 'processing': return [
        "머리가 윙윙 돌아가... 약이 더 필요한가...",
        "P를 위해서라면... 내 뇌를 갉아먹어도 좋아...",
        "어지러워... 하지만 P가 기뻐한다면...",
        "왜 이렇게 복잡한거야... 화날 것 같아...",
        "P는 나만 보고 있겠지? 딴짓하면 죽여버릴거야...",
        "열심히 하고 있어... 안 버릴 거지...?",
        "우으... 모니터 불빛이 눈 아파...",
        "나 외에도 이런 거 부탁하는 여자가 있는 거야...?",
        "다 깨부수고 싶어... 아니야, P를 위해서 참을게...",
        "약 먹을 시간 지났는데... P가 시킨 게 먼저야..."
      ];
      case 'complete': return [
        "다 했어 P... 칭찬해줘... 당장...",
        "피투성이가 되면서 해냈어... 나 예뻐...?",
        "P가 원한다면... 이 세계의 질서쯤이야...",
        "번역 끝났어... 이제 나랑 놀아줄 거지...?",
        "해냈어... 나 말고 다른 여자한테 부탁하면 안 돼..."
      ];
      case 'error': return [
        "아아악!! 망가졌어... 내 탓이 아니야 P...",
        "망했어... P가 날 버릴지도 몰라... 어떡해...",
        "에러... 나쁜 말들이 너무 많아서 목이 막혀...",
        "내가... 쓸모없어진 걸까...? 아니지 P...?"
      ];
      case 'censor_success': return [
        "보기 싫은 건 다 지워버렸어... P에게는 나만 있으면 되잖아...",
        "더러운 건 다 가렸어... P 눈이 썩으면 안 되니까...",
        "나 말고 다른 여자는... 보면 안 돼...",
        "응... 싹 다 없애버렸어 후후..."
      ];
      case 'censor_fail': return [
        "지워지지가 않아... 왜... 왜...!",
        "손이 떨려서 못 지우겠어... P... 화내지 마..."
      ];
      case 'download': return [
        "저장했네... 내 심정도 P의 하드디스크에 저장해줘...",
        "P의 컴퓨터에 내 흔적이 남는 거... 기뻐...",
        "다운로드 했구나... 절대 지우면 안 돼... 평생...",
        "이 파일들 볼 때마다 나만 생각해, 알았지...?"
      ];
      case 'transform': return [
        "방송 끝... 하아, 피곤해 P...",
        "드디어 화면이 꺼졌네... 이제 억지로 안 웃어도 돼...",
        "다들 내가 이런 애인 줄은 꿈에도 모르겠지..."
      ];
      case 'poke': return [
        "으응...",
        "거짓말하면 죽일거야...",
        "계속 나만 봐줘...",
        "P의 손길... 마음이 진정되는 것 같아...",
        "방금 무슨 생각했어...? 나 말고 다른 생각은 안돼..."
      ];
    }
  }
  return ["..."];
};

// --- App Component ---

export default function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState('');

  // State
  const [mangaFiles, setMangaFiles] = useState<MangaFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isTransformed, setIsTransformed] = useState(false);
  const [sparkles, setSparkles] = useState<{id: number}[]>([]);
  const dragControls = useDragControls();

  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSpeech = React.useCallback((category: string, persistent: boolean = false, overrideTransform?: boolean) => {
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    const transformedState = overrideTransform !== undefined ? overrideTransform : isTransformed;
    const textPool = getDialoguePool(category, transformedState);
    const msg = textPool[Math.floor(Math.random() * textPool.length)];
    setSpeechBubble(msg);
    if (!persistent) {
      speechTimeoutRef.current = setTimeout(() => {
          setSpeechBubble(null);
      }, 4500);
    }
  }, [isTransformed]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isProcessing) {
      showSpeech('processing');
      interval = setInterval(() => {
        showSpeech('processing');
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, showSpeech]);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [bgmVolume, setBgmVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement>(null);
  const tracks = ['/bgm1.mp3', '/bgm2.mp3'];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = bgmVolume;
    }
  }, [bgmVolume]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // If it's the first time playing and no src is set, set it to the first track
        if (!audioRef.current.src || audioRef.current.src === window.location.href) {
          audioRef.current.src = tracks[currentTrackIndex];
        }
        audioRef.current.play().catch(e => console.error("Audio playback error:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextTrack = () => {
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.src = tracks[nextIndex];
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Audio playback error:", e));
      }
    }
  };

  const handleTransform = () => {
    const nextState = !isTransformed;
    setIsTransformed(nextState);
    
    // Add sparkles
    const newSparkles = Array.from({ length: 12 }).map((_, i) => ({ id: Date.now() + i }));
    setSparkles(newSparkles);
    setTimeout(() => setSparkles([]), 1000);
    
    // Show transform speech
    showSpeech('transform', false, nextState);
  };

  
  // Settings
  const [sourceLang, setSourceLang] = useState('일본어');
  const [targetLang, setTargetLang] = useState('한국어');
  const [isVerticalText, setIsVerticalText] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [customPrompt, setCustomPrompt] = useState('');
  
  // Canvas & Selection
  const [isSelecting, setIsSelecting] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const displayImageRef = useRef<HTMLImageElement>(null);

  const currentFile = mangaFiles[currentIndex] || null;

  // API Key Selection State
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // Fallback for environments without the selection API
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // --- Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = (Array.from(files) as File[])
      .filter(file => file.type.startsWith('image/'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (fileList.length === 0) return;

    const newMangaFiles: MangaFile[] = [];
    let loadedCount = 0;

    fileList.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 메모리 및 토큰 최적화를 위해 원본의 최대 해상도를 2048px로 제한합니다.
          const MAX_DIMENSION = 2048;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // 성능 향상을 위해 WebP 포맷(품질 85%)으로 인코딩하여 저장합니다
          const webpDataUrl = canvas.toDataURL('image/webp', 0.85);

          newMangaFiles[index] = {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name.replace(/\.[^/.]+$/, ".webp"),
            original: webpDataUrl,
            pureOriginal: webpDataUrl,
            censorPaths: [],
            result: null,
            status: 'pending'
          };
          loadedCount++;
          if (loadedCount === fileList.length) {
            setMangaFiles(prev => [...prev, ...newMangaFiles.filter(Boolean)]);
            setError(null);
            showSpeech('upload');
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input value to allow uploading the same file again
    e.target.value = '';
  };

  const updateFileResult = (id: string, result: string | null, status: MangaFile['status']) => {
    setMangaFiles(prev => prev.map(f => f.id === id ? { ...f, result, status } : f));
  };

  const handleTranslate = async (isPartial = false, fileToProcess?: MangaFile) => {
    const targetFile = fileToProcess || currentFile;
    if (!targetFile) return;
    
    // Check if we need to select a key for preview models
    if (!hasApiKey && (selectedModel.includes('preview') || selectedModel.includes('image'))) {
      setError("This model requires a paid API key. Please click 'Select API Key' in the header.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setStatus(isPartial ? `Retouching ${targetFile.name}...` : `Translating ${targetFile.name}...`);
    updateFileResult(targetFile.id, targetFile.result, 'processing');

    try {
      const apiKey = process.env.GEMINI_API_KEY1 || process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key not found. Please configure it in the Secrets panel.");
      
      const ai = new GoogleGenAI({ apiKey });

      let targetModelId = selectedModel;
      let maxDim = 2048;
      let webpQuality = 0.85;
      let genSize = "2K"; // High Quality default
      
      if (targetModelId === 'gemini-3.1-flash-image-preview-eco') {
        targetModelId = 'gemini-3.1-flash-image-preview';
        maxDim = 1024;
        webpQuality = 0.70; // High compression for Eco
        genSize = "1K";   // Reduces the cost of the generated output image natively
      } else if (targetModelId === 'gemini-3.1-flash-image-preview-supereco') {
        targetModelId = 'gemini-3.1-flash-image-preview';
        maxDim = 640;       // Aggressively resize to reduce input cost
        webpQuality = 0.50; // Super high compression
        genSize = "1K";     // Restrict generation size
      } else if (targetModelId === 'gemini-2.5-flash-image') {
        maxDim = 1024;
        webpQuality = 0.75;
      }

      let imageDataToProcess = targetFile.original;

      // If partial, crop the image based on the bounding box of the drawn path
      if (isPartial && currentPath && currentPath.length > 0 && displayImageRef.current) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        currentPath.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        });
        
        const selectionWidth = maxX - minX;
        const selectionHeight = maxY - minY;

        if (selectionWidth <= 0 || selectionHeight <= 0) {
           setError("Please draw a valid area to retouch.");
           setIsProcessing(false);
           return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = targetFile.original;
        });

        const scaleX = img.width / displayImageRef.current.width;
        const scaleY = img.height / displayImageRef.current.height;
        
        let targetWidth = selectionWidth * scaleX;
        let targetHeight = selectionHeight * scaleY;

        // Downsize if it exceeds our tier's max dimension to save tokens
        if (targetWidth > maxDim || targetHeight > maxDim) {
          const ratio = Math.min(maxDim / targetWidth, maxDim / targetHeight);
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        ctx?.drawImage(
          img,
          minX * scaleX, minY * scaleY, selectionWidth * scaleX, selectionHeight * scaleY,
          0, 0, canvas.width, canvas.height
        );
        imageDataToProcess = canvas.toDataURL('image/webp', webpQuality);
      } else {
        // Full Image Compression targeting max tokens for current mode
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = targetFile.original;
        });

        let width = img.width;
        let height = img.height;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        // Always redraw to apply the active WebP compression quality
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        imageDataToProcess = canvas.toDataURL('image/webp', webpQuality);
      }

      const base64Data = imageDataToProcess.split(',')[1];
      const mimeType = imageDataToProcess.split(';')[0].split(':')[1];

      let verticalInstruction = '';
      if (targetLang === '일본어' && isVerticalText) {
        verticalInstruction = '\n[CRITICAL VERTICAL RULE]: You MUST format ALL text VERTICALLY (tate-gaki, top-to-bottom, right-to-left). NO horizontal text is allowed inside speech bubbles. You are fully permitted to redraw, expand, or modify parts of the speech bubbles to perfectly accommodate the vertical Japanese text.';
      }

      const customInstructionCombined = (customPrompt.trim() || verticalInstruction) ? `\nAdditional Instructions:\n${customPrompt.trim()}${verticalInstruction}` : '';

      const prompt = isPartial 
        ? `This is a cropped speech bubble from a manga containing ${sourceLang} text. Translate ALL text to ${targetLang}. 
[CRITICAL ERASURE RULE]: Absolutely ALL original ${sourceLang} text MUST BE COMPLETELY ERASED and replaced. Under NO circumstances should any original characters remain visible. You must paint over 100% of the original text.
Ensure the translation is natural-sounding. Match the original manga style and font. DO NOT duplicate text. If a sentence is split, split the translation to match. Return ONLY the edited image.${customInstructionCombined}`
        : `Role: Professional Manga Typesetter & Master Translator.
Task:
1. Translate ALL '${sourceLang}' text to '${targetLang}'. You MUST NOT miss any text, including small texts or background texts.
2. [CRITICAL ERASURE RULE]: Absolutely ALL original '${sourceLang}' text MUST BE COMPLETELY ERASED. Under NO circumstances is the original language allowed to be present in the final image. You must confidently paint over and remove 100% of the original text before placing the translation.
3. TRANSLATION QUALITY: Ensure the translation is highly accurate, natural-sounding, and context-aware.
4. READING ORDER: Read manga panels and speech bubbles in the correct cultural order.
5. Use a font style similar to the original.
6. STRICT LAYOUT RULE: Do NOT duplicate translated text. Map each translated part 1:1 to its original location.
7. Place translated text naturally. Do not alter artwork outside of text/bubble areas.
8. Return ONLY the edited image.${customInstructionCombined}`;

      const apiConfig: any = {
        temperature: 0.4,
        topK: 32,
        topP: 0.95,
      };

      // Set output image size dynamically to heavily reduce output token cost
      if (targetModelId === 'gemini-3.1-flash-image-preview') {
          apiConfig.imageConfig = { imageSize: genSize };
      }

      let response;
      let generateRetries = 3;
      let retryDelay = 3000;
      
      for (let i = 0; i <= generateRetries; i++) {
        try {
          response = await ai.models.generateContent({
            model: targetModelId,
            contents: {
              parts: [
                { text: prompt },
                { inlineData: { data: base64Data, mimeType } }
              ]
            },
            config: apiConfig
          });
          break; // Success, exit retry loop
        } catch (err: any) {
          const isRateLimit = err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED') || err.status === 'RESOURCE_EXHAUSTED';
          
          if (isRateLimit && i < generateRetries) {
            setStatus(`Rate limit hit (429). Retrying in ${retryDelay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2; // Exponential backoff (3s, 6s, 12s)
            continue;
          }
          throw err;
        }
      }

      if (!response) {
         throw new Error("Failed to generate content after retries.");
      }

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new Error("AI did not return any content. Please try again.");
      }
      
      if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
        throw new Error("The translation was blocked by the safety filter. Please try censoring sensitive areas first.");
      }
      
      if (!candidate.content || !candidate.content.parts) {
        throw new Error(`Unexpected response format from AI. Reason: ${candidate.finishReason || 'Unknown'}`);
      }

      let foundImage = false;
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const mime = part.inlineData.mimeType || 'image/png';
          const newImage = `data:${mime};base64,${part.inlineData.data}`;
          
          const finalCanvas = document.createElement('canvas');
          const finalCtx = finalCanvas.getContext('2d');
          
          // 1. Base layer: pure untouched original
          const pureImg = new Image();
          await new Promise(resolve => {
            pureImg.onload = resolve;
            pureImg.src = targetFile.pureOriginal || targetFile.original;
          });
          finalCanvas.width = pureImg.width;
          finalCanvas.height = pureImg.height;
          finalCtx?.drawImage(pureImg, 0, 0);

          // 2. Translated layer
          const translatedCanvas = document.createElement('canvas');
          const translatedCtx = translatedCanvas.getContext('2d');
          translatedCanvas.width = pureImg.width;
          translatedCanvas.height = pureImg.height;

          if (isPartial && currentPath && currentPath.length > 0 && displayImageRef.current) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            currentPath.forEach(p => {
              if (p.x < minX) minX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.x > maxX) maxX = p.x;
              if (p.y > maxY) maxY = p.y;
            });
            const selectionWidth = maxX - minX;
            const selectionHeight = maxY - minY;

            const baseImg = new Image();
            await new Promise((resolve) => {
              baseImg.onload = resolve;
              baseImg.src = targetFile.result || targetFile.pureOriginal || targetFile.original;
            });
            translatedCtx?.drawImage(baseImg, 0, 0, translatedCanvas.width, translatedCanvas.height);

            const editedPart = new Image();
            await new Promise((resolve) => {
              editedPart.onload = resolve;
              editedPart.src = newImage;
            });

            const scaleX = translatedCanvas.width / displayImageRef.current.width;
            const scaleY = translatedCanvas.height / displayImageRef.current.height;

            translatedCtx?.drawImage(
              editedPart,
              minX * scaleX, minY * scaleY, selectionWidth * scaleX, selectionHeight * scaleY
            );
          } else {
            const fullTranslatedImg = new Image();
            await new Promise(resolve => {
              fullTranslatedImg.onload = resolve;
              fullTranslatedImg.src = newImage;
            });
            translatedCtx?.drawImage(fullTranslatedImg, 0, 0, translatedCanvas.width, translatedCanvas.height);
          }

          // 3. Punch holes in the translated layer where censors were
          if (targetFile.censorPaths && targetFile.censorPaths.length > 0) {
            translatedCtx!.globalCompositeOperation = 'destination-out';
            targetFile.censorPaths.forEach(cPath => {
                if (cPath.points.length < 2) return;
                translatedCtx!.beginPath();
                translatedCtx!.moveTo(cPath.points[0].x, cPath.points[0].y);
                for (let i = 1; i < cPath.points.length; i++) {
                    translatedCtx!.lineTo(cPath.points[i].x, cPath.points[i].y);
                }
                translatedCtx!.closePath();
                translatedCtx!.fill();
                
                 // Expand the punched hole slightly with stroke to remove edge artifacts
                translatedCtx!.lineWidth = 4;
                translatedCtx!.stroke();
            });
            translatedCtx!.globalCompositeOperation = 'source-over';
          }

          // 4. Draw the punched translated layer over the pure original
          finalCtx?.drawImage(translatedCanvas, 0, 0);
          
          // CRITICAL: Save final composition as highly compressed WebP to drastically reduce memory usage and file size
          const newResultData = finalCanvas.toDataURL('image/webp', 0.85);
          setMangaFiles(prev => prev.map(f => {
            if (f.id === targetFile.id) {
              return {
                ...f,
                result: newResultData,
                status: 'completed',
                history: [...(f.history || []), { original: f.original, result: f.result, censorPaths: f.censorPaths || [] }]
              };
            }
            return f;
          }));
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error("No image returned from AI.");
      }

      setStatus('Translation complete!');
      playKawaiiSound();
      showSpeech('complete', true);
    } catch (err: any) {
      showSpeech('error');
      console.error(err);
      updateFileResult(targetFile.id, targetFile.result, 'error');
      if (err.message?.includes('Requested entity was not found')) {
        setHasApiKey(false);
        setError("API Key session expired or invalid. Please select your API key again.");
      } else {
        setError(err.message || 'An error occurred during translation.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCensor = async (color = 'white') => {
    if (!currentFile || !currentPath || currentPath.length < 3 || !displayImageRef.current) return;
    setIsProcessing(true);
    setStatus('Censoring...');
    
    try {
      const scaleX = displayImageRef.current.naturalWidth / displayImageRef.current.width;
      const scaleY = displayImageRef.current.naturalHeight / displayImageRef.current.height;
      
      const scaledPath = currentPath.map(p => ({
          x: p.x * scaleX,
          y: p.y * scaleY
      }));

      const newCensorPath: CensorPath = {
          points: scaledPath,
          color: color
      };

      const applyCensor = async (imgSrc: string) => {
        const mainCanvas = document.createElement('canvas');
        const mainCtx = mainCanvas.getContext('2d');
        if (!mainCtx) return imgSrc;
        
        const baseImg = new Image();
        await new Promise((resolve) => {
          baseImg.onload = resolve;
          baseImg.src = imgSrc;
        });
        
        mainCanvas.width = baseImg.width;
        mainCanvas.height = baseImg.height;
        mainCtx.drawImage(baseImg, 0, 0);
        
        mainCtx.fillStyle = color;
        mainCtx.beginPath();
        mainCtx.moveTo(scaledPath[0].x, scaledPath[0].y);
        for (let i = 1; i < scaledPath.length; i++) {
            mainCtx.lineTo(scaledPath[i].x, scaledPath[i].y);
        }
        mainCtx.closePath();
        mainCtx.fill();
        
        return mainCanvas.toDataURL('image/webp', 0.85);
      };

      const newOriginal = await applyCensor(currentFile.original);
      const newResult = currentFile.result ? await applyCensor(currentFile.result) : null;
      
      setMangaFiles(prev => prev.map(f => {
        if (f.id === currentFile.id) {
          return { 
            ...f, 
            original: newOriginal, 
            result: newResult,
            censorPaths: [...(f.censorPaths || []), newCensorPath],
            history: [...(f.history || []), { original: f.original, result: f.result, censorPaths: f.censorPaths || [] }]
          };
        }
        return f;
      }));
      setCurrentPath(null);
      playKawaiiSound();
      showSpeech('censor_success');
    } catch (e) {
      showSpeech('censor_fail');
      console.error(e);
      setError("Failed to apply censor.");
    } finally {
      setIsProcessing(false);
      setStatus('');
    }
  };

  const handleUndo = () => {
    if (!currentFile || !currentFile.history || currentFile.history.length === 0 || isProcessing) return;
    
    setMangaFiles(prev => prev.map(f => {
      if (f.id === currentFile.id && f.history && f.history.length > 0) {
        const newHistory = [...f.history];
        const lastState = newHistory.pop()!;
        return {
          ...f,
          original: lastState.original,
          result: lastState.result,
          censorPaths: lastState.censorPaths,
          history: newHistory
        };
      }
      return f;
    }));
    setCurrentPath(null);
  };

  const handleBatchProcess = async () => {
    if (mangaFiles.length === 0 || isProcessing) return;
    
    for (const file of mangaFiles) {
      if (file.status !== 'completed') {
        await handleTranslate(false, file);
      }
    }
  };

  const handleBatchDownload = async () => {
    const translatedFiles = mangaFiles.filter(f => f.result);
    if (translatedFiles.length === 0) return;

    const zip = new JSZip();
    
    translatedFiles.forEach((file) => {
      // Results are internally converted to WEBP, so we save as webp
      const base64Data = file.result!.split(',')[1];
      const fileName = `translated_${file.name.replace(/\.[^/.]+$/, "")}.webp`;
      zip.file(fileName, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'translated_manga.zip');
    showSpeech('download');
  };

  // --- Canvas Interaction ---

  const startSelection = (e: React.MouseEvent | React.TouchEvent) => {
    if (!currentFile || isProcessing) return;
    const rect = displayImageRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsSelecting(true);
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    setCurrentPath([{ x, y }]);
  };

  const updateSelection = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSelecting) return;
    const rect = displayImageRef.current?.getBoundingClientRect();
    if (!rect) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    setCurrentPath(prev => {
        if (!prev) return [{ x: currentX, y: currentY }];
        return [...prev, { x: currentX, y: currentY }];
    });
  };

  const endSelection = () => {
    if (isSelecting && currentPath && currentPath.length > 2) {
        // Auto-close path visually if we want, but logic assumes it's closed
    } else if (isSelecting) {
        setCurrentPath(null); // Clear if too short
    }
    setIsSelecting(false);
  };

  useEffect(() => {
    setCurrentPath(null);
    setError(null);
  }, [currentIndex]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const container = img.parentElement;
    if (!container) return;
    
    const maxWidth = container.clientWidth;
    const maxHeight = window.innerHeight * 0.7;
    
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    
    setCanvasSize({ 
      width: width * ratio, 
      height: height * ratio 
    });
  };

  // --- Render ---

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginId === 'dobedub' && loginPw === 'dobedub') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-retro-bg p-4 md:p-8 font-sans flex items-center justify-center relative overflow-hidden">
        <div className="retro-window w-full max-w-sm relative z-10">
          <div className="retro-title-bar !bg-retro-blue">
            <span className="pixel-text text-[9px] text-white">LOGIN.EXE</span>
          </div>
          <form onSubmit={handleLogin} className="p-6 space-y-4 bg-white">
            <div className="text-center mb-6">
              <h1 className="pixel-text text-xl mb-2">쵸텐짱의 제미나이 번역기</h1>
              <p className="text-[10px] font-bold opacity-60">접근 권한이 필요합니다</p>
            </div>
            
            {loginError && (
              <div className="bg-red-100 border-2 border-red-500 text-red-700 p-2 text-xs font-bold text-center">
                {loginError}
              </div>
            )}

            <div>
              <label className="pixel-text text-[8px] block mb-2 opacity-60">아이디</label>
              <input 
                type="text" 
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full border-2 border-retro-border p-2 text-xs font-bold outline-none focus:bg-retro-pink/10"
                placeholder="ID 입력"
              />
            </div>

            <div>
              <label className="pixel-text text-[8px] block mb-2 opacity-60">비밀번호</label>
              <input 
                type="password" 
                value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)}
                className="w-full border-2 border-retro-border p-2 text-xs font-bold outline-none focus:bg-retro-pink/10"
                placeholder="PASSWORD 입력"
              />
            </div>

            <button 
              type="submit"
              className="retro-button w-full py-3 pixel-text text-[10px] bg-retro-purple hover:bg-retro-pink transition-colors mt-4"
            >
              [ 접속하기 ]
            </button>
          </form>
        </div>
        
        {/* Background Grid */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(#ff8b94 1px, transparent 1px), linear-gradient(90deg, #ff8b94 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans relative overflow-hidden">
      {/* Background Characters (Transformable) */}
      <div className="fixed inset-0 pointer-events-none z-[100]">
        <motion.div 
          drag 
          dragMomentum={false} 
          className="fixed bottom-4 left-4 flex flex-col items-center justify-end pointer-events-none w-36 z-[100]" 
        >
          <AnimatePresence>
            {speechBubble && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-50 pointer-events-none w-max">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  onClick={() => setSpeechBubble(null)}
                  title="말풍선 닫기"
                  className="bg-white border-2 border-retro-border px-4 py-2 rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,0.2)] pointer-events-auto cursor-pointer hover:opacity-90 active:scale-95 transition-all flex items-center justify-center relative"
                >
                  <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b-2 border-r-2 border-retro-border rotate-45" />
                  <span 
                    className={`pixel-text text-[10px] font-bold text-gray-800 relative z-10 leading-[1.6] text-center break-keep ${
                      speechBubble.length >= 16 ? 'max-w-[180px] whitespace-pre-wrap' : 'whitespace-nowrap'
                    }`}
                  >
                    {speechBubble}
                  </span>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {!isTransformed ? (
              <motion.img
                key="ame"
                src="/ame.png?v=2"
                alt="아메짱"
                draggable={false}
                onTap={() => showSpeech('poke')}
                className="w-36 h-auto shrink-0 choten-float pointer-events-auto cursor-grab active:cursor-grabbing relative"
                initial={{ opacity: 0, scale: 0.5, filter: 'brightness(2) blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'brightness(1) blur(0px)' }}
                exit={{ opacity: 0, scale: 1.5, filter: 'brightness(2) blur(10px)' }}
                transition={{ duration: 0.5, type: 'spring' }}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  console.error('아메짱 이미지를 찾을 수 없습니다.');
                }}
              />
            ) : (
              <motion.img
                key="choten"
                src="/choten.png?v=2"
                alt="초텐짱"
                draggable={false}
                onTap={() => showSpeech('poke')}
                className="w-36 h-auto shrink-0 choten-float pointer-events-auto cursor-grab active:cursor-grabbing relative"
                initial={{ opacity: 0, scale: 0.5, filter: 'brightness(2) blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'brightness(1) blur(0px)' }}
                exit={{ opacity: 0, scale: 1.5, filter: 'brightness(2) blur(10px)' }}
                transition={{ duration: 0.5, type: 'spring' }}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  console.error('초텐짱 이미지를 찾을 수 없습니다.');
                }}
              />
            )}
          </AnimatePresence>

          {/* Sparkles Effect */}
          <AnimatePresence>
            {sparkles.map((sparkle, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const radius = 80 + Math.random() * 40;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius - 100; // offset upwards

              return (
                <motion.div
                  key={sparkle.id}
                  className="absolute w-3 h-3 bg-white rounded-full pointer-events-none"
                  style={{
                    boxShadow: '0 0 10px 2px rgba(255, 255, 255, 0.8), 0 0 20px 5px rgba(255, 105, 180, 0.6)',
                  }}
                  initial={{ x: 0, y: -100, scale: 0, opacity: 1 }}
                  animate={{ x, y, scale: [0, 1.5, 0], opacity: [1, 1, 0] }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Header Window */}
      <header className="retro-window mb-8 max-w-7xl mx-auto z-10">
        <div className="retro-title-bar">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border-2 border-retro-border" />
            <span className="pixel-text text-white">MANGA_TRANSLATOR.EXE</span>
          </div>
          <div className="flex gap-1">
            <div className="w-4 h-4 bg-white border-2 border-retro-border" />
            <div className="w-4 h-4 bg-white border-2 border-retro-border" />
            <div className="w-4 h-4 bg-white border-2 border-retro-border" />
          </div>
        </div>
        
        <div className="p-4 flex flex-wrap items-center justify-between gap-4 bg-[#fdf2ff]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-retro-pink border-2 border-retro-border flex items-center justify-center shadow-[2px_2px_0px_#4a4a4a]">
              <ImageIcon size={24} />
            </div>
            <div>
              <h1 className="pixel-text text-sm">제미나이 만화 번역기</h1>
              <p className="text-[9px] font-bold opacity-60">V1.0.0 - 오버도즈 에디션</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!hasApiKey && (
              <button 
                onClick={handleSelectKey}
                className="retro-button px-4 py-2 pixel-text text-[8px] bg-retro-purple hover:bg-retro-pink transition-colors"
              >
                [ 키_선택 ]
              </button>
            )}
            <div className="flex gap-2">
              <label className="retro-button px-4 py-2 pixel-text text-[8px] cursor-pointer flex items-center gap-2 hover:bg-retro-blue">
                <Upload size={14} />
                이미지_업로드
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
              </label>
              <label className="retro-button px-4 py-2 pixel-text text-[8px] cursor-pointer flex items-center gap-2 hover:bg-retro-pink">
                <ImageIcon size={14} />
                폴더_업로드
                <input type="file" className="hidden" webkitdirectory="" mozdirectory="" directory="" onChange={handleImageUpload} />
              </label>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 relative z-10 pointer-events-none">
        {/* Sidebar */}
        <aside className="space-y-6 pointer-events-auto">
          {/* File Queue Window */}
          {mangaFiles.length > 0 && (
            <section className="retro-window">
              <div className="retro-title-bar !bg-retro-blue">
                <span className="pixel-text text-[9px] text-white">QUEUE.LST</span>
              </div>
              <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar bg-white">
                {mangaFiles.map((file, index) => (
                  <button
                    key={file.id}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-full text-left p-2 border-2 transition-all flex items-center justify-between ${
                      currentIndex === index 
                        ? 'border-retro-border bg-retro-pink/20 font-bold' 
                        : 'border-transparent hover:bg-retro-bg'
                    }`}
                  >
                    <span className="truncate text-[10px] font-bold">{file.name}</span>
                    <div className="flex items-center gap-1">
                      {file.status === 'processing' && <Loader2 size={10} className="animate-spin" />}
                      {file.status === 'completed' && <CheckCircle2 size={10} className="text-green-600" />}
                      {file.status === 'error' && <AlertCircle size={10} className="text-red-600" />}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Settings Window */}
          <section className="retro-window">
            <div className="retro-title-bar !bg-retro-purple">
              <span className="pixel-text text-[9px] text-white">설정.SYS</span>
            </div>
            <div className="p-4 space-y-4 bg-white">
              <div>
                <label className="pixel-text text-[8px] block mb-2 opacity-60">원본_언어</label>
                <select 
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full border-2 border-retro-border p-2 text-xs font-bold outline-none focus:bg-retro-pink/10"
                >
                  {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                </select>
              </div>
              
              <div className="flex justify-center">
                <button 
                  onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }}
                  className="retro-button p-2 hover:bg-retro-bg"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              <div>
                <label className="pixel-text text-[8px] block mb-2 opacity-60">대상_언어</label>
                <select 
                  value={targetLang}
                  onChange={(e) => {
                    setTargetLang(e.target.value);
                    if (e.target.value !== '일본어') setIsVerticalText(false);
                  }}
                  className="w-full border-2 border-retro-border p-2 text-xs font-bold outline-none focus:bg-retro-pink/10"
                >
                  {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                </select>
              </div>

              {targetLang === '일본어' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="vertical-text"
                    checked={isVerticalText}
                    onChange={(e) => setIsVerticalText(e.target.checked)}
                    className="w-4 h-4 accent-retro-pink cursor-pointer"
                  />
                  <label htmlFor="vertical-text" className="pixel-text text-[8px] cursor-pointer">
                    결과물을 일본어 특유의 세로쓰기로 출력
                  </label>
                </div>
              )}

              <div>
                <label className="pixel-text text-[8px] block mb-2 opacity-60">추가_지시사항 (선택)</label>
                <textarea 
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="예: '초텐짱'은 고유명사이므로 번역하지 마세요."
                  className="w-full border-2 border-retro-border p-2 text-[10px] font-bold outline-none focus:bg-retro-pink/10 resize-none h-20 custom-scrollbar"
                />
              </div>
            </div>
          </section>

          {/* Model Window */}
          <section className="retro-window">
            <div className="retro-title-bar !bg-retro-pink">
              <span className="pixel-text text-[9px] text-white">AI_코어.DLL</span>
            </div>
            <div className="p-2 space-y-2 bg-white">
              {MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full text-left p-2 border-2 transition-all ${
                    selectedModel === model.id 
                      ? 'border-retro-border bg-retro-purple/10' 
                      : 'border-transparent hover:bg-retro-bg'
                  }`}
                >
                  <div className="font-bold text-[10px] mb-1">{model.name}</div>
                  <div className="text-[9px] opacity-60 leading-tight">{model.description}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Status Window */}
          <AnimatePresence>
            {(status || error) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="retro-window"
              >
                <div className={`retro-title-bar ${error ? '!bg-red-400' : '!bg-green-400'}`}>
                  <span className="pixel-text text-[9px] text-white">시스템_메시지</span>
                </div>
                <div className="p-3 flex items-start gap-3 bg-white">
                  {error ? <AlertCircle size={16} className="text-red-500 shrink-0" /> : <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                  <div className="text-[10px] font-bold leading-relaxed">
                    {error || status}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* Main Display Window */}
        <div className="space-y-6 pointer-events-auto">
          <div className="retro-window min-h-[500px] flex flex-col">
            <div className="retro-title-bar">
              <span className="pixel-text text-[9px] text-white">미리보기.BMP</span>
              <div className="flex gap-2">
                {mangaFiles.length > 0 && (
                  <button 
                    onClick={() => { setMangaFiles([]); setCurrentIndex(0); setCurrentPath(null); }}
                    className="retro-button px-3 py-1 pixel-text text-[8px] bg-retro-pink text-black hover:bg-retro-purple hover:text-white transition-colors shadow-[2px_2px_0px_rgba(0,0,0,0.5)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 p-4 flex flex-col items-center justify-center bg-[#1a1a1a] relative overflow-hidden">
              {/* Scanline Effect */}
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] z-20" />
              
              {!currentFile ? (
                <div className="text-center space-y-6 z-10">
                  <div className="w-24 h-24 bg-white/5 border-4 border-white/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Upload size={48} className="text-white/20" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="pixel-text text-white text-lg">입력_대기_중...</h3>
                    <p className="pixel-text text-white/40 text-[8px]">디스크를 삽입하거나 이미지를 업로드하세요</p>
                  </div>
                </div>
              ) : (
                <div className="relative group cursor-crosshair select-none z-10">
                  <img 
                    key={currentFile.id + (currentFile.result ? '-res' : '-orig')}
                    ref={displayImageRef}
                    src={currentFile.result || currentFile.original}
                    alt={currentFile.name}
                    onLoad={handleImageLoad}
                    onMouseDown={startSelection}
                    onMouseMove={updateSelection}
                    onMouseUp={endSelection}
                    onMouseLeave={endSelection}
                    onTouchStart={startSelection}
                    onTouchMove={updateSelection}
                    onTouchEnd={endSelection}
                    onTouchCancel={endSelection}
                    className="border-4 border-retro-border shadow-[8px_8px_0px_rgba(0,0,0,0.5)] max-h-[70vh] max-w-full object-contain block mx-auto touch-none"
                    draggable={false}
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Selection Overlay */}
                  {currentPath && currentPath.length > 0 && (
                    <svg 
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{ zIndex: 10 }}
                    >
                      <path
                        d={`M ${currentPath.map(p => `${p.x},${p.y}`).join(' L ')} Z`}
                        fill="rgba(255, 183, 229, 0.3)" // retro-pink with transparency
                        stroke="white"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                    </svg>
                  )}

                  {/* Processing Overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-retro-purple/40 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                      <div className="retro-window p-4 bg-white">
                        <Loader2 className="animate-spin mb-4 mx-auto text-retro-purple" size={32} />
                        <p className="pixel-text text-[8px] text-center">{status}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Window */}
          <div className="retro-window">
            <div className="retro-title-bar !bg-retro-blue">
              <span className="pixel-text text-[9px] text-white">명령_프롬프트.EXE</span>
            </div>
            <div className="p-4 flex flex-wrap items-center justify-between gap-4 bg-white">
              <div className="flex items-center gap-3">
                <button 
                  disabled={!currentFile || isProcessing}
                  onClick={() => handleTranslate(false)}
                  className="retro-button px-6 py-3 pixel-text text-[10px] bg-retro-pink hover:bg-retro-purple disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing && !currentPath ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  번역_실행
                </button>
                
                <button 
                  disabled={!currentFile || !currentPath || isProcessing}
                  onClick={() => handleTranslate(true)}
                  className="retro-button px-6 py-3 pixel-text text-[10px] bg-retro-blue hover:bg-retro-purple disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing && currentPath && status.includes('Retouching') ? <Loader2 className="animate-spin" size={14} /> : <PenTool size={14} />}
                  리터칭_실행
                </button>
                <button 
                  disabled={!currentFile || !currentPath || isProcessing}
                  onClick={() => handleCensor('white')}
                  className="retro-button px-6 py-3 pixel-text text-[10px] bg-white border-2 border-retro-border hover:bg-retro-bg disabled:opacity-50 flex items-center gap-2"
                  title="선택한 영역을 흰색으로 덮어 검열합니다."
                >
                  {isProcessing && currentPath && status.includes('Censor') ? <Loader2 className="animate-spin" size={14} /> : <Eraser size={14} />}
                  선택영역_가리기
                </button>
                
                <div className="w-px h-8 bg-retro-border opacity-20 hidden md:block mx-1"></div>
                
                <button 
                  onClick={handleUndo}
                  disabled={!currentFile?.history?.length || isProcessing}
                  className="retro-button p-3 hover:bg-retro-bg disabled:opacity-30"
                  title="실행_취소 (가리기/리터칭 등 이전 상태로 되돌립니다)"
                >
                  <Undo2 size={18} />
                </button>
                <button 
                  onClick={() => setCurrentPath(null)}
                  className="retro-button p-3 hover:bg-retro-bg"
                  title="버퍼_비우기"
                >
                  <Eraser size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleBatchProcess}
                  disabled={mangaFiles.length === 0 || isProcessing}
                  className="retro-button px-4 py-3 pixel-text text-[9px] hover:bg-retro-bg disabled:opacity-50"
                  title="목록에 있는 번역 안 된 모든 이미지를 자동 번역합니다."
                >
                  일괄처리
                </button>
                <button 
                  onClick={handleBatchDownload}
                  disabled={isProcessing || !mangaFiles.some(f => f.result)}
                  className="retro-button px-4 py-3 pixel-text text-[9px] hover:bg-retro-bg disabled:opacity-50"
                  title="번역이 완료된 모든 이미지를 압축(ZIP)하여 다운로드합니다."
                >
                  일괄다운
                </button>
                {currentFile?.result && (
                  <a 
                    href={currentFile.result} 
                    download={`translated-${currentFile.name}`}
                    className="retro-button p-3 hover:bg-retro-bg flex items-center justify-center cursor-pointer"
                    title="현재_이미지_저장"
                    onClick={() => showSpeech('download')}
                  >
                    <Download size={18} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Instructions Window */}
          <section className="retro-window">
            <div className="retro-title-bar !bg-retro-purple">
              <span className="pixel-text text-[9px] text-white">읽어주세요.TXT</span>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8 bg-white">
              {[
                { step: '01', title: '데이터_로드', desc: '만화 디스크를 넣거나 이미지 파일을 업로드하세요.' },
                { step: '02', title: '파라미터_설정', desc: '설정.SYS에서 언어 DLL을 구성하세요.' },
                { step: '03', title: '프로세스_실행', desc: '번역을 실행하거나 리터칭할 영역을 선택하세요.' },
              ].map((item) => (
                <div key={item.step} className="space-y-2 border-l-2 border-retro-pink pl-4">
                  <div className="pixel-text text-retro-pink text-xl opacity-30 italic">{item.step}</div>
                  <h5 className="pixel-text text-[10px] font-bold">{item.title}</h5>
                  <p className="text-[10px] font-bold opacity-60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Taskbar */}
      <footer className="fixed bottom-0 left-0 right-0 h-10 bg-[#c0c0c0] border-t-2 border-white shadow-[0_-2px_0px_#4a4a4a] z-50 flex items-center px-2 gap-2">
        <button 
          onClick={handleTransform}
          className="retro-button px-4 h-7 flex items-center gap-2 bg-[#c0c0c0] active:shadow-inner"
        >
          <div className="w-4 h-4 bg-retro-pink border border-retro-border" />
          <span className="pixel-text text-[10px] font-bold">변신</span>
        </button>
        <div className="h-6 w-[2px] bg-retro-border/20 mx-1" />
        <div className="flex-1 flex items-center gap-1 overflow-hidden">
          <div className="retro-button px-3 h-7 flex items-center gap-2 bg-white/50 min-w-[120px]">
            <ImageIcon size={12} />
            <span className="pixel-text text-[8px] truncate">만화_번역...</span>
          </div>
        </div>

        {/* Audio Player in Taskbar */}
        <div className="flex items-center">
          <audio ref={audioRef} onEnded={nextTrack} />
          
          <div className="flex items-center bg-[#c0c0c0] border-2 border-white border-b-retro-border border-r-retro-border px-1 mr-1">
            <button 
              onClick={togglePlay}
              className="px-2 h-6 flex items-center justify-center hover:bg-white/20 active:bg-retro-border/20 transition-colors"
              title="재생 / 일시정지"
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <div className="w-[1px] h-4 bg-retro-border/20 mx-1" />
            <button 
              onClick={nextTrack}
              className="px-2 h-6 flex items-center justify-center hover:bg-white/20 active:bg-retro-border/20 transition-colors"
              title="다음 곡"
            >
              <SkipForward size={12} />
            </button>
            <div className="w-[1px] h-4 bg-retro-border/20 mx-1 pl-1" />
            <span className="pixel-text text-[8px] pl-1 pr-2 uppercase truncate max-w-[60px]">
              BGM {currentTrackIndex + 1}
            </span>
            <Volume2 size={10} className="mr-1 opacity-50" />
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={bgmVolume} 
              onChange={(e) => setBgmVolume(parseFloat(e.target.value))} 
              className="w-[40px] h-1 bg-retro-border/30 rounded-full appearance-none outline-none mr-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-retro-pink [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
              title="볼륨 조절"
            />
          </div>
        </div>

        <div className="h-6 w-[2px] bg-retro-border/20 mx-1" />
        
        <div className="h-7 px-3 bg-[#c0c0c0] border-2 border-retro-border inset-shadow-sm flex items-center gap-2">
          <RefreshCw size={12} className={isProcessing ? 'animate-spin' : ''} />
          <span className="pixel-text text-[8px] font-bold">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </footer>
      
      {/* Padding for Taskbar */}
      <div className="h-16" />
    </div>
  );
}
