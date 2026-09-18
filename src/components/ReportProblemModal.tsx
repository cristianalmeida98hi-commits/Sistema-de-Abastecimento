import React, { useState, useRef } from 'react';
import { X, AlertTriangle, Camera, Image as ImageIcon, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Vehicle, User, MachineIssue } from '../types';
import { compressDefectImage, uploadDefectPhotos, ProcessedPhoto } from '../utils/defectPhotoService';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  currentUser: User;
  onSubmit: (issueData: Omit<MachineIssue, 'id' | 'dateTime' | 'status'> & { id?: string }) => void;
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
  const [description, setDescription] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<ProcessedPhoto[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const MAX_PHOTOS = 3;
  const isMaxReached = selectedPhotos.length >= MAX_PHOTOS;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    const filesArray = Array.from(files);
    const availableSlots = MAX_PHOTOS - selectedPhotos.length;

    if (availableSlots <= 0) {
      setErrorMessage('Limite de 3 fotos por defeito atingido.');
      e.target.value = '';
      return;
    }

    const filesToProcess = filesArray.slice(0, availableSlots);
    setIsCompressing(true);

    try {
      const processedList: ProcessedPhoto[] = [];
      for (const file of filesToProcess) {
        // Validate format
        if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
          setErrorMessage('Formato não suportado. Use apenas imagens JPG, PNG ou WEBP.');
          continue;
        }
        const processed = await compressDefectImage(file);
        processedList.push(processed);
      }

      setSelectedPhotos(prev => [...prev, ...processedList].slice(0, MAX_PHOTOS));
    } catch (err: any) {
      console.error('[AndradeAgro] Erro ao comprimir foto:', err);
      setErrorMessage(err.message || 'Erro ao processar imagem.');
    } finally {
      setIsCompressing(false);
      // Reset input value so same photo can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setSelectedPhotos(prev => {
      const target = prev[indexToRemove];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
    setErrorMessage(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    // Clean up created object URLs
    selectedPhotos.forEach(p => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setSelectedPhotos([]);
    setDescription('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    // Pre-generate unique issue ID for storage grouping (Regra 7: defeitos/{issueId}/{photoId})
    const issueId = `iss-${Date.now()}`;
    let photoUrls: string[] = [];
    let photoStoragePaths: string[] = [];

    // If photos are attached, upload to Firebase Storage
    if (selectedPhotos.length > 0) {
      setSubmitStatusText('Comprimindo e enviando fotos...');
      try {
        const uploadResult = await uploadDefectPhotos(issueId, selectedPhotos);
        photoUrls = uploadResult.photoUrls;
        photoStoragePaths = uploadResult.photoStoragePaths;
      } catch (uploadErr: any) {
        console.error('[AndradeAgro] Falha no upload para Firebase Storage:', uploadErr);
        // Regra 11: Se o upload falhar, informar com clareza e permitir salvar sem foto ou tentar novamente
        const proceedWithoutPhotos = window.confirm(
          'Não foi possível enviar as fotos para o servidor de armazenamento.\n\nDeseja salvar o defeito sem as fotos para não perder o registro?'
        );

        if (!proceedWithoutPhotos) {
          setIsSubmitting(false);
          setSubmitStatusText('');
          setErrorMessage('Envio de foto cancelado. Você pode tentar novamente ou remover as fotos.');
          return;
        }
        // Fallback: save without photos (preserves defect integrity)
        photoUrls = [];
        photoStoragePaths = [];
      }
    }

    setSubmitStatusText('Registrando defeito no sistema...');

    try {
      onSubmit({
        id: issueId,
        equipmentId: vehicle.id,
        equipmentName: vehicle.model,
        equipmentPlateOrCode: vehicle.licensePlate || vehicle.patrimonyCode || vehicle.id,
        reportedByUserId: currentUser.id,
        reportedByUserName: currentUser.name,
        description: description.trim(),
        photoUrl: photoUrls[0] || undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
        photoStoragePaths: photoStoragePaths.length > 0 ? photoStoragePaths : undefined
      });

      // Cleanup preview memory
      selectedPhotos.forEach(p => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      setSelectedPhotos([]);
      setDescription('');
      setIsSubmitting(false);
      onClose();
    } catch (saveErr: any) {
      console.error('[AndradeAgro] Erro ao salvar defeito:', saveErr);
      setIsSubmitting(false);
      setErrorMessage('Erro ao registrar defeito. Tente novamente.');
    }
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
          <button 
            onClick={handleClose} 
            disabled={isSubmitting}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-emerald-900/50 disabled:opacity-50"
          >
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
          
          {/* Defect Description */}
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
              disabled={isSubmitting}
              className={`w-full p-3 rounded-2xl border text-xs outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-60 ${
                darkMode ? 'bg-emerald-950 border-emerald-800 text-slate-100' : 'bg-slate-50 border-slate-200'
              }`}
            />
          </div>

          {/* Photo Attachment Section (Regras 1, 2, 4, 5, 6, 12, 18) */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 dark:text-emerald-200 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Foto do Defeito (Opcional):</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-emerald-400/80">
                {selectedPhotos.length}/{MAX_PHOTOS} fotos
              </span>
            </div>

            {/* Hidden native inputs for Camera and Gallery */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Action Buttons to Add Photo */}
            {!isMaxReached ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isSubmitting || isCompressing}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition-all bg-slate-50 dark:bg-emerald-950/40 border-slate-200 dark:border-emerald-900 text-slate-700 dark:text-emerald-200 hover:bg-slate-100 dark:hover:bg-emerald-900/60 active:scale-[0.98] disabled:opacity-50"
                >
                  <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Tirar Foto</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isSubmitting || isCompressing}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition-all bg-slate-50 dark:bg-emerald-950/40 border-slate-200 dark:border-emerald-900 text-slate-700 dark:text-emerald-200 hover:bg-slate-100 dark:hover:bg-emerald-900/60 active:scale-[0.98] disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  <span>Escolher da Galeria</span>
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Limite de 3 fotos por defeito atingido.</span>
              </div>
            )}

            {/* Compressing indicator */}
            {isCompressing && (
              <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-emerald-950/80 text-slate-600 dark:text-emerald-300 text-xs flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span>Otimizando e comprimindo foto...</span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Photo Previews List (Regras 1, 4, 18) */}
            {selectedPhotos.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {selectedPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-emerald-800 bg-slate-100 dark:bg-emerald-950/60 flex flex-col"
                    >
                      <div className="h-24 w-full overflow-hidden bg-black/10">
                        <img
                          src={photo.previewUrl}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2 flex items-center justify-between gap-1 text-[10px]">
                        <span className="font-semibold text-slate-500 dark:text-emerald-400 truncate">
                          {(photo.sizeBytes / 1024).toFixed(0)} KB (Foto {idx + 1})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(idx)}
                          disabled={isSubmitting}
                          title="Remover foto"
                          className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submission Status Feedback */}
          {isSubmitting && submitStatusText && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span className="font-bold">{submitStatusText}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-3 rounded-2xl font-bold text-xs text-slate-600 dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-900/50 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isCompressing || !description.trim()}
              className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Enviar Alerta de Problema</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
