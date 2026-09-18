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
}

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Targets ~200 KB to 500 KB while maintaining high visual clarity of the defect.
 */
export async function compressDefectImage(file: File): Promise<ProcessedPhoto> {
  return new Promise((resolve, reject) => {
    // Validate that it is an image
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Apenas arquivos de imagem (JPG, PNG, WEBP) são permitidos.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo da foto.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem selecionada.'));
      img.onload = () => {
        try {
          const maxDim = 1600; // Sharp enough for defect details without bloating
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

          // Fill white background in case of transparent PNG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Initial quality trial
          let quality = 0.82;
          
          const attemptCompression = (q: number): Promise<Blob> => {
            return new Promise((resBlob, rejBlob) => {
              canvas.toBlob(
                (blob) => {
                  if (blob) resBlob(blob);
                  else rejBlob(new Error('Falha ao gerar arquivo comprimido.'));
                },
                'image/jpeg',
                q
              );
            });
          };

          attemptCompression(quality).then(async (blob) => {
            let finalBlob = blob;
            // Target ~200KB - 500KB. If larger than 550KB, reduce quality step
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
 * Cleans up any uploaded files in this batch if any upload fails (avoiding orphans).
 */
export async function uploadDefectPhotos(
  issueId: string,
  photos: ProcessedPhoto[]
): Promise<UploadedPhotoResult> {
  if (!photos || photos.length === 0) {
    return { photoUrls: [], photoStoragePaths: [] };
  }

  // Ensure authenticated session
  await ensureFirebaseAuth();

  const uploadedPaths: string[] = [];
  const uploadedUrls: string[] = [];

  try {
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

      await uploadBytes(fileRef, p.blob, metadata);
      const downloadUrl = await getDownloadURL(fileRef);

      uploadedPaths.push(storagePath);
      uploadedUrls.push(downloadUrl);
    }

    console.log(`[AndradeAgro Storage] Sucesso no upload de ${uploadedUrls.length} foto(s) para o defeito ${issueId}.`);
    return {
      photoUrls: uploadedUrls,
      photoStoragePaths: uploadedPaths
    };
  } catch (err: any) {
    console.error(`[AndradeAgro Storage] Falha durante upload de fotos do defeito ${issueId}:`, err);
    // Rollback uploaded photos from this attempt to avoid orphan files (Regra 10)
    if (uploadedPaths.length > 0) {
      console.warn(`[AndradeAgro Storage] Limpando ${uploadedPaths.length} arquivo(s) enviados antes da falha...`);
      await deleteDefectPhotos(uploadedPaths).catch(() => {});
    }
    throw err;
  }
}

/**
 * Deletes photos from Firebase Storage associated with a defect.
 * Called when an issue is resolved (Regra 9) or during rollback.
 */
export async function deleteDefectPhotos(storagePathsOrUrls: string[]): Promise<void> {
  if (!storagePathsOrUrls || storagePathsOrUrls.length === 0) {
    return;
  }

  // Ensure authenticated session
  await ensureFirebaseAuth();

  for (const item of storagePathsOrUrls) {
    if (!item) continue;
    try {
      let fileRef;
      if (item.startsWith('http://') || item.startsWith('https://')) {
        // Direct reference by URL
        fileRef = ref(storage, item);
      } else {
        // Direct path
        fileRef = ref(storage, item);
      }

      await deleteObject(fileRef);
      console.log(`[AndradeAgro Storage] Foto removida do Storage com sucesso: ${item}`);
    } catch (delErr: any) {
      // If the object was already deleted or doesn't exist, ignore error safely
      if (delErr?.code === 'storage/object-not-found' || delErr?.message?.includes('not-found')) {
        console.info(`[AndradeAgro Storage] Foto já não existia no Storage: ${item}`);
      } else {
        console.warn(`[AndradeAgro Storage] Aviso ao tentar remover foto ${item}:`, delErr?.message || delErr);
      }
    }
  }
}
