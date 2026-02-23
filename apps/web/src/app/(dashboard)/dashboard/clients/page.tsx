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
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createLogger } from '@/lib/logger';

const log = createLogger('Clients');

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
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await authFetch('/admin/clients', { credentials: 'include' });
      if (res.ok) {
        setClients(await res.json());
      }
    } catch (error) {
      log.error('Failed to load clients:', error);
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

  const handleDelete = (client: Client) => {
    setDeleteTarget(client);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await authFetch(`/admin/clients/${deleteTarget.id}`, {
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
    } finally {
      setDeleteTarget(null);
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
      <PageHeader
        title="Clients"
        subtitle="Gestion des clients et leurs informations fiscales"
        icon={<Users className="w-5 h-5" />}
        actions={
          <Button onClick={openCreateModal} variant="amber">
            <Plus className="w-4 h-4" />
            Ajouter un client
            <KeyboardHint shortcut="N" />
          </Button>
        }
      />

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le client</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer le client &laquo; {deleteTarget?.name} &raquo; ? Cette action est irr&eacute;versible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
