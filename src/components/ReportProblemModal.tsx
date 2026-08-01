import React, { useState } from 'react';
import { X, AlertTriangle, Camera, CheckCircle2, User as UserIcon, Wrench } from 'lucide-react';
import { Vehicle, User, MachineIssue } from '../types';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  currentUser: User;
  onSubmit: (issueData: Omit<MachineIssue, 'id' | 'dateTime' | 'status'>) => void;
  darkMode: boolean;
}

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  currentUser,
  onSubmit,
  darkMode
}) => {
  if (!isOpen) return null;

  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preset sample issue photo options
  const samplePhotos = [
    { label: 'Vazamento de Óleo', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80' },
    { label: 'Fumaça no Motor', url: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=600&auto=format&fit=crop&q=80' },
    { label: 'Pneu / Esteira Danificado', url: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600&auto=format&fit=crop&q=80' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    onSubmit({
      equipmentId: vehicle.id,
      equipmentName: vehicle.model,
      equipmentPlateOrCode: vehicle.licensePlate || vehicle.patrimonyCode || vehicle.id,
      reportedByUserId: currentUser.id,
      reportedByUserName: currentUser.name,
      description: description.trim(),
      photoUrl: photoUrl || undefined
    });

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className={`w-full max-w-lg rounded-3xl shadow-2xl border p-6 space-y-5 max-h-[90vh] overflow-y-auto ${
        darkMode ? 'bg-[#042d23] border-emerald-900 text-slate-100' : 'bg-white border-slate-100 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3 border-emerald-800/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm text-slate-900 dark:text-slate-100">
                Informar Problema / Defeito
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Aviso imediato para a gestão de manutenção e administração
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-emerald-900/50">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Machine Badge Info */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-900 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white border shrink-0 overflow-hidden">
            <img
              src={vehicle.photoUrl || 'https://images.unsplash.com/photo-1592861956120-e524fc739696?w=600&auto=format&fit=crop&q=80'}
              alt={vehicle.model}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md">
              {vehicle.licensePlate || vehicle.patrimonyCode}
            </span>
            <h3 className="font-black text-xs text-slate-900 dark:text-slate-100 mt-0.5">
              {vehicle.model}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Operador: <strong>{currentUser.name}</strong> • Data: {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-emerald-200">
              Descrição do Problema Encontrado: *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Descreva o defeito, ruído anormal, vazamento ou falha observada na máquina..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full p-3 rounded-2xl border text-xs outline-none focus:ring-2 focus:ring-red-500/50 ${
                darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
              }`}
            />
          </div>

          {/* Photo Section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-emerald-200 flex items-center justify-between">
              <span>Anexar Foto da Falha (Opcional):</span>
              <span className="text-[10px] font-normal text-slate-500">Selecione um exemplo ou insira URL/Câmera</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {samplePhotos.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPhotoUrl(sample.url)}
                  className={`p-2 rounded-xl border text-[10px] font-bold text-center transition-all ${
                    photoUrl === sample.url
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 ring-2 ring-red-500/20'
                      : 'bg-slate-50 dark:bg-emerald-950/40 border-slate-200 dark:border-emerald-900 text-slate-600 dark:text-emerald-300 hover:border-slate-300'
                  }`}
                >
                  {sample.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Ou insira a URL da imagem da câmera..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
              }`}
            />

            {photoUrl && (
              <div className="relative w-full h-32 rounded-2xl overflow-hidden border">
                <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl font-bold text-xs text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !description.trim()}
              className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Enviar Alerta de Problema</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
