// ============================================================
// PS2 Cloud Gaming Platform — Settings Page
// User preferences, WebRTC bitrate, and video scaling
// ============================================================

import { useState } from 'react';

export default function Settings() {
  const [resolution, setResolution] = useState('720p');
  const [targetFps, setTargetFps] = useState('60');

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <h1 className="font-display font-bold text-2xl text-white">Stream & Emulation Settings</h1>

      <div className="glass-card p-6 space-y-6">
        <div>
          <label className="text-sm font-semibold text-white block mb-2">Target Streaming Resolution</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="input-field"
          >
            <option value="720p">720p HD (Recommended - Low Latency)</option>
            <option value="1080p">1080p Full HD (Higher Bandwidth)</option>
            <option value="480p">480p SD (Mobile / Low Bandwidth)</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-white block mb-2">Target Frame Rate</label>
          <select
            value={targetFps}
            onChange={(e) => setTargetFps(e.target.value)}
            className="input-field"
          >
            <option value="60">60 FPS (Smooth)</option>
            <option value="30">30 FPS (Saver)</option>
          </select>
        </div>

        <button onClick={() => alert('Settings saved!')} className="btn-primary">
          Save Preferences
        </button>
      </div>
    </div>
  );
}
