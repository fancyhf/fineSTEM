import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Demo } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LightRegisterPrompt } from './LightRegisterPrompt';

interface DemoCardProps {
  demo: Demo;
  onFork?: (demo: Demo) => void;
}

export function DemoCard({ demo, onFork }: DemoCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showRegisterPrompt, setShowRegisterPrompt] = React.useState(false);

  const handleFork = () => {
    if (onFork) {
      onFork(demo);
    } else {
      if (!user) {
        setShowRegisterPrompt(true);
        return;
      }
      navigate(`/explore/demos/${demo.id}`);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePlay = () => {
    if (demo.iframe_url || demo.content_url) {
      window.open(demo.iframe_url || demo.content_url, '_blank');
      return;
    }
    navigate(`/explore/demos/${demo.id}?tab=experience`);
  };

  const handleBreakdown = () => {
    navigate(`/explore/demos/${demo.id}?tab=breakdown`);
  };

  const handleSaveToProjects = () => {
    if (!user) {
      setShowRegisterPrompt(true);
      return;
    }
    navigate(`/explore/demos/${demo.id}?action=save`);
  };

  const getScreenshotUrl = (path: string) => {
    if (path.startsWith('http')) return path;
    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const origin = baseUrl.startsWith('http') ? new URL(baseUrl).origin : window.location.origin;
    return `${origin}${path}`;
  };

  const coverImage = demo.screenshots && demo.screenshots.length > 0
    ? getScreenshotUrl(demo.screenshots[0])
    : null;

  return (
    <>
      <Card hoverable className="h-full flex flex-col">
        {coverImage ? (
          <div className="w-full h-[180px] overflow-hidden rounded-t-lg bg-gray-100">
            <img
              src={coverImage}
              alt={demo.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="w-full h-[180px] bg-gradient-to-br from-teal-50 to-cyan-50 rounded-t-lg flex items-center justify-center">
            <span className="text-4xl text-teal-300">
              {demo.display_mode === 'iframe' ? '🎮' : '📸'}
            </span>
          </div>
        )}
        <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-2">
          <Badge className={getDifficultyColor(demo.difficulty)}>
            {demo.difficulty === 'beginner' ? '入门' : demo.difficulty === 'intermediate' ? '中级' : '高级'}
          </Badge>
          <span className="text-sm text-gray-500">
            {demo.view_count} 次查看
          </span>
        </div>
        <CardTitle className="text-xl truncate">{demo.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {demo.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {demo.tech_stack.slice(0, 3).map((tech, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {tech}
            </Badge>
          ))}
          {demo.tech_stack.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{demo.tech_stack.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={handlePlay}>
          试玩
        </Button>
        <Button variant="secondary" size="sm" onClick={handleBreakdown}>
          看拆解
        </Button>
        <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleFork}>
          我也做一个
        </Button>
        <Button variant="secondary" size="sm" onClick={handleSaveToProjects}>
          保存到我的项目
        </Button>
        </CardFooter>
      </Card>
      <LightRegisterPrompt
        open={showRegisterPrompt}
        onClose={() => setShowRegisterPrompt(false)}
      />
    </>
  );
}
