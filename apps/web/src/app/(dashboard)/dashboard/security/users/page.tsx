'use client';

import { authFetch } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import { toast } from 'sonner';
import {
  Users,
  Shield,
  ShieldOff,
  RefreshCw,
  Smartphone,
  Plus,
  Key,
  X,
  Pencil,
} from 'lucide-react';
import { useRequireRole } from '@/lib/hooks/use-require-role';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  code: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { devices: number };
}

const roles = ['ADMIN', 'APPRO', 'PRODUCTION', 'COMMERCIAL'] as const;

// Password strength indicator
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: '12+ caractères', ok: password.length >= 12 },
    { label: 'Majuscule', ok: /[A-Z]/.test(password) },
    { label: 'Minuscule', ok: /[a-z]/.test(password) },
    { label: 'Chiffre', ok: /[0-9]/.test(password) },
    { label: 'Spécial (!@#...)', ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const color = score <= 2 ? '#FF3B30' : score <= 4 ? '#FF9500' : '#34C759';
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all" style={{ backgroundColor: i <= score ? color : '#E5E5EA' }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map(c => (
          <span key={c.label} className={`text-[10px] font-medium ${c.ok ? 'text-[#34C759]' : 'text-[#AEAEB2]'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
const roleColors: Record<string, string> = {
  ADMIN: 'bg-[#FF3B30]/10 text-[#FF3B30]',
  APPRO: 'bg-[#007AFF]/10 text-[#007AFF]',
  PRODUCTION: 'bg-[#AF52DE]/10 text-[#AF52DE]',
  COMMERCIAL: 'bg-[#34C759]/10 text-[#34C759]',
};

export default function UsersManagementPage() {
  const { hasAccess } = useRequireRole(['ADMIN']);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  // Confirmation dialog state
  const [confirmToggle, setConfirmToggle] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'COMMERCIAL' as string,
  });
  const [newPassword, setNewPassword] = useState('');

  // Focus trap and escape key for modals
  const createModalRef = useFocusTrap<HTMLDivElement>(showCreateModal);
  const closeCreateModal = useCallback(() => setShowCreateModal(false), []);
  useEscapeKey(closeCreateModal, showCreateModal);

  const editModalRef = useFocusTrap<HTMLDivElement>(showEditModal);
  const closeEditModal = useCallback(() => setShowEditModal(false), []);
  useEscapeKey(closeEditModal, showEditModal);

  const passwordModalRef = useFocusTrap<HTMLDivElement>(showPasswordModal);
  const closePasswordModal = useCallback(() => setShowPasswordModal(false), []);
  useEscapeKey(closePasswordModal, showPasswordModal);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/admin/users', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = (user: User) => {
    setConfirmToggle(user);
  };

  const confirmToggleStatus = async () => {
    if (!confirmToggle) return;
    setActionLoading(confirmToggle.id);
    setConfirmToggle(null);
    try {
      await authFetch(`/admin/users/${confirmToggle.id}/toggle-status`, {
        method: 'POST',
        credentials: 'include',
      });
      await fetchUsers();
    } catch {
      setError('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de la création');
      }
      setShowCreateModal(false);
      setFormData({ code: '', email: '', password: '', firstName: '', lastName: '', role: 'COMMERCIAL' });
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur lors de la mise à jour');
      }
      setShowEditModal(false);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur');
      }
      setShowPasswordModal(false);
      setNewPassword('');
      toast.success('Mot de passe réinitialisé avec succès');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setFormData({ code: '', email: '', password: '', firstName: '', lastName: '', role: 'COMMERCIAL' });
    setError(null);
    setShowCreateModal(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      code: user.code,
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
    setError(null);
    setShowEditModal(true);
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setError(null);
    setShowPasswordModal(true);
  };

  const activeUsers = users.filter(u => u.isActive).length;
  const blockedUsers = users.filter(u => !u.isActive).length;
  const totalDevices = users.reduce((sum, u) => sum + (u._count?.devices || 0), 0);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-[3px] border-[#FF3B30]/20 border-t-[#FF3B30] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Gestion des Utilisateurs"
        subtitle={`${users.length} utilisateur${users.length !== 1 ? 's' : ''} au total`}
        icon={<Users className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={fetchUsers} disabled={loading} variant="outline">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Ajouter
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D1D1F]/10 to-[#1D1D1F]/5 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#1D1D1F]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{users.length}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Total</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#34C759]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{activeUsers}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Actifs</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 flex items-center justify-center">
            <ShieldOff className="w-5 h-5 text-[#FF3B30]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{blockedUsers}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Bloqués</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{totalDevices}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Appareils</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-2xl text-[#FF3B30]">
          <div className="w-10 h-10 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0">
            <ShieldOff className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <table className="min-w-full divide-y divide-black/[0.04]">
          <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
            <tr>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Utilisateur</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Email</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Rôle</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Appareils</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Statut</th>
              <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {loading ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-24 ml-auto rounded-lg" /></td>
                  </tr>
                ))}
              </>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-16 text-center">
                <Users className="w-12 h-12 text-[#86868B]/40 mx-auto mb-3" />
                <p className="text-[#86868B] font-medium">Aucun utilisateur</p>
              </td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className={`group transition-colors ${!user.isActive ? 'bg-[#FF3B30]/5' : 'hover:bg-white/60'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 rounded-full flex items-center justify-center">
                        <span className="text-[#FF3B30] font-medium">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </span>
                      </div>
                      <div className="ml-3">
                        <div className="font-medium text-[#1D1D1F]">{user.firstName} {user.lastName}</div>
                        <div className="text-sm text-[#86868B]">{user.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#86868B]">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${roleColors[user.role] || 'bg-black/5 text-[#86868B]'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="flex items-center gap-1 text-sm text-[#6E6E73]">
                      <Smartphone className="h-4 w-4" />
                      {user._count?.devices || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#34C759]/10 text-[#34C759]">
                        <Shield className="h-3.5 w-3.5" />
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FF3B30]/10 text-[#FF3B30]">
                        <ShieldOff className="h-3.5 w-3.5" />
                        Bloqué
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditModal(user)} className="p-2 rounded-xl text-[#86868B] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all" title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => openPasswordModal(user)} className="p-2 rounded-xl text-[#86868B] hover:text-[#FF9500] hover:bg-[#FF9500]/10 transition-all" title="Réinitialiser mot de passe">
                        <Key className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleToggleStatus(user)} disabled={actionLoading === user.id}
                        className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all disabled:opacity-50 ${
                          user.isActive
                            ? 'text-[#FF3B30] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20'
                            : 'text-[#34C759] bg-[#34C759]/10 hover:bg-[#34C759]/20'
                        }`}
                      >
                        {user.isActive ? 'Bloquer' : 'Activer'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div ref={createModalRef} role="dialog" aria-modal="true" aria-labelledby="create-user-title" className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 w-full max-w-lg mx-4 animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
              <h2 id="create-user-title" className="text-lg font-semibold text-[#1D1D1F]">Nouvel utilisateur</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Code *</label>
                  <input type="text" value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all" placeholder="USR-004" required />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Rôle *</label>
                  <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all">
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Prénom *</label>
                  <input type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all" required />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Nom *</label>
                  <input type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all" required />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all" required />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Mot de passe *</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all" minLength={12} required />
                <PasswordStrength password={formData.password} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium">Annuler</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#FF3B30] text-white rounded-full hover:bg-[#D62D22] font-semibold transition-all shadow-lg shadow-[#FF3B30]/25 disabled:opacity-50">
                  {saving ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div ref={editModalRef} role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 w-full max-w-lg mx-4 animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
              <h2 id="edit-user-title" className="text-lg font-semibold text-[#1D1D1F]">Modifier l&apos;utilisateur</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-xl text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Code</label>
                  <input type="text" value={formData.code} disabled className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all disabled:bg-black/5" />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Rôle *</label>
                  <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all">
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Prénom *</label>
                  <input type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all" required />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Nom *</label>
                  <input type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all" required />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all" required />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium">Annuler</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#FF3B30] text-white rounded-full hover:bg-[#D62D22] font-semibold transition-all shadow-lg shadow-[#FF3B30]/25 disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Modifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Toggle Status Dialog */}
      {confirmToggle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 w-full max-w-sm mx-4 animate-scale-in p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmToggle.isActive ? 'bg-[#FF3B30]/10' : 'bg-[#34C759]/10'}`}>
                {confirmToggle.isActive ? <ShieldOff className="w-5 h-5 text-[#FF3B30]" /> : <Shield className="w-5 h-5 text-[#34C759]" />}
              </div>
              <div>
                <h3 className="font-semibold text-[#1D1D1F]">
                  {confirmToggle.isActive ? 'Bloquer' : 'Activer'} l&apos;utilisateur ?
                </h3>
                <p className="text-sm text-[#86868B]">
                  {confirmToggle.firstName} {confirmToggle.lastName} ({confirmToggle.email})
                </p>
              </div>
            </div>
            {confirmToggle.isActive && (
              <p className="text-sm text-[#FF3B30]/80 bg-[#FF3B30]/5 rounded-xl p-3">
                L&apos;utilisateur ne pourra plus se connecter ni accéder au système.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmToggle(null)} className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium">Annuler</button>
              <button
                onClick={confirmToggleStatus}
                className={`px-5 py-2.5 text-white rounded-full font-semibold transition-all shadow-lg ${
                  confirmToggle.isActive
                    ? 'bg-[#FF3B30] hover:bg-[#D62D22] shadow-[#FF3B30]/25'
                    : 'bg-[#34C759] hover:bg-[#2DA44E] shadow-[#34C759]/25'
                }`}
              >
                {confirmToggle.isActive ? 'Bloquer' : 'Activer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div ref={passwordModalRef} role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 w-full max-w-md mx-4 animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
              <h2 id="reset-password-title" className="text-lg font-semibold text-[#1D1D1F]">Réinitialiser le mot de passe</h2>
              <button onClick={() => setShowPasswordModal(false)} className="p-2 rounded-xl text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-[#6E6E73]">
                Réinitialiser le mot de passe pour <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>
              </p>
              <div>
                <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Nouveau mot de passe *</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/20 focus:border-[#FF3B30] transition-all" minLength={12} required />
                <PasswordStrength password={newPassword} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium">Annuler</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#FF9500] text-white rounded-full hover:bg-[#CC7A00] font-semibold transition-all shadow-lg shadow-[#FF9500]/25 disabled:opacity-50">
                  {saving ? 'Réinitialisation...' : 'Réinitialiser'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
