// ============================================================
// PS2 Cloud Gaming Platform — Admin Dashboard Page
// Overview of active GPU/CPU usage, sessions, users, and logs
// ============================================================

import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { HiUsers, HiPlay, HiChip, HiDatabase } from 'react-icons/hi';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [realtimeStats, setRealtimeStats] = useState(null);

  const { socket } = useSocket();

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const res = await adminAPI.dashboard();
        setData(res.data);
      } catch (err) {
        console.error('Failed to load admin dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  // Realtime monitoring subscription via Socket.io
  useEffect(() => {
    if (!socket) return;

    socket.emit('monitoring:subscribe');

    socket.on('stats:system', (stats) => {
      setRealtimeStats(stats);
    });

    return () => {
      socket.emit('monitoring:unsubscribe');
      socket.off('stats:system');
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="glass-card p-12 text-center my-12 animate-pulse">
        <div className="w-12 h-12 border-4 border-ps2-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading System Telemetry...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const sys = realtimeStats || data?.system || {};

  return (
    <div className="space-y-8 pb-12">
      <h1 className="font-display font-bold text-3xl text-white">Admin Telemetry & Control</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <HiUsers className="w-6 h-6 text-ps2-accent" />
          <span className="stat-value">{stats.totalUsers || 0}</span>
          <span className="stat-label">Total Users</span>
        </div>

        <div className="stat-card">
          <HiPlay className="w-6 h-6 text-green-400" />
          <span className="stat-value">{stats.activeSessions || 0}</span>
          <span className="stat-label">Active Cloud Sessions</span>
        </div>

        <div className="stat-card">
          <HiChip className="w-6 h-6 text-purple-400" />
          <span className="stat-value">{sys.cpu?.usagePercent || 0}%</span>
          <span className="stat-label">CPU Utilization</span>
        </div>

        <div className="stat-card">
          <HiDatabase className="w-6 h-6 text-yellow-400" />
          <span className="stat-value">{sys.memory?.usagePercent || 0}%</span>
          <span className="stat-label">RAM Usage ({sys.memory?.usedGB || 0} GB)</span>
        </div>
      </div>

      {/* GPU Hardware Card */}
      <div className="glass-card p-6 border border-ps2-accent/30 space-y-4">
        <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
          <HiChip className="text-ps2-glow" /> NVIDIA GPU Status (L4 Acceleration)
        </h3>

        {sys.gpu ? (
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <span className="text-xs text-gray-500 block">GPU Name</span>
              <span className="text-sm font-semibold text-white">{sys.gpu.name}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">GPU Load</span>
              <span className="text-sm font-semibold text-ps2-glow">{sys.gpu.utilizationPercent}%</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">VRAM Used</span>
              <span className="text-sm font-semibold text-white">
                {sys.gpu.vram?.usedMB} / {sys.gpu.vram?.totalMB} MB
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            NVIDIA GPU metrics unavailable. (Server running in software rendering mode or non-NVIDIA system)
          </p>
        )}
      </div>
    </div>
  );
}
