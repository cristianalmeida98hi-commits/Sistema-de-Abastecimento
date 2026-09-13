import React, { useState, useEffect } from 'react';
import { 
  Bell, BellOff, CheckCircle2, AlertTriangle, ShieldCheck, 
  Smartphone, Monitor, Send, RefreshCw, SmartphoneCharging, Info
} from 'lucide-react';
import { User } from '../types';
import { 
  isPushSupported, getNotificationPermission, isStoredPushActive, 
  isSubscriptionActive, enablePushNotifications, disablePushNotifications, 
  sendTestPushNotification, fetchServerNotificationStatus 
} from '../utils/pushNotifications';

interface PushNotificationSettingsCardProps {
  currentUser: User;
  darkMode?: boolean;
}

export const PushNotificationSettingsCard: React.FC<PushNotificationSettingsCardProps> = ({
  currentUser,
  darkMode = true
}) => {
  const [supported, setSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isActive, setIsActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<{
    activeAuthorizedCount: number;
    authorizedDevices: Array<{ userName: string; userRole: string; platform: string; updatedAt: string }>;
  } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const checkStatus = async () => {
    try {
      const isSup = isPushSupported();
      setSupported(isSup);
      if (!isSup) {
        setPermission('unsupported');
        setIsActive(false);
        return;
      }

      const perm = getNotificationPermission();
      setPermission(perm);

      const userId = currentUser?.id || '';
      const storedActive = userId ? isStoredPushActive(userId) : false;
      const subActive = await isSubscriptionActive().catch(() => false);
      setIsActive(Boolean(storedActive && subActive && perm === 'granted'));

      const sStatus = await fetchServerNotificationStatus().catch(() => null);
      if (sStatus) {
        setServerStatus({
          activeAuthorizedCount: Number(sStatus.activeAuthorizedCount) || 0,
          authorizedDevices: Array.isArray(sStatus.authorizedDevices) ? sStatus.authorizedDevices : []
        });
      }
    } catch (err) {
      console.warn('[Push Notification Card] Aviso ao verificar status push:', err);
    }
  };

  useEffect(() => {
    checkStatus();

    const handleStatusChange = () => {
      checkStatus().catch(() => {});
    };

    window.addEventListener('andradeagro_push_status_changed', handleStatusChange);
    return () => {
      window.removeEventListener('andradeagro_push_status_changed', handleStatusChange);
    };
  }, [currentUser?.id]);

  const handleToggle = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLoading(true);
    setFeedback(null);

    try {
      if (isActive) {
        const res = await disablePushNotifications(currentUser);
        setIsActive(false);
        const safeText = typeof res?.message === 'string' ? res.message : 'Notificações push desativadas.';
        setFeedback({ type: 'info', text: safeText });
      } else {
        const res = await enablePushNotifications(currentUser);
        if (res?.success) {
          setIsActive(true);
          setPermission('granted');
          const safeText = typeof res?.message === 'string' ? res.message : 'Notificações push ativadas com sucesso!';
          setFeedback({ type: 'success', text: safeText });
        } else {
          const statusStr = String(res?.status || '');
          const permVal: NotificationPermission | 'unsupported' = 
            (statusStr === 'granted' || statusStr === 'denied' || statusStr === 'default')
              ? (statusStr as NotificationPermission)
              : 'denied';
          setPermission(permVal);
          const safeText = typeof res?.message === 'string' ? res.message : 'Não foi possível ativar as notificações.';
          setFeedback({ type: 'error', text: safeText });
        }
      }
    } catch (err: any) {
      console.error('[Push Notification Card] Erro ao alternar status push:', err);
      const errMsg = typeof err?.message === 'string' ? err.message : String(err || 'Erro inesperado');
      setFeedback({ type: 'error', text: `Falha na operação: ${errMsg}` });
    } finally {
      setLoading(false);
      try {
        await checkStatus();
      } catch {}
    }
  };

  const handleSync = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSyncing(true);
    setFeedback(null);

    try {
      const res = await enablePushNotifications(currentUser);
      if (res?.success) {
        setIsActive(true);
        setPermission('granted');
        setFeedback({ type: 'success', text: 'Dispositivo sincronizado com o servidor e Firestore!' });
      } else {
        const safeText = typeof res?.message === 'string' ? res.message : 'Falha ao sincronizar dispositivo.';
        setFeedback({ type: 'error', text: safeText });
      }
    } catch (err: any) {
      console.error('[Push Notification Card] Erro ao sincronizar:', err);
      const errMsg = typeof err?.message === 'string' ? err.message : String(err || 'Erro inesperado');
      setFeedback({ type: 'error', text: `Falha ao sincronizar: ${errMsg}` });
    } finally {
      setSyncing(false);
      try {
        await checkStatus();
      } catch {}
    }
  };

  const handleTest = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLoading(true);
    setFeedback(null);

    try {
      const res = await sendTestPushNotification(currentUser);
      const safeText = typeof res?.message === 'string' && res.message.trim().length > 0
        ? res.message
        : res?.success
          ? 'Notificação de teste enviada com sucesso!'
          : 'Não foi possível enviar a notificação de teste.';

      if (res?.success) {
        setFeedback({ type: 'success', text: safeText });
      } else {
        setFeedback({ type: 'error', text: safeText });
      }
    } catch (err: any) {
      console.error('[Push Notification Card] Erro ao testar notificação:', err);
      const errMsg = typeof err?.message === 'string' ? err.message : String(err || 'Erro inesperado');
      setFeedback({ type: 'error', text: `Falha ao testar notificação: ${errMsg}` });
    } finally {
      setLoading(false);
      try {
        await checkStatus();
      } catch {}
    }
  };

  if (!currentUser) {
    return null;
  }

  const isCurrentDeviceRegistered = Boolean(
    serverStatus?.authorizedDevices?.some(d => d && d.userName === currentUser?.name)
  );

  return (
    <div 
      id="push-notification-settings-card"
      className={`p-6 rounded-3xl border space-y-4 transition-all ${
        darkMode 
          ? 'bg-[#042d23] border-emerald-800/80 shadow-md text-emerald-100' 
          : 'bg-white border-emerald-100 shadow-sm text-gray-800'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between border-b pb-3 border-emerald-800/40">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isActive ? 'bg-amber-400 text-gray-950' : 'bg-emerald-900/60 text-emerald-300'}`}>
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-100">
              Notificações Push em Tempo Real
            </h3>
            <p className="text-[11px] text-emerald-400/90 font-medium">
              Web Push & FCM (Android, iOS PWA e Desktop)
            </p>
          </div>
        </div>

        {/* Real Status Badge */}
        <div>
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Ativadas neste dispositivo
            </span>
          ) : permission === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              Bloqueadas no Navegador
            </span>
          ) : !supported ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Não Suportado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-700/40 text-slate-300 border border-slate-600/40">
              Inativas neste dispositivo
            </span>
          )}
        </div>
      </div>

      {/* Description & Details */}
      <p className="text-xs text-slate-300 leading-relaxed">
        Receba notificações sonoras e visuais diretamente no celular (<strong className="text-emerald-300">Android Chrome ou PWA instalado</strong>) mesmo com o aplicativo fechado ou em segundo plano.
      </p>

      {/* Diagnostic status strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
        <div className="p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/30 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#FACC15] shrink-0" />
          <div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase">Permissão Navegador</div>
            <div className="font-bold text-slate-100 capitalize">
              {permission === 'granted' ? 'Concedida' : permission === 'denied' ? 'Bloqueada' : 'Não Solicitada'}
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/30 flex items-center gap-2">
          <SmartphoneCharging className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase">Dispositivos no Servidor</div>
            <div className="font-bold text-slate-100">
              {serverStatus ? `${serverStatus.activeAuthorizedCount} ativo(s)` : 'Consultando...'}
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/30 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase">Destinatários</div>
            <div className="font-bold text-slate-100">Dispositivos Permitidos</div>
          </div>
        </div>
      </div>

      {/* Authorized Events Info */}
      <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 text-xs space-y-2">
        <p className="font-bold text-[11px] uppercase tracking-wider text-[#FACC15] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Eventos que enviam Notificação Push ao Celular:
        </p>
        <ul className="space-y-1.5 text-[11px] text-slate-200">
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold">⚠️</span>
            <span><strong>Novo problema relatado:</strong> Alerta imediato com máquina, descrição e operador.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">🔧</span>
            <span><strong>Nova manutenção registrada:</strong> Registro técnico de revisão ou reparo concluído.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-300 font-bold">🛢️</span>
            <span><strong>Alerta de troca de óleo:</strong> Notificação automática de troca de óleo vencida por horímetro ou quilometragem.</span>
          </li>
        </ul>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div 
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 whitespace-pre-line ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200' 
              : feedback.type === 'error'
                ? 'bg-red-500/20 border border-red-500/40 text-red-200'
                : 'bg-blue-500/20 border border-blue-500/40 text-blue-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#FACC15] shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <span>{String(feedback.text || '')}</span>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <button
            id="toggle-push-notifications-btn"
            type="button"
            onClick={handleToggle}
            disabled={loading || syncing || !supported}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 min-h-[44px] ${
              isActive 
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40' 
                : 'bg-[#064E3B] hover:bg-emerald-800 text-white border border-emerald-600/60'
            }`}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#FACC15]" />
            ) : isActive ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4 text-[#FACC15]" />
            )}
            <span>{isActive ? 'Desativar Notificações' : 'Ativar Notificações Push'}</span>
          </button>

          {isActive && (
            <button
              id="resync-push-device-btn"
              type="button"
              onClick={handleSync}
              disabled={loading || syncing}
              className="px-3 py-2.5 rounded-xl bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200 border border-emerald-700/50 font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
              title="Revalidar chave VAPID e reinscrever token no servidor"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-[#FACC15]' : ''}`} />
              <span>Sincronizar</span>
            </button>
          )}
        </div>

        {(isActive || permission === 'granted') && (
          <button
            id="test-push-notification-btn"
            type="button"
            onClick={handleTest}
            disabled={loading || syncing}
            className="px-4 py-2.5 rounded-xl bg-[#FACC15] hover:bg-amber-400 text-gray-950 font-black text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
            title="Envia uma notificação push real de teste para este dispositivo"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{loading ? 'Enviando...' : 'Testar Notificação'}</span>
          </button>
        )}
      </div>

      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
        <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>No iPhone (iOS 16.4+), use "Compartilhar" &rarr; "Adicionar à Tela de Início" no Safari para habilitar notificações push. No Android, basta autorizar no Chrome.</span>
      </div>
    </div>
  );
};
