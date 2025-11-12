// components/InviteShareModal.tsx
import React, { useState, useEffect } from 'react';
import type { SharedAccount, AccountInvite, CreateInviteRequest } from '../types';
import { api } from '../services/api';

interface InviteShareModalProps {
  accounts: SharedAccount[];
  selectedAccount: SharedAccount | null;
  onClose: () => void;
  onAccountCreated: (accountName: string) => void;
  onAccountSelected: (account: SharedAccount) => void;
  onAccountsUpdated: () => void;
}

const InviteShareModal: React.FC<InviteShareModalProps> = ({
  accounts,
  selectedAccount,
  onClose,
  onAccountCreated,
  onAccountSelected,
  onAccountsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'invites' | 'create'>('accounts');
  const [newAccountName, setNewAccountName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'member' | 'admin'>('member');
  const [accountInvites, setAccountInvites] = useState<{[key: number]: AccountInvite[]}>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentInvite, setCurrentInvite] = useState<any>(null);

  // Carregar convites quando a aba mudar
  useEffect(() => {
    if (activeTab === 'invites' && selectedAccount) {
      loadAccountInvites(selectedAccount.id);
    }
  }, [activeTab, selectedAccount]);

  const loadAccountInvites = async (accountId: number) => {
    try {
      const response = await api.getAccountInvites(accountId);
      setAccountInvites(prev => ({
        ...prev,
        [accountId]: response.invites
      }));
    } catch (err) {
      console.error('Erro ao carregar convites:', err);
      setError('Erro ao carregar convites');
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      setError('Nome da conta é obrigatório');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onAccountCreated(newAccountName.trim());
      setNewAccountName('');
      setSuccess('Conta criada com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!selectedAccount || !inviteEmail.trim()) {
      setError('Email é obrigatório');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const inviteData: CreateInviteRequest = {
        email: inviteEmail.trim(),
        role: inviteRole
      };

      const response = await api.createInvite(selectedAccount.id, inviteData);
      
      setCurrentInvite(response.invite);
      setInviteEmail('');
      setSuccess('Convite criado com sucesso!');
      
      // Recarregar lista de convites
      await loadAccountInvites(selectedAccount.id);
      
    } catch (err) {
      setError('Erro ao criar convite');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvite = async (inviteId: number) => {
    try {
      await api.cancelInvite(inviteId);
      if (selectedAccount) {
        await loadAccountInvites(selectedAccount.id);
      }
      setSuccess('Convite cancelado com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erro ao cancelar convite');
    }
  };

  const handleCopyInvite = async (inviteData: any) => {
    try {
      const textToCopy = `
🎤 CONVITE VOICEEXPENSE

${inviteData.inviter_name} convidou você para: ${inviteData.account_name}

🔗 Link direto: ${inviteData.invite_url}
🔢 Código: ${inviteData.token}

💡 Acesse o link ou use o código no app!
      `.trim();
      
      await navigator.clipboard.writeText(textToCopy);
      setSuccess('Convite copiado! Cole e compartilhe.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erro ao copiar convite');
    }
  };

  const handleShareInvite = async (inviteData: any) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Convite para ${inviteData.account_name}`,
          text: `${inviteData.inviter_name} convidou você para o VoiceExpense! Código: ${inviteData.token}`,
          url: inviteData.invite_url
        });
      } catch (err) {
        console.log('Compartilhamento cancelado');
      }
    } else {
      handleCopyInvite(inviteData);
    }
  };

  const handleLeaveAccount = async (account: SharedAccount) => {
    if (!confirm(`Tem certeza que deseja sair da conta "${account.name}"?`)) {
      return;
    }

    try {
      await api.leaveAccount(account.id);
      setSuccess(`Você saiu da conta ${account.name}`);
      onAccountsUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Erro ao sair da conta');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      owner: { label: 'Proprietário', color: 'bg-purple-100 text-purple-800' },
      admin: { label: 'Admin', color: 'bg-red-100 text-red-800' },
      member: { label: 'Membro', color: 'bg-blue-100 text-blue-800' },
      viewer: { label: 'Visualizador', color: 'bg-gray-100 text-gray-800' }
    };
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.viewer;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
      accepted: { label: 'Aceito', color: 'bg-green-100 text-green-800' },
      expired: { label: 'Expirado', color: 'bg-red-100 text-red-800' },
      cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              👥 Gerenciar Contas Compartilhadas
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'accounts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🏢 Minhas Contas
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'invites'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📨 Convites
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              ➕ Nova Conta
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Mensagens de status */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {/* Tab: Minhas Contas */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Suas Contas Compartilhadas</h3>
              
              {accounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">🏢</div>
                  <p>Você ainda não tem contas compartilhadas</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Criar primeira conta
                  </button>
                </div>
              ) : (
                accounts.map(account => (
                  <div key={account.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-blue-600">🏢</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{account.name}</h4>
                          <div className="flex items-center space-x-2 mt-1">
                            {getRoleBadge(account.role)}
                            <span className="text-sm text-gray-500">
                              {account.member_count} membro(s)
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {account.role !== 'owner' && (
                          <button
                            onClick={() => handleLeaveAccount(account)}
                            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                          >
                            Sair
                          </button>
                        )}
                        <button
                          onClick={() => onAccountSelected(account)}
                          className={`px-3 py-1 text-sm rounded-lg border ${
                            selectedAccount?.id === account.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {selectedAccount?.id === account.id ? 'Selecionada' : 'Selecionar'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Despesas:</span> {account.expenses_count}
                      </div>
                      <div>
                        <span className="font-medium">Total:</span> R$ {account.total_expenses.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab: Convites */}
          {activeTab === 'invites' && (
            <div className="space-y-6">
              {!selectedAccount ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📨</div>
                  <p>Selecione uma conta para gerenciar convites</p>
                </div>
              ) : (
                <>
                  {/* Criar novo convite */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Novo Convite</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email do convidado
                        </label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="email@exemplo.com"
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Permissão
                        </label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as any)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="viewer">👀 Somente visualização</option>
                          <option value="member">👥 Adicionar despesas</option>
                          <option value="admin">⚡ Administrador</option>
                        </select>
                      </div>
                      
                      <button
                        onClick={handleCreateInvite}
                        disabled={!inviteEmail.trim() || loading}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {loading ? 'Criando...' : 'Criar Convite'}
                      </button>
                    </div>
                  </div>

                  {/* Convite criado com sucesso */}
                  {currentInvite && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-3">✅ Convite Criado!</h4>
                      <div className="space-y-2 text-sm">
                        <p><strong>Conta:</strong> {currentInvite.account_name}</p>
                        <p><strong>Convidado:</strong> {currentInvite.email}</p>
                        <p><strong>Código:</strong> <code className="bg-green-100 px-2 py-1 rounded">{currentInvite.token}</code></p>
                        <p><strong>Link:</strong> <span className="text-blue-600 break-all">{currentInvite.invite_url}</span></p>
                      </div>
                      <div className="flex space-x-2 mt-4">
                        <button
                          onClick={() => handleCopyInvite(currentInvite)}
                          className="flex-1 bg-white border border-green-600 text-green-600 py-2 px-3 rounded-lg text-sm font-medium hover:bg-green-50"
                        >
                          📋 Copiar
                        </button>
                        <button
                          onClick={() => handleShareInvite(currentInvite)}
                          className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-green-700"
                        >
                          📤 Compartilhar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de convites existentes */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Convites da Conta "{selectedAccount.name}"</h4>
                    
                    {(!accountInvites[selectedAccount.id] || accountInvites[selectedAccount.id].length === 0) ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>Nenhum convite encontrado</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {accountInvites[selectedAccount.id]?.map(invite => (
                          <div key={invite.id} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-gray-900">{invite.email}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  {getRoleBadge(invite.role)}
                                  {getStatusBadge(invite.status)}
                                </div>
                              </div>
                              
                              {invite.status === 'pending' && (
                                <button
                                  onClick={() => handleCancelInvite(invite.id)}
                                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                            
                            <div className="text-xs text-gray-500 space-y-1">
                              <p>Criado por: {invite.inviter_name}</p>
                              <p>Expira em: {formatDate(invite.expires_at)}</p>
                              {invite.accepted_at && (
                                <p>Aceito em: {formatDate(invite.accepted_at)} por {invite.accepted_by_name}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab: Nova Conta */}
          {activeTab === 'create' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Criar Nova Conta Compartilhada</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da conta
                </label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Ex: Família Silva, Empresa XYZ..."
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Você será o proprietário desta conta e poderá convidar outras pessoas.
                </p>
              </div>
              
              <button
                onClick={handleCreateAccount}
                disabled={!newAccountName.trim() || loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? 'Criando...' : 'Criar Conta'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-gray-500 text-white py-2 px-6 rounded-lg hover:bg-gray-600 font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteShareModal;