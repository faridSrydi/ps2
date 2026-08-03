// ============================================================
// PS2 Cloud Gaming Platform — Library Page
// Full searchable game library with filtering and pagination
// ============================================================

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { gamesAPI, favoritesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GameGrid from '../components/game/GameGrid';
import { HiSearch, HiFilter } from 'react-icons/hi';

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [games, setGames] = useState([]);
  const [favoritesMap, setFavoritesMap] = useState({});
  const [loading, setLoading] = useState(true);

  const query = searchParams.get('q') || '';
  const genre = searchParams.get('genre') || '';
  const region = searchParams.get('region') || '';

  useEffect(() => {
    async function fetchLibrary() {
      try {
        setLoading(true);
        const [gamesRes, favoritesRes] = await Promise.all([
          gamesAPI.list({ q: query, genre, region, limit: 50 }),
          isAuthenticated ? favoritesAPI.list() : Promise.resolve({ data: [] }),
        ]);

        setGames(gamesRes.data.games || []);

        const favMap = {};
        (favoritesRes.data || []).forEach(g => { favMap[g.id] = true; });
        setFavoritesMap(favMap);
      } catch (err) {
        console.error('Failed to load library:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLibrary();
  }, [query, genre, region, isAuthenticated]);

  const handleFavoriteToggle = async (gameId) => {
    if (!isAuthenticated) return;
    try {
      if (favoritesMap[gameId]) {
        await favoritesAPI.remove(gameId);
        setFavoritesMap(prev => ({ ...prev, [gameId]: false }));
      } else {
        await favoritesAPI.add(gameId);
        setFavoritesMap(prev => ({ ...prev, [gameId]: true }));
      }
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-3xl text-white">PS2 Game Library</h1>
        <p className="text-gray-400 text-sm mt-1">
          Explore and launch PlayStation 2 games directly from our cloud servers.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by title, serial, or developer..."
            value={query}
            onChange={(e) => {
              const newParams = new URLSearchParams(searchParams);
              if (e.target.value) newParams.set('q', e.target.value);
              else newParams.delete('q');
              setSearchParams(newParams);
            }}
            className="input-field pl-11"
          />
        </div>

        {/* Region Filter */}
        <div className="flex items-center gap-2">
          <HiFilter className="text-gray-400 w-5 h-5" />
          <select
            value={region}
            onChange={(e) => {
              const newParams = new URLSearchParams(searchParams);
              if (e.target.value) newParams.set('region', e.target.value);
              else newParams.delete('region');
              setSearchParams(newParams);
            }}
            className="bg-ps2-darker border border-ps2-border text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-ps2-accent"
          >
            <option value="">All Regions</option>
            <option value="NTSC-U">NTSC-U (USA)</option>
            <option value="PAL">PAL (Europe)</option>
            <option value="NTSC-J">NTSC-J (Japan)</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <GameGrid
        games={games}
        onFavorite={handleFavoriteToggle}
        favoritesMap={favoritesMap}
        loading={loading}
      />
    </div>
  );
}
