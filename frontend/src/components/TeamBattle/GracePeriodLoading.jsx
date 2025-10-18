// ============================================
// NEW FILE: src/components/TeamBattle/GracePeriodLoading.jsx
// CREATE THIS NEW FILE
// ============================================

import React, { useState, useEffect } from 'react';
import { Clock, Search, Zap, CheckCircle, Trophy } from 'lucide-react';

export default function GracePeriodLoading({ gracePeriodSeconds = 15, onComplete }) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);

  const phases = [
    { icon: Clock, text: 'Time expired!', color: 'text-yellow-400' },
    { icon: Search, text: 'Scanning submissions...', color: 'text-blue-400' },
    { icon: Zap, text: 'Processing results...', color: 'text-purple-400' },
    { icon: CheckCircle, text: 'Finalizing scores...', color: 'text-green-400' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsElapsed(prev => {
        if (prev >= gracePeriodSeconds) {
          clearInterval(interval);
          if (onComplete) onComplete();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gracePeriodSeconds, onComplete]);

  useEffect(() => {
    const phaseInterval = gracePeriodSeconds / phases.length;
    const newPhase = Math.min(
      Math.floor(secondsElapsed / phaseInterval),
      phases.length - 1
    );
    setCurrentPhase(newPhase);
  }, [secondsElapsed, gracePeriodSeconds, phases.length]);

  const progress = (secondsElapsed / gracePeriodSeconds) * 100;
  const CurrentIcon = phases[currentPhase].icon;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50">
      <div className="max-w-2xl w-full px-8">
        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 rounded-2xl p-12 border-2 border-purple-500/30 shadow-2xl">
          
          {/* Animated Icon */}
          <div className="relative w-32 h-32 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-spin" 
                 style={{ 
                   borderTopColor: '#a855f7',
                   animationDuration: '3s'
                 }}></div>
            
            <div className="absolute inset-3 rounded-full bg-purple-600/10 animate-pulse"></div>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <CurrentIcon className={`w-16 h-16 ${phases[currentPhase].color} animate-pulse`} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-4xl font-bold text-white text-center mb-3 animate-pulse">
            Checking Final Submissions
          </h2>
          
          {/* Current Phase */}
          <p className={`text-xl ${phases[currentPhase].color} text-center mb-8 font-medium`}>
            {phases[currentPhase].text}
          </p>

          {/* Progress Bar */}
          <div className="relative mb-8">
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 via-blue-500 to-purple-600 transition-all duration-1000"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between items-center mt-3">
              <span className="text-gray-400 text-sm">Processing...</span>
              <span className="text-purple-400 font-mono font-bold text-lg">
                {gracePeriodSeconds - secondsElapsed}s
              </span>
            </div>
          </div>

          {/* Info Message */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-blue-400 mt-0.5" />
              <p className="text-blue-300 text-sm">
                We're checking all submissions made in the final moments to ensure accurate results.
              </p>
            </div>
          </div>

          {/* Phase Indicators */}
          <div className="grid grid-cols-4 gap-3">
            {phases.map((phase, index) => {
              const PhaseIcon = phase.icon;
              const isCompleted = index < currentPhase;
              const isCurrent = index === currentPhase;
              
              return (
                <div 
                  key={index}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                    isCurrent 
                      ? 'bg-purple-600/20 border-2 border-purple-500' 
                      : isCompleted
                      ? 'bg-green-600/10 border border-green-500/30'
                      : 'bg-gray-800/50 border border-gray-700'
                  }`}
                >
                  <PhaseIcon 
                    className={`w-6 h-6 ${
                      isCurrent 
                        ? `${phase.color} animate-bounce` 
                        : isCompleted
                        ? 'text-green-400'
                        : 'text-gray-600'
                    }`} 
                  />
                  <span className={`text-xs text-center ${
                    isCurrent 
                      ? 'text-white font-bold' 
                      : isCompleted
                      ? 'text-green-400'
                      : 'text-gray-500'
                  }`}>
                    {phase.text.split('...')[0]}
                  </span>
                  
                  {isCompleted && (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}