import { useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';
import { authApi, authStorage } from '../services/api';
import { useState } from 'react';

interface LightRegisterPromptProps {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
}

export function LightRegisterPrompt({
  open,
  title = '注册后可继续完整使用',
  description = '登录后可无限对话、保存项目并同步到研究空间。',
  onClose,
}: LightRegisterPromptProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{description}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            先看看
          </Button>
          <Button variant="secondary" onClick={() => navigate('/login')}>
            去登录
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setSubmitting(true);
              try {
                const res = await authApi.lightRegister();
                if (res.data) {
                  authStorage.setToken(res.data.access_token);
                  authStorage.setUser(res.data.user);
                  localStorage.setItem('anonymous_chat_count', '0');
                  onClose();
                  window.location.reload();
                }
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
          >
            轻注册继续
          </Button>
          <Button onClick={() => navigate('/register')}>
            立即注册
          </Button>
        </div>
      </div>
    </div>
  );
}
