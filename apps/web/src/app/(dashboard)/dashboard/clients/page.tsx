'use client';

import { authFetch } from '@/lib/api';
import { toast } from 'sonner';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus } from 'lucide-react';
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { useAuth } from '@/lib/auth-context';
import {
  type Client,
  type ClientFormData,
  EMPTY_FORM_DATA,
} from '@/components/clients/types';
import { ClientFormModal } from '@/components/clients/ClientFormModal';
import { ClientsTable } from '@/components/clients/ClientsTable';
import { ClientFilters, type TabKey } from '@/components/clients/ClientFilters';

export default function ClientsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({ ...EMPTY_FORM_DATA });
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await authFetch('/admin/clients', { credentials: 'include' });
      if (res.ok) {
        setClients(await res.json());
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useKeyboardShortcuts([
    { key: 'n', handler: () => openCreateModal(), description: 'Nouveau client' },
    { key: 'r', handler: () => loadData(), description: 'Actualiser les donnees' },
    { key: '/', handler: () => searchInputRef.current?.focus(), description: 'Rechercher' },
  ]);

  const openCreateModal = () => {
    setEditingClient(null);
    setFormData({ ...EMPTY_FORM_DATA });
    setShowModal(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      code: client.code,
      name: client.name,
      type: client.type,
      nif: client.nif || '',
      rc: client.rc || '',
      ai: client.ai || '',
      nis: client.nis || '',
      phone: client.phone || '',
      address: client.address || '',
    });
    setShowModal(true);
  };

  const openHistoryPage = (client: Client) => {
    router.push(`/dashboard/clients/${client.id}/historique`);
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Supprimer le client "${client.name}" ?`)) return;

    try {
      const res = await authFetch(`/admin/clients/${client.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message || 'Erreur lors de la suppression');
        return;
      }

      loadData();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredClients = clients.filter((client) => {
    const matchesTab = activeTab === 'all' || client.type === activeTab;
    const matchesSearch = !searchQuery ||
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.phone || '').includes(searchQuery) ||
      (client.nif || '').includes(searchQuery);
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Glass Page Header */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#007AFF]/20 to-[#007AFF]/10 flex items-center justify-center shadow-lg shadow-[#007AFF]/10">
              <Users className="w-6 h-6 text-[#007AFF]" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-[#1D1D1F] tracking-tight">Clients</h1>
              <p className="text-[13px] text-[#86868B]">Gestion des clients et leurs informations fiscales</p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#007AFF] text-white text-sm font-semibold rounded-full hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25 transition-all active:scale-[0.97]"
          >
            <Plus className="w-4 h-4" />
            Ajouter un client
            <KeyboardHint shortcut="N" />
          </button>
        </div>
      </div>

      {/* Filters (stats + tabs + search) */}
      <ClientFilters
        clients={clients}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      />

      {/* Clients Table */}
      <ClientsTable
        clients={filteredClients}
        isLoading={isLoading}
        onEdit={openEditModal}
        onDelete={user?.role === 'ADMIN' ? handleDelete : undefined}
        onHistory={openHistoryPage}
      />

      {/* Client Form Modal */}
      <ClientFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        editingClient={editingClient}
        formData={formData}
        onFormChange={setFormData}
        onSuccess={loadData}
      />
    </div>
  );
}
