/**
 * Opens a print document in a new tab/window without blocking or freezing the main application event loop.
 * Uses Blob URL with 'noopener,noreferrer' to completely isolate the new window process from the main app thread.
 */
export function openPrintWindow(htmlContent: string): void {
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    
    // Using noopener,noreferrer ensures the popup window runs in its own process/thread
    // preventing window.print() from freezing the main application.
    const printWin = window.open(blobUrl, '_blank', 'noopener,noreferrer');

    if (!printWin) {
      alert('Por favor, permita popups no navegador para abrir a janela de impressão.');
      URL.revokeObjectURL(blobUrl);
      return;
    }

    // Revoke the object URL after 2 minutes to free memory
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 120000);
  } catch (err) {
    console.error('Erro ao abrir janela de impressão:', err);
    alert('Erro ao abrir janela de impressão. Tente novamente.');
  }
}
