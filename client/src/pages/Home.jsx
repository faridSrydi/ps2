// ============================================================
// PS2 Cloud Gaming Platform — Home Page
// Hero section, Recently Played, Favorites, Library showcase
// ============================================================

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { gamesAPI, recentAPI, favoritesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GameGrid from '../components/game/GameGrid';
import { HiPlay, HiSparkles, HiClock, HiHeart } from 'react-icons/hi';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [featuredGames, setFeaturedGames] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [favoriteGames, setFavoriteGames] = useState([]);
  const [favoritesMap, setFavoritesMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHomeData() {
      try {
        setLoading(true);
        const [gamesRes, favoritesRes] = await Promise.all([
          gamesAPI.list({ limit: 10, sort: 'playCount', order: 'desc' }),
          isAuthenticated ? favoritesAPI.list() : Promise.resolve({ data: [] }),
        ]);

        setFeaturedGames(gamesRes.data.games || []);

        const favMap = {};
        (favoritesRes.data || []).forEach(g => { favMap[g.id] = true; });
        setFavoritesMap(favMap);
        setFavoriteGames(favoritesRes.data || []);

        if (isAuthenticated) {
          const recentRes = await recentAPI.list();
          setRecentGames(recentRes.data || []);
        }
      } catch (err) {
        console.error('Failed to load home page data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadHomeData();
  }, [isAuthenticated]);

  const handleFavoriteToggle = async (gameId) => {
    if (!isAuthenticated) return navigate('/login');

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
    <div className="space-y-12 pb-12">
      {/* Hero Banner */}
      <section className="relative rounded-3xl overflow-hidden glass-card p-8 md:p-12 border border-ps2-accent/30 bg-gradient-to-r from-ps2-card via-ps2-darker to-ps2-card">
        <div className="absolute top-0 right-0 w-96 h-96 bg-ps2-accent/10 rounded-full blur-3xl -z-10" />

        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ps2-accent/20 border border-ps2-accent/40 text-ps2-glow text-xs font-semibold">
            <HiSparkles className="w-4 h-4" /> PS2 Cloud Emulation Engine
          </div>

          <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-white tracking-tight leading-tight">
            Play PS2 Games <br />
            <span className="text-gradient">Directly in Browser</span>
          </h1>

          <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
            Zero installation required. Powered by high-performance GPU servers with WebRTC low-latency video streaming and mobile controller pairing.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <Link to="/library" className="btn-primary flex items-center gap-2">
              <HiPlay className="w-5 h-5" /> Browse Library
            </Link>
            {!isAuthenticated && (
              <Link to="/guest" onClick={async (e) => {
                e.preventDefault();
                // Guest quick login
                window.location.href = '/library';
              }} className="btn-secondary">
                Play as Guest
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Recently Played */}
      {isAuthenticated && recentGames.length > 0 && (
        <section className="space-y-4">
          <h2 className="section-header">
            <HiClock className="text-ps2-accent" /> Recently Played
          </h2>
          <GameGrid games={recentGames} onFavorite={handleFavoriteToggle} favoritesMap={favoritesMap} />
        </section>
      )}

      {/* Favorites */}
      {isAuthenticated && favoriteGames.length > 0 && (
        <section className="space-y-4">
          <h2 className="section-header">
            <HiHeart className="text-red-500" /> Favorites
          </h2>
          <GameGrid games={favoriteGames} onFavorite={handleFavoriteToggle} favoritesMap={favoritesMap} />
        </section>
      )}

      {/* Popular Games */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-header !mb-0">
            <HiSparkles className="text-ps2-glow" /> Popular Library Games
          </h2>
          <Link to="/library" className="text-sm font-semibold text-ps2-glow hover:underline">
            View All →
          </Link>
        </div>
        <GameGrid games={featuredGames} onFavorite={handleFavoriteToggle} favoritesMap={favoritesMap} loading={loading} />
      </section>
    </div>
  );
}
