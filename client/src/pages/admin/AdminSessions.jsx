// ============================================================
// PS2 Cloud Gaming Platform — Admin Sessions Page
// ============================================================

import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { HiStop } from 'react-icons/hi';

export default function AdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.listSessions();
      setSessions(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleKill = async (id) => {
    if (window.confirm('Force kill this active cloud emulator instance?')) {
      try {
        await adminAPI.killSession(id);
        fetchSessions();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <h1 className="font-display font-bold text-2xl text-white">Active Emulator Sessions</h1>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-ps2-darker border-b border-ps2-border text-gray-400 uppercase text-xs">
            <tr>
              <th className="p-4">Room ID</th>
              <th className="p-4">User</th>
              <th className="p-4">Game</th>
              <th className="p-4">Status</th>
              <th className="p-4 font-mono">PID / Display</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ps2-border/40">
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-white/5">
                <td className="p-4 font-mono font-bold text-ps2-glow">{s.roomId}</td>
                <td className="p-4 text-white">{s.user?.username || '-'}</td>
                <td className="p-4">{s.game?.title || '-'}</td>
                <td className="p-4">
                  <span className={`badge ${s.status === 'RUNNING' ? 'badge-success' : 'badge-warning'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="p-4 font-mono text-xs text-gray-400">
                  PID: {s.pcsx2Pid || '-'} | Display :{s.displayNumber ?? '-'}
                </td>
                <td className="p-4 text-right">
                  {s.status === 'RUNNING' && (
                    <button
                      onClick={() => handleKill(s.id)}
                      className="btn-danger !py-1 !px-3 text-xs flex items-center gap-1 ml-auto"
                    >
                      <HiStop className="w-3.5 h-3.5" /> Kill Instance
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
