// ============================================================
// PS2 Cloud Gaming Platform — StreamPlayer Component
// WebRTC video player with canvas fallback and stats overlay
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { HiWifi, HiExclamation } from 'react-icons/hi';

export default function StreamPlayer({ videoRef, streamState, errorReason, stats }) {
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFSChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] max-h-[80vh] bg-black rounded-2xl overflow-hidden glass-card flex items-center justify-center group select-none"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-contain bg-black"
      />

      {/* Stream Overlay States */}
      {streamState === 'connecting' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center p-6">
          <div className="w-12 h-12 border-4 border-ps2-accent border-t-transparent rounded-full animate-spin" />
          <div>
            <h3 className="font-bold text-lg text-white">Connecting to Game Stream...</h3>
            <p className="text-sm text-gray-400">Initializing PCSX2 instance and WebRTC pipeline</p>
          </div>
        </div>
      )}

      {streamState === 'error' && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-center p-6">
          <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
            <HiExclamation className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Stream Connection Failed</h3>
            <p className="text-sm text-red-400 font-mono mt-1 mb-2 bg-red-950/50 px-2 py-1 rounded border border-red-500/20 max-w-sm mx-auto">
              Reason: {errorReason || 'ICE timeout'}
            </p>
            <p className="text-xs text-gray-400 max-w-sm">
              Could not establish WebRTC connection with the emulator server. Check server status or GPU configuration.
            </p>
          </div>
        </div>
      )}

      {/* Realtime Performance Overlay (Top Left) */}
      {streamState === 'connected' && stats && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono flex items-center gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5 text-green-400">
            <HiWifi className="w-4 h-4" />
            <span>{stats.fps || 60} FPS</span>
          </div>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">{Math.round((stats.bytesReceived || 0) / 1024)} KB/s</span>
          {stats.packetsLost > 0 && (
            <>
              <span className="text-gray-500">|</span>
              <span className="text-yellow-400">{stats.packetsLost} pkts lost</span>
            </>
          )}
        </div>
      )}

      {/* Double click / Button Fullscreen shortcut */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </button>
    </div>
  );
}
