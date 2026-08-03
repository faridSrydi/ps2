// ============================================================
// PS2 Cloud Gaming Platform — Login Page
// ============================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, guestLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = async () => {
    try {
      setSubmitting(true);
      await guestLogin();
      navigate('/library');
    } catch (err) {
      setError('Guest login failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 glass-card p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-display font-bold text-2xl text-white">Welcome Back</h1>
        <p className="text-sm text-gray-400">Sign in to access your save states and favorites</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">Username</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
            placeholder="Enter username"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="••••••••"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="relative border-t border-ps2-border/60 pt-4 text-center">
        <button onClick={handleGuest} disabled={submitting} className="btn-secondary w-full text-sm">
          Play Instantly as Guest
        </button>
      </div>

      <p className="text-center text-xs text-gray-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-ps2-glow font-semibold hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
