// ============================================================
// PS2 Cloud Gaming Platform — SessionControls Component
// Toolbar for gameplay controls (Pause, Resume, Save, Screenshot, QR, Exit)
// ============================================================

import { HiPause, HiPlay, HiCamera, HiSave, HiQrcode, HiStop } from 'react-icons/hi';

export default function SessionControls({
  isPaused,
  onPause,
  onResume,
  onSave,
  onScreenshot,
  onOpenQR,
  onStop,
  isControllerConnected,
}) {
  return (
    <div className="glass-card p-3 flex flex-wrap items-center justify-between gap-3 my-4">
      {/* Primary Action Buttons */}
      <div className="flex items-center gap-2">
        {isPaused ? (
          <button onClick={onResume} className="btn-primary flex items-center gap-2 !py-2 !px-4 text-sm">
            <HiPlay className="w-4 h-4" /> Resume
          </button>
        ) : (
          <button onClick={onPause} className="btn-secondary flex items-center gap-2 !py-2 !px-4 text-sm">
            <HiPause className="w-4 h-4" /> Pause
          </button>
        )}

        <button onClick={onSave} className="btn-secondary flex items-center gap-2 !py-2 !px-4 text-sm">
          <HiSave className="w-4 h-4 text-ps2-accent" /> Save State
        </button>

        <button onClick={onScreenshot} className="btn-secondary flex items-center gap-2 !py-2 !px-4 text-sm">
          <HiCamera className="w-4 h-4 text-purple-400" /> Screenshot
        </button>
      </div>

      {/* Controller & Exit Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenQR}
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-all ${
            isControllerConnected
              ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 animate-pulse'
          }`}
        >
          <HiQrcode className="w-4 h-4" />
          {isControllerConnected ? 'Controller Connected' : 'Pair Controller'}
        </button>

        <button onClick={onStop} className="btn-danger flex items-center gap-2 !py-2 !px-4 text-sm">
          <HiStop className="w-4 h-4" /> End Session
        </button>
      </div>
    </div>
  );
}
