import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { achievementCardsApi, documentsApi } from '../services/api';
import { AchievementCard, PublicProjectDocument } from '../types';
import { AchievementCardView } from '../components/AchievementCardView';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { ProcessDocumentList } from '../components/ProcessDocumentList';
import { Button } from '../components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export default function SharedAchievement() {
  const { token } = useParams<{ token: string }>();
  const [achievement, setAchievement] = useState<AchievementCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processDocuments, setProcessDocuments] = useState<PublicProjectDocument[]>([]);
  const [processDocumentsLoading, setProcessDocumentsLoading] = useState(false);
  const [viewingProcessDocument, setViewingProcessDocument] = useState<PublicProjectDocument | null>(null);

  const loadSharedAchievement = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await achievementCardsApi.getShared(token);
      if (response.data) {
        setAchievement(response.data);
      }
    } catch (err) {
      setError('分享链接无效或已过期');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSharedAchievement();
  }, [loadSharedAchievement]);

  useEffect(() => {
    if (!achievement?.is_public) return;
    let cancelled = false;
    const loadDocuments = async () => {
      setProcessDocumentsLoading(true);
      try {
        const response = await documentsApi.listPublic(achievement.id);
        if (!cancelled) setProcessDocuments(response.data || []);
      } catch (loadError) {
        console.error('[shared_achievement:documents] 加载失败:', loadError);
        if (!cancelled) setProcessDocuments([]);
      } finally {
        if (!cancelled) setProcessDocumentsLoading(false);
      }
    };
    void loadDocuments();
    return () => { cancelled = true; };
  }, [achievement]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !achievement) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4 text-lg">{error || '分享链接无效'}</p>
          <Button onClick={() => window.location.href = '/'}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            回到首页
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <AchievementCardView achievement={achievement} />
        {achievement.is_public && (
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-xl font-semibold text-gray-900">过程文档</h2>
            <p className="mt-1 mb-4 text-sm text-gray-500">阅读项目从想法到成果的真实过程。</p>
            <ProcessDocumentList
              documents={processDocuments}
              loading={processDocumentsLoading}
              onView={(document) => {
                const fullDocument = processDocuments.find((item) => item.stage === document.stage);
                if (fullDocument) setViewingProcessDocument(fullDocument);
              }}
            />
          </section>
        )}
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={() => window.location.href = '/'}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            探索更多项目
          </Button>
        </div>
      </div>
      {viewingProcessDocument && (
        <DocumentViewerModal
          title={viewingProcessDocument.name}
          content={viewingProcessDocument.content}
          onClose={() => setViewingProcessDocument(null)}
        />
      )}
    </div>
  );
}
