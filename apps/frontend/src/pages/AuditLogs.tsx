import { useEffect, useState } from 'react';
import { auditLogsApi } from '../services/api';
import { AuditLogItem } from '../types';

export default function AuditLogs() {
  const [items, setItems] = useState<AuditLogItem[]>([]);

  const load = async () => {
    const res = await auditLogsApi.list();
    setItems(res.data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">审计日志</h1>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">时间</th>
              <th className="px-3 py-2 text-left">模块</th>
              <th className="px-3 py-2 text-left">动作</th>
              <th className="px-3 py-2 text-left">资源</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{new Date(item.created_at).toLocaleString('zh-CN')}</td>
                <td className="px-3 py-2">{item.module}</td>
                <td className="px-3 py-2">{item.action}</td>
                <td className="px-3 py-2">{item.resource_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
