// ============================================================
// PS2 Cloud Gaming Platform — GameGrid Component
// ============================================================

import GameCard from './GameCard';

export default function GameGrid({ games, onFavorite, favoritesMap = {}, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="glass-card aspect-[3/4] animate-pulse bg-ps2-card/40" />
        ))}
      </div>
    );
  }

  if (!games || games.length === 0) {
    return (
      <div className="glass-card p-12 text-center my-8">
        <div className="w-16 h-16 rounded-full bg-ps2-accent/10 text-ps2-accent flex items-center justify-center mx-auto mb-4 font-display font-bold text-2xl">
          🎮
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Games Found</h3>
        <p className="text-gray-400 max-w-md mx-auto text-sm">
          No games match your criteria or no PS2 ISOs have been added to the library yet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          onFavorite={onFavorite}
          isFavorited={!!favoritesMap[game.id]}
        />
      ))}
    </div>
  );
}
