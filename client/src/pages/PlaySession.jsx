// ============================================================
// PS2 Cloud Gaming Platform — PlaySession Page
// Main interactive cloud gaming room page
// ============================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionAPI } from '../services/api';
import useSocket from '../hooks/useSocket';
import useWebRTC from '../hooks/useWebRTC';
import StreamPlayer from '../components/player/StreamPlayer';
import SessionControls from '../components/player/SessionControls';
import QRCodeModal from '../components/player/QRCodeModal';
import { HiExclamation } from 'react-icons/hi';

export default function PlaySession() {
  const { id } = useParams(); // Session ID
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [isControllerConnected, setIsControllerConnected] = useState(false);

  const { socket, connected: socketConnected } = useSocket();
  const { videoRef, streamState, errorReason, stats, startStream, stopStream } = useWebRTC(socket, id);

  // Load session data
  useEffect(() => {
    async function loadSession() {
      try {
        setLoading(true);
        const res = await sessionAPI.get(id);
        setSession(res.data);
      } catch (err) {
        setError(err.message || 'Session not found.');
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [id]);

  // Handle Socket Events & Start WebRTC
  useEffect(() => {
    if (!socket || !session) return;

    // Start WebRTC stream when socket connects
    startStream();

    // Listen for controller status
    socket.on('controller:connected', ({ playerNumber }) => {
      setIsControllerConnected(true);
    });

    socket.on('controller:disconnected', () => {
      setIsControllerConnected(false);
    });

    return () => {
      socket.off('controller:connected');
      socket.off('controller:disconnected');
    };
  }, [socket, session, startStream]);

  const handlePause = async () => {
    try {
      await sessionAPI.pause(id);
      setSession(prev => ({ ...prev, status: 'PAUSED' }));
    } catch (err) {
      console.error('Pause failed:', err);
    }
  };

  const handleResume = async () => {
    try {
      await sessionAPI.resume(id);
      setSession(prev => ({ ...prev, status: 'RUNNING' }));
    } catch (err) {
      console.error('Resume failed:', err);
    }
  };

  const handleSave = async () => {
    try {
      await sessionAPI.save(id, 1);
      alert('Game state saved to Slot 1!');
    } catch (err) {
      alert('Save state failed: ' + err.message);
    }
  };

  const handleScreenshot = async () => {
    try {
      await sessionAPI.screenshot(id);
      alert('Screenshot captured!');
    } catch (err) {
      alert('Screenshot failed: ' + err.message);
    }
  };

  const handleStop = async () => {
    if (window.confirm('Are you sure you want to end this game session?')) {
      try {
        stopStream();
        await sessionAPI.destroy(id);
        navigate('/library');
      } catch (err) {
        navigate('/library');
      }
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-12 text-center my-12">
        <div className="w-12 h-12 border-4 border-ps2-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="font-bold text-white text-lg">Initializing Cloud Room...</h3>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="glass-card p-12 text-center my-12">
        <HiExclamation className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="font-bold text-white text-xl mb-2">Session Error</h3>
        <p className="text-gray-400 text-sm mb-6">{error || 'Session unavailable'}</p>
        <button onClick={() => navigate('/library')} className="btn-primary">
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Session Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">
            {session.game?.title || 'PS2 Game Session'}
          </h1>
          <p className="text-xs text-gray-400">Room: <span className="font-mono text-ps2-glow font-bold">{session.roomId}</span></p>
        </div>
      </div>

      {/* Main Stream Player Component */}
      <StreamPlayer
        videoRef={videoRef}
        streamState={streamState}
        errorReason={errorReason}
        stats={stats}
      />

      {/* Control Toolbar */}
      <SessionControls
        isPaused={session.status === 'PAUSED'}
        onPause={handlePause}
        onResume={handleResume}
        onSave={handleSave}
        onScreenshot={handleScreenshot}
        onOpenQR={() => setShowQR(true)}
        onStop={handleStop}
        isControllerConnected={isControllerConnected}
      />

      {/* Smartphone Controller QR Modal */}
      <QRCodeModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        roomId={session.roomId}
        controllerUrl={session.controllerUrl}
        isControllerConnected={isControllerConnected}
      />
    </div>
  );
}
