import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, BookOpen, Volume2, VolumeX } from 'lucide-react';
import { CodeTourConfig } from '../../../types/system';

interface InteractiveCodeTourProps {
  config: CodeTourConfig;
  onStepChange?: (stepId: string) => void;
}

export const InteractiveCodeTour: React.FC<InteractiveCodeTourProps> = ({ config, onStepChange }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const currentStep = config.steps[currentStepIndex];
  const totalSteps = config.steps.length;

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const speakText = (text: string) => {
    if (!synthRef.current || isMuted) return;

    // Cancel previous speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; // Set language to Chinese
    utterance.rate = 1.0; // Normal speed

    // Fix for long text truncation in Chrome/Edge
    // Split text into sentences and speak them sequentially if needed
    // For now, let's ensure we are using a valid voice
    const voices = synthRef.current.getVoices();
    // Prioritize Microsoft voices (often better quality on Windows) or Google
    const chineseVoice = voices.find(v => (v.lang.includes('zh') || v.lang.includes('CN')) && !v.name.includes('Hong Kong') && !v.name.includes('Taiwan'));

    if (chineseVoice) {
        utterance.voice = chineseVoice;
    } else {
        // Fallback to any Chinese voice
        const anyChinese = voices.find(v => v.lang.includes('zh'));
        if (anyChinese) utterance.voice = anyChinese;
    }

    // Event handlers to debug speech issues
    utterance.onend = () => {
        // Speech finished normally
    };
    utterance.onerror = (e) => {
        // "interrupted" errors are expected when speech is cancelled
        // Only log other errors
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
            console.error('Speech error:', e);
        }
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted && synthRef.current) {
      synthRef.current.cancel();
    } else if (isMuted) {
        // Re-speak current step description if unmuted
        speakText(currentStep.description);
    }
  };

  useEffect(() => {
    if (onStepChange) {
      onStepChange(currentStep.id);
    }
    
    // Play sound effect when step changes
    const popSound = "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
    const audio = new Audio(popSound); 
    audio.volume = 0.3;
    audio.play().catch(() => {}); 

    // Speak the description
    speakText(currentStep.description);
    
    // Auto-scroll to highlighted lines
    if (currentStep.highlightLines && codeContainerRef.current) {
      const lineHeight = 24; // Approximation or calculation
      const scrollPos = (currentStep.highlightLines.start - 2) * lineHeight;
      codeContainerRef.current.scrollTo({ top: Math.max(0, scrollPos), behavior: 'smooth' });
    }
  }, [currentStepIndex, currentStep, onStepChange]); // isMuted is handled in toggleMute and speakText logic

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden relative">
      {/* 1. Code View Area */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar relative" ref={codeContainerRef}>
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
           {/* Highlight Overlay */}
           {currentStep.highlightLines && (
             <div 
               className="absolute w-full bg-blue-500/10 border-l-2 border-blue-500 transition-all duration-300"
               style={{
                 top: `${(currentStep.highlightLines.start - 1) * 1.5}rem`, // 1.5rem line height
                 height: `${(currentStep.highlightLines.end - currentStep.highlightLines.start + 1) * 1.5}rem`
               }}
             />
           )}
        </div>

        <pre className="font-mono text-sm leading-6 relative z-10">
          <code>
            {config.codeSnippet.split('\n').map((line, i) => {
              const lineNum = i + 1;
              const isHighlighted = currentStep.highlightLines && 
                lineNum >= currentStep.highlightLines.start && 
                lineNum <= currentStep.highlightLines.end;
              
              return (
                <div 
                  key={i} 
                  className={`flex transition-colors duration-300 ${isHighlighted ? 'bg-blue-500/10' : ''}`}
                >
                  <span className="w-8 text-right mr-4 text-gray-600 select-none shrink-0">{lineNum}</span>
                  <span className={`whitespace-pre-wrap ${isHighlighted ? 'text-gray-100 font-medium' : 'text-gray-500'}`}>
                    {/* Simple Syntax Highlighting Logic */}
                    {line.split(/(\/\/.*|\b(?:const|let|var|function|return|import|from|export)\b)/g).map((part, j) => {
                       if (part.trim().startsWith('//')) return <span key={j} className="text-green-400/70 italic">{part}</span>;
                       if (['const', 'let', 'var', 'function', 'return'].includes(part)) return <span key={j} className="text-purple-400">{part}</span>;
                       return <span key={j}>{part}</span>;
                    })}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* 2. Guide Card (Bottom) */}
      <div className="bg-gray-800 border-t border-gray-700 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] z-20">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <BookOpen size={16} />
            <span className="text-xs font-bold tracking-wider uppercase">Code Tour {currentStepIndex + 1}/{totalSteps}</span>
          </div>
          <div className="flex gap-2">
             <button
              onClick={toggleMute}
              className="p-1.5 rounded-full hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              title={isMuted ? "开启语音" : "静音"}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button 
              onClick={handlePrev} 
              disabled={currentStepIndex === 0}
              className="p-1.5 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={handleNext} 
              disabled={currentStepIndex === totalSteps - 1}
              className={`p-1.5 rounded-full transition-colors ${
                currentStepIndex === totalSteps - 1 
                  ? 'bg-green-600 hover:bg-green-500 text-white' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {currentStepIndex === totalSteps - 1 ? <Play size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>
        </div>
        
        <h3 className="text-lg font-bold text-white mb-2">{currentStep.title}</h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          {currentStep.description}
        </p>
      </div>
    </div>
  );
};
