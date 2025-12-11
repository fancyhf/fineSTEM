import { useNavigate } from 'react-router-dom';
import { Activity, BarChart3 } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
          FineSTEM
        </h1>
        <p className="text-gray-400 text-xl">Phase 1: MVP 爆破期</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <button
          onClick={() => navigate('/track-a')}
          className="group relative overflow-hidden bg-gray-800 p-8 rounded-2xl border border-gray-700 hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={100} />
          </div>
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-blue-400">
            <Activity /> Track A: 物理反直觉
          </h2>
          <p className="text-gray-400 mb-4">
            基于 Matter.js 的双摆混沌模拟。探索初始条件微小变化带来的蝴蝶效应。
          </p>
          <div className="inline-flex items-center text-sm font-medium text-blue-400 group-hover:translate-x-1 transition-transform">
            进入模拟 &rarr;
          </div>
        </button>

        <button
          onClick={() => navigate('/track-e')}
          className="group relative overflow-hidden bg-gray-800 p-8 rounded-2xl border border-gray-700 hover:border-green-500 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <BarChart3 size={100} />
          </div>
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-green-400">
            <BarChart3 /> Track E: 数据可视化
          </h2>
          <p className="text-gray-400 mb-4">
            Code Never Sleeps. 可视化编程语言流行度演变，洞察技术趋势。
          </p>
          <div className="inline-flex items-center text-sm font-medium text-green-400 group-hover:translate-x-1 transition-transform">
            查看图表 &rarr;
          </div>
        </button>
      </div>
    </div>
  );
};

export default Home;
