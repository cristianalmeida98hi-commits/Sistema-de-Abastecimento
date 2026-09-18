import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, ensureFirebaseAuth } from '../lib/firebase';

export interface ProcessedPhoto {
  id: string;
  file?: File;
  blob: Blob;
  previewUrl: string;
  sizeBytes: number;
  fileName: string;
}

export interface UploadedPhotoResult {
  photoUrls: string[];
  photoStoragePaths: string[];
  failedCount: number;
  lastErrorMessage?: string;
  errors?: string[];
}

/**
 * Traduz e detalha erros técnicos do Firebase Storage para mensagens claras ao usuário.
 */
export function parseStorageErrorMessage(err: any): string {
  if (!err) return 'Erro desconhecido de comunicação com o servidor de armazenamento.';
  
  const code = err.code || '';
  const message = err.message || '';
  const status = err.status_ || (err.customData && err.customData.status_) || 0;

  // 404: Bucket não provisionado ou não existente no Firebase Console
  if (
    status === 404 || 
    (code === 'storage/unknown' && (message.includes('404') || message.includes('unknown error occurred'))) ||
    message.includes('bucket') && message.includes('not found')
  ) {
    return 'O bucket de armazenamento "andrade-agro.firebasestorage.app" ainda não foi ativado no Console do Firebase (Google Cloud Storage retornou 404 Not Found). É necessário acessar o Firebase Console e clicar em "Começar" no menu Storage.';
  }

  // 403 / unauthorized: Regras de segurança bloqueando
  if (code === 'storage/unauthorized' || message.includes('unauthorized') || message.includes('permission')) {
    return 'Permissão negada pelas regras de segurança do Firebase Storage (storage.rules). Verifique se a sessão do usuário está ativa.';
  }

  if (code === 'storage/quota-exceeded') {
    return 'Cota de armazenamento do Firebase Storage excedida.';
  }

  if (code === 'storage/retry-limit-exceeded' || message.includes('network') || message.includes('Failed to fetch')) {
    return 'Tempo limite de conexão esgotado ou falha de conexão com a internet ao enviar a foto.';
  }

  if (code === 'storage/canceled') {
    return 'O envio da imagem foi cancelado pelo usuário.';
  }

  return message || 'Falha técnica ao tentar salvar imagem no Firebase Storage.';
}

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Targets ~200 KB to 500 KB while maintaining high visual clarity of the defect.
 * Compatível com fotos de câmeras de celular (Android, iOS/Safari, HEIC/HEIF).
 */
export async function compressDefectImage(file: File): Promise<ProcessedPhoto> {
  return new Promise((resolve, reject) => {
    // Validar se o arquivo é imagem (inclusive formatos de celular como HEIC/HEIF ou arquivos sem MIME no mobile)
    const isImage = (file.type && file.type.startsWith('image/')) || 
                    /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(file.name);
    
    if (!isImage) {
      return reject(new Error('Apenas arquivos de imagem (JPG, PNG, WEBP, HEIC) são permitidos.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo da foto do dispositivo.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        // Alerta informativo caso seja HEIC puro não suportado pelo canvas do navegador
        if (/\.(heic|heif)$/i.test(file.name) || file.type.includes('heic') || file.type.includes('heif')) {
          reject(new Error('O formato HEIC desta foto não pôde ser decodificado pelo navegador. No iPhone, tire a foto pela câmera do aplicativo ou ajuste a câmera para "Mais Compatível".'));
        } else {
          reject(new Error('Não foi possível carregar e decodificar a imagem selecionada.'));
        }
      };

      img.onload = () => {
        try {
          const maxDim = 1600; // Nitidez ideal para visualizar detalhes de peças e vazamentos
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Erro ao processar imagem no navegador.'));
          }

          // Fundo branco caso a imagem tenha transparência
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Compressão progressiva visando 200KB - 500KB
          let quality = 0.82;
          
          const attemptCompression = (q: number): Promise<Blob> => {
            return new Promise((resBlob, rejBlob) => {
              canvas.toBlob(
                (blob) => {
                  if (blob) resBlob(blob);
                  else rejBlob(new Error('Falha ao gerar arquivo comprimido da imagem.'));
                },
                'image/jpeg',
                q
              );
            });
          };

          attemptCompression(quality).then(async (blob) => {
            let finalBlob = blob;
            if (finalBlob.size > 550 * 1024) {
              const secondBlob = await attemptCompression(0.70);
              finalBlob = secondBlob;
            }
            if (finalBlob.size > 600 * 1024) {
              const thirdBlob = await attemptCompression(0.58);
              finalBlob = thirdBlob;
            }

            const previewUrl = URL.createObjectURL(finalBlob);
            const photoId = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            resolve({
              id: photoId,
              file,
              blob: finalBlob,
              previewUrl,
              sizeBytes: finalBlob.size,
              fileName: file.name.replace(/\.[^/.]+$/, "") + '.jpg'
            });
          }).catch(reject);

        } catch (procErr) {
          reject(procErr);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a list of processed photo blobs to Firebase Storage.
 * Organized strictly by: defeitos/{issueId}/{photoId}.jpg
 * REGRA: Se várias fotos forem selecionadas e apenas uma falhar, NÃO descarta
 * automaticamente as que foram enviadas com sucesso.
 */
export async function uploadDefectPhotos(
  issueId: string,
  photos: ProcessedPhoto[]
): Promise<UploadedPhotoResult> {
  if (!photos || photos.length === 0) {
    return { photoUrls: [], photoStoragePaths: [], failedCount: 0 };
  }

  // Ensure authenticated session
  await ensureFirebaseAuth();

  const uploadedPaths: string[] = [];
  const uploadedUrls: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const storagePath = `defeitos/${issueId}/foto_${i + 1}_${Date.now()}.jpg`;
    const fileRef = ref(storage, storagePath);

    console.log(`[AndradeAgro Storage] Fazendo upload da foto ${i + 1}/${photos.length}: ${storagePath} (${(p.sizeBytes / 1024).toFixed(1)} KB)`);

    const metadata = {
      contentType: 'image/jpeg',
      customMetadata: {
        issueId,
        originalName: p.fileName,
        uploadedAt: new Date().toISOString()
      }
    };

    try {
      await uploadBytes(fileRef, p.blob, metadata);
      const downloadUrl = await getDownloadURL(fileRef);

      uploadedPaths.push(storagePath);
      uploadedUrls.push(downloadUrl);
    } catch (photoErr: any) {
      const parsedMsg = parseStorageErrorMessage(photoErr);
      console.error(`[AndradeAgro Storage] Erro ao enviar foto ${i + 1}/${photos.length}:`, photoErr);
      errors.push(`Foto ${i + 1} (${p.fileName}): ${parsedMsg}`);
    }
  }

  // Se todas as fotos falharem, lançar erro com a mensagem detalhada da causa
  if (uploadedUrls.length === 0 && photos.length > 0) {
    const mainErrorMsg = errors[0] || 'Falha ao enviar fotos para o servidor de armazenamento.';
    const uploadErr = new Error(mainErrorMsg);
    (uploadErr as any).errors = errors;
    (uploadErr as any).uploadedPaths = uploadedPaths;
    (uploadErr as any).uploadedUrls = uploadedUrls;
    throw uploadErr;
  }

  console.log(`[AndradeAgro Storage] Concluído upload: ${uploadedUrls.length} com sucesso, ${errors.length} falhas.`);

  return {
    photoUrls: uploadedUrls,
    photoStoragePaths: uploadedPaths,
    failedCount: errors.length,
    lastErrorMessage: errors.length > 0 ? errors.join('\n') : undefined,
    errors
  };
}

/**
 * Deletes photos from Firebase Storage associated with a defect.
 * Called when an issue is resolved (Regra 9) or during cleanup.
 */
export async function deleteDefectPhotos(storagePathsOrUrls: string[]): Promise<void> {
  if (!storagePathsOrUrls || storagePathsOrUrls.length === 0) {
    return;
  }

  // Ensure authenticated session
  await ensureFirebaseAuth();

  for (const item of storagePathsOrUrls) {
    if (!item) continue;
    // Ignorar data URLs ou URLs externas não pertencentes ao Firebase Storage
    if (item.startsWith('data:') || item.includes('unsplash.com')) continue;

    try {
      let fileRef;
      if (item.startsWith('http://') || item.startsWith('https://')) {
        fileRef = ref(storage, item);
      } else {
        fileRef = ref(storage, item);
      }

      await deleteObject(fileRef);
      console.log(`[AndradeAgro Storage] Foto removida do Storage com sucesso: ${item}`);
    } catch (delErr: any) {
      if (delErr?.code === 'storage/object-not-found' || delErr?.message?.includes('not-found')) {
        console.info(`[AndradeAgro Storage] Foto já não existia no Storage: ${item}`);
      } else {
        console.warn(`[AndradeAgro Storage] Aviso ao tentar remover foto ${item}:`, delErr?.message || delErr);
      }
    }
  }
}
