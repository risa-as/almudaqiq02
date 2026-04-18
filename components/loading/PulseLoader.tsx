import React from 'react';

export function PulseLoader({ text = "جاري التحميل" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[240px] w-full gap-12 text-center">
      <div className="relative flex items-center justify-center w-20 h-20">

        {/* Outer slow wave */}
        <div className="absolute inset-[-10px] rounded-full border-2 border-blue-500/20 animate-[ping_3s_ease-out_infinite]" />

        {/* Middle fast wave */}
        <div className="absolute inset-0 rounded-full border-[3px] border-indigo-400/30 animate-[ping_2s_ease-out_infinite_0.5s]" />

        {/* Inner solid pulsating circle with glow effect */}
        <div className="absolute inset-3 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 blur-md animate-pulse" />

        {/* The center hub */}
        <div className="relative w-12 h-12 rounded-full bg-white shadow-[0_0_20px_rgba(59,130,246,0.5)] flex items-center justify-center border border-slate-100 z-10">
          <div className="w-5 h-5 rounded-full border-2 border-transparent border-t-blue-600 border-r-indigo-500 animate-spin" />
        </div>
      </div>

      <div className="relative z-10">
        <p className="text-slate-600 font-bold tracking-widest text-sm relative inline-flex items-center gap-1.5">
          {text}
          <span className="flex gap-0.5">
            <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>
          </span>
        </p>
      </div>
    </div>
  );
}
