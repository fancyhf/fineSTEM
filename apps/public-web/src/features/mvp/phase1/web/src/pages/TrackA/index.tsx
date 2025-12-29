import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Settings2, Download, Zap, Video, Square, Code2 } from 'lucide-react';
import SimulationCanvas, { SimulationCanvasHandle } from '../../components/TrackA/SimulationCanvas';
import { SimulationConfig, DEFAULT_CONFIG } from '../../types/trackA';
import { useCanvasRecorder } from '../../hooks/useCanvasRecorder';
import { useAnalytics } from '../../hooks/useAnalytics';
import { AIChatPanel } from '../../components/Shared/AIChatPanel';
import { CodeTourConfig, PresetQuestion } from '../../types/system';

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
  const [showCode, setShowCode] = useState(false);
  
  const canvasRef = useRef<SimulationCanvasHandle>(null);
  const { isRecording, startRecording, stopRecording } = useCanvasRecorder(() => canvasRef.current?.getCanvas() || null);
  const { logEvent } = useAnalytics();

  const handleReset = () => {
    logEvent({ category: 'track_a', event_name: 'reset' });
    setConfig(DEFAULT_CONFIG);
    setKey(prev => prev + 1);
  };

  const handleRestart = () => {
    logEvent({ category: 'track_a', event_name: 'restart' });
    setKey(prev => prev + 1);
  };

  const applyPreset = (presetKey: string) => {
    logEvent({ category: 'track_a', event_name: 'apply_preset', metadata: { preset: presetKey } });
    setConfig(PRESETS[presetKey].config);
    setKey(prev => prev + 1);
  };

  const handleExport = async () => {
    setExporting(true);
    logEvent({ category: 'track_a', event_name: 'export_config' });
    
    // Debug logging
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const trackAPath = apiBaseUrl.endsWith('/') ? `track-a/config/export` : `/track-a/config/export`;
    const apiUrl = `${apiBaseUrl}${trackAPath}`;
    console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
    console.log('Full API URL:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
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

  // 1. Generate pseudo-code string
  const codeSnippet = `
// --- 物理引擎核心代码 (Physics Core) ---

// 1. 设置世界重力
// 当前值: ${config.gravity} (标准地球重力约为 1.0)
engine.world.gravity.y = ${config.gravity};

// 2. 创建第一个摆球 (上方的球)
const bob1 = Bodies.circle(x, y, size, {
    mass: ${config.mass1}, 
    frictionAir: ${config.frictionAir} 
});

// 3. 创建第一根连杆
const stick1 = Constraint.create({
    bodyA: anchor,
    bodyB: bob1,
    length: ${config.length1}, 
    stiffness: 1
});

// 4. 创建第二个摆球 (下方的球)
const bob2 = Bodies.circle(x, y, size, {
    mass: ${config.mass2},
    frictionAir: ${config.frictionAir}
});
`;

  // 2. Define Tour Steps
  const tourConfig: CodeTourConfig = {
    codeSnippet,
    steps: [
      {
        id: 'gravity',
        title: '步骤 1: 设置重力',
        description: '首先，我们需要定义物理世界的规则。重力决定了物体下落的速度。如果将重力设为 0，小球就会像在太空中一样漂浮。',
        highlightLines: { start: 4, end: 6 }
      },
      {
        id: 'bob1',
        title: '步骤 2: 创建摆球 1',
        description: '我们创建第一个小球（Bob 1）。"mass" 是质量，决定了它的惯性；"frictionAir" 是空气阻力，阻力越小，它摆动的时间就越长。',
        highlightLines: { start: 9, end: 12 }
      },
      {
        id: 'stick1',
        title: '步骤 3: 连接摆球',
        description: '使用 "Constraint"（约束）将小球连接到固定点。这就好比一根不可伸缩的棍子，限制了小球的运动范围。',
        highlightLines: { start: 15, end: 20 }
      },
      {
        id: 'bob2',
        title: '步骤 4: 引入混沌',
        description: '关键的一步！我们在第一个小球下面再挂一个球。正是这第二个球的加入，让整个系统的运动变得不可预测，产生了神奇的"混沌现象"。',
        highlightLines: { start: 23, end: 26 }
      }
    ]
  };

  // 3. Define Preset Questions
  const presetQuestions: PresetQuestion[] = [
    { id: 'q1', label: '如何停下来？', question: '怎么让双摆停下来？' },
    { id: 'q2', label: '重力为0', question: '如果把重力改为0会发生什么？' },
    { id: 'q3', label: '什么是混沌？', question: '请简单解释一下什么是混沌效应？' },
    { id: 'q4', label: '增加质量', question: '增加下方小球的质量会怎么影响摆动？' }
  ];

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
        <div className="flex gap-2">
           <button
            onClick={() => setShowCode(!showCode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              showCode 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Code2 size={18} />
            {showCode ? '隐藏代码' : '原理揭秘'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto w-full flex-1 relative">
        
        {/* Left: Simulation Canvas */}
        <div className={`flex-1 bg-gray-900 rounded-2xl border border-gray-800 p-1 relative overflow-hidden shadow-2xl transition-all duration-300 ${showCode ? 'lg:mr-[440px]' : ''}`}>
          <SimulationCanvas key={key} config={config} ref={canvasRef} />
        </div>

        {/* Right: Controls */}
        <div className={`w-full bg-gray-900 p-6 rounded-xl border border-gray-800 h-fit overflow-y-auto max-h-[80vh] transition-all duration-300 ${showCode ? 'hidden lg:block fixed right-[460px] top-[88px] w-64 z-40' : 'lg:w-80'}`}>
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
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                    logEvent({ category: 'track_a', event_name: 'stop_recording' });
                  } else {
                    startRecording();
                    logEvent({ category: 'track_a', event_name: 'start_recording' });
                  }
                }}
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
      {/* AI Chat Panel - Fixed Overlay */}
      <AIChatPanel 
        isOpen={showCode}
        title="代码实验室 (Code Lab)"
        contextData={config}
        contextType="code"
        tourConfig={tourConfig}
        presetQuestions={presetQuestions}
        onClose={() => setShowCode(false)} 
      />
    </div>
  );
};

export default TrackA;
