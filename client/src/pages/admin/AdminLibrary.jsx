// ============================================================
// PS2 Cloud Gaming Platform — Admin Library Page
// ============================================================

import { useEffect, useState } from 'react';
import { gamesAPI } from '../../services/api';
import { HiRefresh } from 'react-icons/hi';

export default function AdminLibrary() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const res = await gamesAPI.list({ limit: 100 });
      setGames(res.data.games || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleRescan = async () => {
    try {
      setScanning(true);
      const res = await gamesAPI.rescan();
      alert(`Scan complete: ${res.data.added} added, ${res.data.updated} updated`);
      fetchGames();
    } catch (err) {
      alert('Rescan failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-white">Manage Game Library</h1>
        <button
          onClick={handleRescan}
          disabled={scanning}
          className="btn-primary flex items-center gap-2 text-sm !py-2"
        >
          <HiRefresh className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning Folder...' : 'Rescan /games/ps2'}
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-ps2-darker border-b border-ps2-border text-gray-400 uppercase text-xs">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4">Serial</th>
              <th className="p-4">Region</th>
              <th className="p-4">Format</th>
              <th className="p-4">Plays</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ps2-border/40">
            {games.map((g) => (
              <tr key={g.id} className="hover:bg-white/5">
                <td className="p-4 font-semibold text-white">{g.title}</td>
                <td className="p-4 font-mono text-xs">{g.serial || '-'}</td>
                <td className="p-4">{g.region || '-'}</td>
                <td className="p-4 uppercase text-xs">{g.format}</td>
                <td className="p-4">{g.playCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
