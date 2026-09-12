import React, { useState, useEffect } from 'react';
import { 
  Bell, BellOff, CheckCircle2, AlertTriangle, ShieldCheck, 
  Smartphone, Monitor, Send, RefreshCw 
} from 'lucide-react';
import { User } from '../types';
import { 
  isPushSupported, getNotificationPermission, isStoredPushActive, 
  isSubscriptionActive, enablePushNotifications, disablePushNotifications, 
  sendTestPushNotification 
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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const checkStatus = async () => {
    const isSup = isPushSupported();
    setSupported(isSup);
    if (!isSup) {
      setPermission('unsupported');
      setIsActive(false);
      return;
    }

    const perm = getNotificationPermission();
    setPermission(perm);

    const storedActive = isStoredPushActive(currentUser.id);
    const subActive = await isSubscriptionActive();
    setIsActive(storedActive && subActive && perm === 'granted');
  };

  useEffect(() => {
    checkStatus();

    const handleStatusChange = () => {
      checkStatus();
    };

    window.addEventListener('andradeagro_push_status_changed', handleStatusChange);
    return () => {
      window.removeEventListener('andradeagro_push_status_changed', handleStatusChange);
    };
  }, [currentUser.id]);

  const handleToggle = async () => {
    setLoading(true);
    setFeedback(null);

    if (isActive) {
      const res = await disablePushNotifications(currentUser);
      setIsActive(false);
      setFeedback({ type: 'info', text: res.message });
    } else {
      const res = await enablePushNotifications(currentUser);
      if (res.success) {
        setIsActive(true);
        setPermission('granted');
        setFeedback({ type: 'success', text: res.message });
      } else {
        setPermission(res.status);
        setFeedback({ type: 'error', text: res.message });
      }
    }
    setLoading(false);
    checkStatus();
  };

  const handleTest = async () => {
    setLoading(true);
    setFeedback(null);
    const res = await sendTestPushNotification(currentUser);
    if (res.success) {
      setFeedback({ type: 'success', text: res.message });
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
    setLoading(false);
  };

  // Only ADMIN and MANUTENCAO should see this card per FASE 5 & FASE 11
  if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANUTENCAO') {
    return null;
  }

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
              Firebase Cloud Messaging (FCM) & Web Push
            </p>
          </div>
        </div>

        {/* Real Status Badge */}
        <div>
          {isActive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Ativadas
            </span>
          ) : permission === 'denied' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              Bloqueadas pelo Navegador
            </span>
          ) : !supported ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Não Suportado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-700/40 text-slate-300 border border-slate-600/40">
              Permissão não concedida
            </span>
          )}
        </div>
      </div>

      {/* Description & Details */}
      <p className="text-xs text-slate-300 leading-relaxed">
        Receba notificações instantâneas no seu celular (<span className="text-emerald-300 font-semibold">Android e PWA instalado</span>) e computador sempre que novos eventos críticos forem registrados na operação da AndradeAgro.
      </p>

      {/* Authorized Events Info */}
      <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 text-xs space-y-2">
        <p className="font-bold text-[11px] uppercase tracking-wider text-[#FACC15] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Eventos com Notificação Automática:
        </p>
        <ul className="space-y-1.5 text-[11px] text-slate-200">
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold">⚠️</span>
            <span><strong>Novo problema registrado:</strong> Máquinas e tratores com falhas ou anomalias relatadas.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">🔧</span>
            <span><strong>Nova manutenção registrada:</strong> Serviços e intervenções técnicas executadas na frota.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-300 font-bold">🛢️</span>
            <span><strong>Alerta de troca de óleo:</strong> Aviso preventivo quando o equipamento atinge a condição de troca pendente.</span>
          </li>
        </ul>
        <p className="text-[10px] text-emerald-400/80 pt-1 border-t border-emerald-900/50">
          * Apenas perfis <strong>ADMIN</strong> e <strong>MANUTENÇÃO</strong> recebem estas notificações.
        </p>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div 
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200' 
              : feedback.type === 'error'
                ? 'bg-red-500/20 border border-red-500/40 text-red-200'
                : 'bg-blue-500/20 border border-blue-500/40 text-blue-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#FACC15] shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
        <button
          id="toggle-push-notifications-btn"
          type="button"
          onClick={handleToggle}
          disabled={loading || !supported}
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
          <span>{isActive ? 'Desativar Notificações' : 'Ativar Notificações'}</span>
        </button>

        {isActive && (
          <button
            id="test-push-notification-btn"
            type="button"
            onClick={handleTest}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-[#FACC15] border border-amber-400/40 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 min-h-[44px]"
            title="Enviar uma notificação real de teste para este dispositivo"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Testar Notificação Push</span>
          </button>
        )}
      </div>
    </div>
  );
};
