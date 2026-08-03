// ============================================================
// PS2 Cloud Gaming Platform — Admin Users Page
// ============================================================

import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { HiTrash } from 'react-icons/hi';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.listUsers({ limit: 50 });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Delete this user account?')) {
      try {
        await adminAPI.deleteUser(id);
        fetchUsers();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <h1 className="font-display font-bold text-2xl text-white">User Account Management</h1>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-ps2-darker border-b border-ps2-border text-gray-400 uppercase text-xs">
            <tr>
              <th className="p-4">Username</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">Created</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ps2-border/40">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/5">
                <td className="p-4 font-semibold text-white">{u.username}</td>
                <td className="p-4 text-gray-400">{u.email || '-'}</td>
                <td className="p-4">
                  <span className={`badge ${u.role === 'ADMIN' ? 'badge-accent' : 'badge-success'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  <button onClick={() => handleDelete(u.id)} className="text-red-400 hover:text-red-300 p-2">
                    <HiTrash className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
