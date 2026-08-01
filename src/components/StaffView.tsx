import React, { useState } from 'react';
import { Users, Plus, Shield, User as UserIcon, Phone, FileText, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { User, UserRole } from '../types';
import { formatDateBR } from '../utils/calculations';

interface StaffViewProps {
  users: User[];
  currentUser: User;
  onAddUser: (u: Omit<User, 'id'>) => void;
  onUpdateUser: (id: string, u: Partial<User>) => void;
  darkMode: boolean;
}

export const StaffView: React.FC<StaffViewProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  darkMode
}) => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('FUNCIONARIO');
  const [department, setDepartment] = useState('Agrícola');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnh, setCnh] = useState('');
  const [cnhCategory, setCnhCategory] = useState('D');
  const [cnhExpiration, setCnhExpiration] = useState('2028-12-31');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddUser({
      name,
      email,
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
    setShowModal(false);
    setName('');
    setEmail('');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-emerald-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            Equipe, Motoristas & Operadores
          </h1>
          <p className="text-xs text-gray-500 dark:text-emerald-400">
            Controle de funcionários, categorias de CNH, vencimento de habilitações e papéis no AndradeAgro.
          </p>
        </div>

        {currentUser.role === 'ADMIN' && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 self-start sm:self-auto"
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
            className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${
              darkMode ? 'bg-emerald-950/40 border-emerald-900' : 'bg-white border-emerald-100 shadow-sm'
            }`}
          >
            <img
              src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={u.name}
              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-500/50 shrink-0"
            />

            <div className="flex-1 min-w-0 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {u.role === 'ADMIN' ? 'Administrador' : 'Funcionário'}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Ativo" />
              </div>

              <h3 className="font-extrabold text-sm text-gray-900 dark:text-emerald-100 truncate">{u.name}</h3>
              <p className="text-gray-500 dark:text-emerald-300 font-medium">{u.department}</p>

              <div className="pt-2 border-t border-emerald-800/10 space-y-0.5 text-[11px] text-gray-600 dark:text-emerald-300/80">
                <p className="flex items-center gap-1"><Phone className="w-3 h-3 text-amber-500" /> {u.phone || 'S/ Tel'}</p>
                {u.cnh && (
                  <p className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300">
                    <FileText className="w-3 h-3 text-emerald-600" /> CNH {u.cnhCategory} • Vence: {formatDateBR(u.cnhExpiration || '')}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-5 space-y-4 ${
            darkMode ? 'bg-emerald-950 border-emerald-800 text-emerald-100' : 'bg-white border-emerald-100 text-gray-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
              <span className="font-bold text-sm">Cadastrar Novo Funcionário</span>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-emerald-500/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pedro Henrique Souza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    placeholder="pedro@andradeagro..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Perfil / Acesso</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  >
                    <option value="FUNCIONARIO">Funcionário</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Setor / Departamento</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Telefone</label>
                  <input
                    type="text"
                    placeholder="(66) 99999-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Categoria CNH</label>
                  <input
                    type="text"
                    placeholder="Ex: AE, D, C, B"
                    value={cnhCategory}
                    onChange={(e) => setCnhCategory(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Validade CNH</label>
                  <input
                    type="date"
                    value={cnhExpiration}
                    onChange={(e) => setCnhExpiration(e.target.value)}
                    className={`w-full p-2 rounded-xl border ${darkMode ? 'bg-emerald-900/40 border-emerald-800' : 'bg-gray-50'}`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-xl hover:bg-emerald-500/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-gray-950 font-bold"
                >
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
