// ============================================================
// PS2 Cloud Gaming Platform — Profile Page
// ============================================================

import { useEffect, useState } from 'react';
import { profileAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { HiUser, HiClock, HiHeart, HiSave, HiCamera } from 'react-icons/hi';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await profileAPI.get();
        setProfile(res.data);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-12 text-center my-12 animate-pulse">
        <div className="w-12 h-12 border-4 border-ps2-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Loading user profile...</p>
      </div>
    );
  }

  const stats = profile?.stats || {};

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header Info */}
      <div className="glass-card p-8 flex items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-ps2-accent to-purple-500 flex items-center justify-center text-3xl font-bold shadow-lg shadow-ps2-accent/30">
          {user?.username?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-white">{user?.username}</h1>
          <p className="text-sm text-ps2-glow font-medium">{user?.role} Account</p>
          <p className="text-xs text-gray-400 mt-1">Joined {new Date(profile?.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Gameplay Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <HiClock className="w-6 h-6 text-ps2-glow mb-1" />
          <span className="stat-value">{Math.round((stats.totalPlayTimeSeconds || 0) / 60)} m</span>
          <span className="stat-label">Total Playtime</span>
        </div>

        <div className="stat-card">
          <HiHeart className="w-6 h-6 text-red-400 mb-1" />
          <span className="stat-value">{stats.favorites || 0}</span>
          <span className="stat-label">Favorites</span>
        </div>

        <div className="stat-card">
          <HiSave className="w-6 h-6 text-green-400 mb-1" />
          <span className="stat-value">{stats.saves || 0}</span>
          <span className="stat-label">Save States</span>
        </div>

        <div className="stat-card">
          <HiCamera className="w-6 h-6 text-purple-400 mb-1" />
          <span className="stat-value">{stats.screenshots || 0}</span>
          <span className="stat-label">Screenshots</span>
        </div>
      </div>
    </div>
  );
}
