import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Settings2, Download, Zap, Video, Square } from 'lucide-react';
import SimulationCanvas, { SimulationCanvasHandle } from '../../components/TrackA/SimulationCanvas';
import { SimulationConfig, DEFAULT_CONFIG } from '../../types/trackA';
import { useCanvasRecorder } from '../../hooks/useCanvasRecorder';

const PRESETS: Record<string, { label: string; config: SimulationConfig }> = {
  'default': { label: '默认设置', config: DEFAULT_CONFIG },
  'high_chaos': {
    label: '高能混沌',
    config: {
      ...DEFAULT_CONFIG,
      initialAngle1: Math.PI / 2,
      initialAngle2: Math.PI / 2,
      mass1: 15,
      mass2: 15,
      length1: 150,
      length2: 150,
      frictionAir: 0.001
    }
  },
  'low_energy': {
    label: '低能摆动',
    config: {
      ...DEFAULT_CONFIG,
      initialAngle1: Math.PI / 8,
      initialAngle2: 0,
      frictionAir: 0.02,
      gravity: 0.5
    }
  }
};

const TrackA: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [key, setKey] = useState(0); // Force re-mount to reset simulation
  const [exporting, setExporting] = useState(false);
  
  const canvasRef = useRef<SimulationCanvasHandle>(null);
  const { isRecording, startRecording, stopRecording } = useCanvasRecorder({ current: canvasRef.current?.getCanvas() || null });

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setKey(prev => prev + 1);
  };

  const handleRestart = () => {
    setKey(prev => prev + 1);
  };

  const applyPreset = (presetKey: string) => {
    setConfig(PRESETS[presetKey].config);
    setKey(prev => prev + 1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('http://localhost:8001/track-a/config/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await response.json();
      if (data.status === 'success') {
        alert(`配置已导出: ${data.filename}`);
      } else {
        alert('导出失败');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('导出出错，请检查后端服务');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-7xl mx-auto w-full">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          返回首页
        </button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
          Track A: 双摆混沌模拟
        </h1>
        <div className="w-24" /> {/* Spacer */}
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto w-full flex-1">
        
        {/* Left: Simulation Canvas */}
        <div className="flex-1 min-h-[500px] lg:min-h-0">
          <SimulationCanvas key={key} config={config} ref={canvasRef} />
        </div>

        {/* Right: Controls */}
        <div className="w-full lg:w-80 bg-gray-900 p-6 rounded-xl border border-gray-800 h-fit overflow-y-auto max-h-[80vh]">
          <div className="flex items-center gap-2 mb-6 text-blue-400">
            <Settings2 size={20} />
            <h2 className="font-semibold">参数控制</h2>
          </div>

          <div className="space-y-6">
            {/* Presets */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">快速预设 (Presets)</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors border border-gray-700 flex items-center justify-center gap-1"
                  >
                    <Zap size={12} />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gravity */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 flex justify-between">
                <span>重力加速度 (Gravity)</span>
                <span>{config.gravity.toFixed(1)} G</span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.gravity}
                onChange={(e) => setConfig({ ...config, gravity: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Length 1 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 flex justify-between">
                <span>摆臂1长度 (L1)</span>
                <span>{config.length1} px</span>
              </label>
              <input
                type="range"
                min="50"
                max="300"
                step="10"
                value={config.length1}
                onChange={(e) => setConfig({ ...config, length1: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Length 2 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 flex justify-between">
                <span>摆臂2长度 (L2)</span>
                <span>{config.length2} px</span>
              </label>
              <input
                type="range"
                min="50"
                max="300"
                step="10"
                value={config.length2}
                onChange={(e) => setConfig({ ...config, length2: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

             {/* Mass 1 */}
             <div>
              <label className="block text-sm text-gray-400 mb-2 flex justify-between">
                <span>摆球1质量 (M1)</span>
                <span>{config.mass1} kg</span>
              </label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={config.mass1}
                onChange={(e) => setConfig({ ...config, mass1: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Mass 2 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 flex justify-between">
                <span>摆球2质量 (M2)</span>
                <span>{config.mass2} kg</span>
              </label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={config.mass2}
                onChange={(e) => setConfig({ ...config, mass2: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Air Friction */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 flex justify-between">
                <span>空气阻力 (Friction)</span>
                <span>{config.frictionAir.toFixed(3)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="0.1"
                step="0.001"
                value={config.frictionAir}
                onChange={(e) => setConfig({ ...config, frictionAir: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-gray-800 flex flex-col gap-4">
              <div className="flex gap-4">
                <button
                  onClick={handleRestart}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} /> 应用并重启
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-700"
                >
                  重置
                </button>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={16} />
                {exporting ? '导出中...' : '导出配置'}
              </button>
              
              {/* Recording */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  isRecording 
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isRecording ? <Square size={16} fill="currentColor" /> : <Video size={16} />}
                {isRecording ? '停止录制' : '开始录制 (WebM)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackA;
