// ============================================================
// PS2 Cloud Gaming Platform — GameCard Component
// ============================================================

import { Link } from 'react-router-dom';
import { HiHeart, HiPlay } from 'react-icons/hi';

export default function GameCard({ game, onFavorite, isFavorited }) {
  const coverUrl = game.coverPath || '/placeholder-cover.svg';

  return (
    <Link to={`/game/${game.id}`} className="game-card animate-fade-in">
      {/* Cover Image */}
      <div className="relative overflow-hidden">
        <div className="aspect-[3/4] bg-ps2-darker">
          {game.coverPath ? (
            <img
              src={coverUrl}
              alt={game.title}
              className="game-card-image"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ps2-card to-ps2-darker">
              <span className="font-display font-bold text-2xl text-gray-600 text-center px-4">
                {game.title}
              </span>
            </div>
          )}
        </div>

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <button className="btn-primary w-full flex items-center justify-center gap-2 !py-2.5">
            <HiPlay className="w-5 h-5" />
            Play Now
          </button>
        </div>

        {/* Region badge */}
        {game.region && (
          <div className="absolute top-2 left-2">
            <span className="badge-accent text-[10px]">{game.region}</span>
          </div>
        )}

        {/* Favorite button */}
        {onFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFavorite(game.id);
            }}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              isFavorited
                ? 'bg-red-500/20 text-red-400'
                : 'bg-black/40 text-white/60 hover:text-red-400'
            }`}
          >
            <HiHeart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-white truncate group-hover:text-ps2-glow transition-colors">
          {game.title}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500">{game.genre || 'Unknown'}</span>
          {game.playCount > 0 && (
            <span className="text-xs text-gray-600">{game.playCount} plays</span>
          )}
        </div>
      </div>
    </Link>
  );
}
