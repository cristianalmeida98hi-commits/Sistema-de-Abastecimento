import React, { useState } from 'react';
import { Users, Plus, Shield, User as UserIcon, Phone, FileText, CheckCircle2, AlertTriangle, X, Edit3, Trash2, Key } from 'lucide-react';
import { User, UserRole } from '../types';
import { formatDateBR } from '../utils/calculations';

interface StaffViewProps {
  users: User[];
  currentUser: User;
  onAddUser: (u: Omit<User, 'id'>) => void;
  onUpdateUser: (id: string, u: Partial<User>) => void;
  onDeleteUser?: (id: string) => void;
  darkMode?: boolean;
}

export const StaffViewComponent: React.FC<StaffViewProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123456');
  const [role, setRole] = useState<UserRole>('FUNCIONARIO');
  const [department, setDepartment] = useState('Agrícola');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnh, setCnh] = useState('');
  const [cnhCategory, setCnhCategory] = useState('D');
  const [cnhExpiration, setCnhExpiration] = useState('2028-12-31');

  const handleOpenAdd = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('123456');
    setRole('FUNCIONARIO');
    setDepartment('Agrícola');
    setPhone('');
    setCpf('');
    setCnh('');
    setCnhCategory('D');
    setCnhExpiration('2028-12-31');
    setShowModal(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email || '');
    setPassword(u.password || '123456');
    setRole(u.role);
    setDepartment(u.department || 'Agrícola');
    setPhone(u.phone || '');
    setCpf(u.cpf || '');
    setCnh(u.cnh || '');
    setCnhCategory(u.cnhCategory || 'D');
    setCnhExpiration(u.cnhExpiration || '2028-12-31');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      onUpdateUser(editingUser.id, {
        name,
        email,
        password,
        role,
        department,
        phone,
        cpf,
        cnh,
        cnhCategory,
        cnhExpiration
      });
    } else {
      onAddUser({
        name,
        email,
        password,
        role,
        department,
        phone,
        cpf,
        cnh,
        cnhCategory,
        cnhExpiration,
        active: true,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      });
    }
    setShowModal(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-emerald-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            Equipe, Motoristas & Operadores
          </h1>
          <p className="text-xs text-emerald-400">
            Controle de funcionários, senhas, cargos e permissões de acesso no AndradeAgro.
          </p>
        </div>

        {currentUser.role === 'ADMIN' && (
          <button
            onClick={handleOpenAdd}
            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Cadastrar Funcionário</span>
          </button>
        )}
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <div
            key={u.id}
            className="p-5 rounded-2xl border flex items-start gap-4 transition-all bg-emerald-950/40 border-emerald-900 relative group"
          >
            <img
              src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={u.name}
              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-500/50 shrink-0"
            />

            <div className="flex-1 min-w-0 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {u.role === 'ADMIN' ? 'Administrador' : 'Funcionário'}
                </span>
                
                {currentUser.role === 'ADMIN' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300"
                      title="Editar Funcionário"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteUser && (
                      <button
                        onClick={() => {
                          if (u.id === currentUser.id) {
                            alert('Você não pode excluir o seu próprio usuário enquanto está conectado.');
                            return;
                          }
                          if (confirm(`Tem certeza que deseja excluir o funcionário "${u.name}"? Esta ação não pode ser desfeita.`)) {
                            onDeleteUser(u.id);
                          }
                        }}
                        className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                        title="Excluir Funcionário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <h3 className="font-extrabold text-sm text-emerald-100 truncate">{u.name}</h3>
              <p className="text-emerald-300 font-medium">{u.department}</p>

              <div className="pt-2 border-t border-emerald-800/20 space-y-0.5 text-[11px] text-emerald-300/80">
                <p className="flex items-center gap-1"><Phone className="w-3 h-3 text-amber-500" /> {u.phone || 'S/ Tel'}</p>
                {u.cnh && (
                  <p className="flex items-center gap-1 font-semibold text-emerald-300">
                    <FileText className="w-3 h-3 text-emerald-400" /> CNH {u.cnhCategory} • Vence: {formatDateBR(u.cnhExpiration || '')}
                  </p>
                )}
                {currentUser.role === 'ADMIN' && (
                  <p className="flex items-center gap-1 text-[10px] text-amber-400/90 font-mono mt-1">
                    <Key className="w-3 h-3 text-amber-400 shrink-0" /> Senha: {u.password || '123456'}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 bg-emerald-950 border-emerald-800 text-emerald-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/40">
              <span className="font-bold text-sm">{editingUser ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}</span>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1 text-emerald-200">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pedro Henrique Souza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Perfil / Acesso *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white"
                  >
                    <option value="FUNCIONARIO" className="bg-emerald-950 text-white">Funcionário</option>
                    <option value="ADMIN" className="bg-emerald-950 text-white">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Senha de Acesso *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 123456"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Setor / Departamento</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">E-mail (Opcional)</label>
                  <input
                    type="email"
                    placeholder="pedro@andradeagro..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Telefone (Opcional)</label>
                  <input
                    type="text"
                    placeholder="(66) 99999-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Categoria CNH (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: AE, D, C, B"
                    value={cnhCategory}
                    onChange={(e) => setCnhCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Nº CNH (Opcional)</label>
                  <input
                    type="text"
                    placeholder="00000000000"
                    value={cnh}
                    onChange={(e) => setCnh(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white placeholder-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-emerald-200">Validade CNH (Opcional)</label>
                  <input
                    type="date"
                    value={cnhExpiration}
                    onChange={(e) => setCnhExpiration(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-emerald-900/40 border-emerald-800 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-800/40">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-xl hover:bg-emerald-500/10 text-emerald-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold"
                >
                  {editingUser ? 'Salvar Alterações' : 'Salvar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export const StaffView = React.memo(StaffViewComponent);
