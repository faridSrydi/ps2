// ============================================================
// PS2 Cloud Gaming Platform — Game Details Page
// Game details, play trigger, screenshots, save state info
// ============================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gamesAPI, sessionAPI, favoritesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { HiPlay, HiHeart, HiArrowLeft, HiSparkles } from 'react-icons/hi';

export default function GamePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, guestLogin } = useAuth();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadGame() {
      try {
        setLoading(true);
        const res = await gamesAPI.get(id);
        setGame(res.data);
      } catch (err) {
        setError('Game not found or server error');
      } finally {
        setLoading(false);
      }
    }
    loadGame();
  }, [id]);

  const handlePlay = async () => {
    try {
      setStartingSession(true);
      setError(null);

      // Auto guest login if unauthenticated
      if (!isAuthenticated) {
        await guestLogin();
      }

      const res = await sessionAPI.create(id);
      const { sessionId } = res.data;
      navigate(`/play/${sessionId}`);
    } catch (err) {
      setError(err.message || 'Failed to start game session.');
      setStartingSession(false);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      if (game.isFavorited) {
        await favoritesAPI.remove(game.id);
        setGame(prev => ({ ...prev, isFavorited: false }));
      } else {
        await favoritesAPI.add(game.id);
        setGame(prev => ({ ...prev, isFavorited: true }));
      }
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-12 text-center my-12 animate-pulse">
        <div className="w-12 h-12 border-4 border-ps2-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading game details...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="glass-card p-12 text-center my-12">
        <h2 className="text-2xl font-bold text-white mb-4">Game Not Found</h2>
        <button onClick={() => navigate('/library')} className="btn-primary">
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-2 text-sm">
        <HiArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Main Banner Card */}
      <div className="glass-card overflow-hidden p-6 md:p-8 grid md:grid-cols-3 gap-8">
        {/* Cover Art */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-ps2-darker aspect-[3/4]">
          {game.coverPath ? (
            <img src={game.coverPath} alt={game.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-6 text-center font-bold text-xl text-gray-500">
              {game.title}
            </div>
          )}
          {game.region && (
            <div className="absolute top-3 left-3 badge-accent">{game.region}</div>
          )}
        </div>

        {/* Details & Actions */}
        <div className="md:col-span-2 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-white">
                  {game.title}
                </h1>
                <p className="text-ps2-glow text-sm font-medium mt-1">
                  {game.serial || 'PS2 Game'} • {game.format?.toUpperCase()}
                </p>
              </div>

              <button
                onClick={handleFavoriteToggle}
                className={`p-3 rounded-full border transition-all ${
                  game.isFavorited
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : 'bg-ps2-darker border-ps2-border text-gray-400 hover:text-white'
                }`}
              >
                <HiHeart className={`w-6 h-6 ${game.isFavorited ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Error banner */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <p className="text-gray-300 text-sm leading-relaxed">
              {game.description || 'No description available for this game in the local library.'}
            </p>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-ps2-border/50">
              <div>
                <span className="text-xs text-gray-500 block">Genre</span>
                <span className="text-sm font-medium text-white">{game.genre || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Developer</span>
                <span className="text-sm font-medium text-white">{game.developer || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Total Plays</span>
                <span className="text-sm font-medium text-white">{game.playCount}</span>
              </div>
            </div>
          </div>

          {/* Big Play Button */}
          <div className="pt-4 border-t border-ps2-border/50 flex flex-wrap items-center gap-4">
            <button
              onClick={handlePlay}
              disabled={startingSession}
              className="btn-primary flex-1 min-w-[200px] flex items-center justify-center gap-3 text-lg !py-4"
            >
              {startingSession ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting Server Session...
                </>
              ) : (
                <>
                  <HiPlay className="w-6 h-6" /> Play Now in Cloud
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
