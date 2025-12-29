import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, RefreshCw, Video, Square, Code2 } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useCanvasRecorder } from '../../hooks/useCanvasRecorder';
import { useAnalytics } from '../../hooks/useAnalytics';
import { AIChatPanel } from '../../components/Shared/AIChatPanel';
import { CodeTourConfig, PresetQuestion } from '../../types/system';

interface SeriesData {
  name: string;
  data: number[];
}

interface MockDataset {
  meta: any;
  timeline: string[];
  categories: string[];
  series: SeriesData[];
}

export default function TrackE() {
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<MockDataset | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const timerRef = useRef<number | null>(null);
  
  const echartsRef = useRef<ReactECharts>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isRecording, startRecording, stopRecording } = useCanvasRecorder(() => canvasRef.current);
  const { logEvent } = useAnalytics();

  // Sync ECharts canvas to ref for recording
  useEffect(() => {
    if (echartsRef.current) {
      const echartInstance = echartsRef.current.getEchartsInstance();
      const canvas = echartInstance.getDom().querySelector('canvas');
      if (canvas) {
        // @ts-ignore
        canvasRef.current = canvas;
      }
    }
  }, [dataset, loading]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      // Debug logging
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const trackEPath = apiBaseUrl.endsWith('/') ? `track-e/dataset/mock` : `/track-e/dataset/mock`;
      const apiUrl = `${apiBaseUrl}${trackEPath}`;
      console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
      console.log('Full API URL:', apiUrl);
      
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setDataset(data);
        // Start playing automatically once data is loaded
        setIsPlaying(true);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Animation Loop
  useEffect(() => {
    if (isPlaying && dataset) {
      timerRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= dataset.timeline.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000); // 1 second per year
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, dataset]);

  // Generate Chart Option
  const getOption = useMemo(() => {
    if (!dataset || !dataset.series || !Array.isArray(dataset.series)) return {};

    const year = dataset.timeline[currentIndex];
    
    // Extract current year's data
    const currentData = dataset.series
      .filter(s => s.data && s.data.length > currentIndex)
      .map(s => ({
        name: s.name,
        value: s.data[currentIndex]
      }));

    // Sort for bar race effect
    currentData.sort((a, b) => a.value - b.value);

    return {
      title: {
        text: `编程语言热度排行 - ${year}`,
        subtext: '数据来源: Mock Data (Track E)',
        left: 'center',
        textStyle: { color: '#fff', fontSize: 24 }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        top: 80,
        bottom: 30,
        left: 150,
        right: 80
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#aaa' },
        splitLine: { lineStyle: { color: '#333' } }
      },
      yAxis: {
        type: 'category',
        data: currentData.map(d => d.name),
        axisLabel: { 
          color: '#fff',
          fontSize: 14,
          fontWeight: 'bold'
        },
        axisTick: { show: false },
        axisLine: { show: false },
        inverse: false,
        animationDuration: 300,
        animationDurationUpdate: 300
      },
      series: [
        {
          type: 'bar',
          data: currentData.map(d => d.value),
          label: {
            show: true,
            position: 'right',
            color: '#fff',
            formatter: '{c}'
          },
          itemStyle: {
            color: (params: any) => {
              const colors: Record<string, string> = {
                'Python': '#3776ab',
                'JavaScript': '#f7df1e',
                'Java': '#b07219',
                'C++': '#f34b7d',
                'C#': '#178600',
                'PHP': '#4F5D95',
                'Go': '#00ADD8',
                'Rust': '#dea584'
              };
              return colors[params.name] || '#5470c6';
            },
            borderRadius: [0, 4, 4, 0]
          },
          realtimeSort: true,
          seriesLayoutBy: 'column',
          animationDuration: 1000,
          animationDurationUpdate: 1000,
          animationEasing: 'linear',
          animationEasingUpdate: 'linear'
        }
      ],
      backgroundColor: 'transparent',
      animationDurationUpdate: 1000,
      animationEasingUpdate: 'quinticInOut'
    };
  }, [dataset, currentIndex]);

  // 1. Generate pseudo-code string
  const codeSnippet = `
// --- 数据可视化核心逻辑 (Data Visualization) ---

// 1. 获取动态数据集
const response = await fetch('/track-e/dataset/mock');

// 2. 动态生成图表配置
const getOption = () => {
  return {
    xAxis: { type: 'value', max: 'dataMax' },
    yAxis: { 
      type: 'category', 
      data: ['Python', 'Java', 'JS', ...],
      inverse: true 
    },
    series: [{
      type: 'bar',
      data: currentYearData,
      realtimeSort: true, // 开启实时排序
      label: { show: true, valueAnimation: true }
    }]
  };
};

// 3. 动画循环
setInterval(() => {
  setCurrentIndex(prev => prev + 1);
}, 1000);
`;

  // 2. Define Tour Steps
  const tourConfig: CodeTourConfig = useMemo(() => ({
    codeSnippet,
    steps: [
      {
        id: 'fetch',
        title: '步骤 1: 获取数据',
        description: '首先，我们从后端 API 获取历史数据。这个数据集包含了从 2000 年到 2023 年各种编程语言的热度指数。',
        highlightLines: { start: 4, end: 5 }
      },
      {
        id: 'config',
        title: '步骤 2: 配置图表',
        description: '使用 ECharts 的配置对象来定义 X 轴（数值）和 Y 轴（编程语言类别）。注意 Y 轴开启了 "inverse: true"，这样排名第一的会在最上面。',
        highlightLines: { start: 8, end: 16 }
      },
      {
        id: 'realtime',
        title: '步骤 3: 实时排序',
        description: '这是 Bar Chart Race 的核心魔法！开启 "realtimeSort: true" 后，当数据变化时，ECharts 会自动计算并平滑地移动柱子的位置，实现"赛跑"的效果。',
        highlightLines: { start: 17, end: 21 }
      },
      {
        id: 'loop',
        title: '步骤 4: 时间循环',
        description: '最后，我们设置一个定时器，每隔 1 秒将时间推进到下一年，并触发图表重绘。这样就形成了连续的动画。',
        highlightLines: { start: 26, end: 28 }
      }
    ]
  }), [codeSnippet]);

  // 3. Define Preset Questions
  const presetQuestions: PresetQuestion[] = useMemo(() => [
    { id: 'q1', label: 'Python崛起', question: '为什么Python在2012年后突然火了？' },
    { id: 'q2', label: '原理揭秘', question: '请解释一下 Bar Chart Race 的实现原理？' },
    { id: 'q3', label: '修改速度', question: '如何让动画播放得更快一点？' },
    { id: 'q4', label: '数据来源', question: '这些数据是从哪里来的？是真实的吗？' }
  ], []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 flex flex-col">
       {/* Header */}
      <div className={`flex items-center justify-between mb-8 w-full transition-all duration-300 ${showCode ? 'px-4' : 'max-w-7xl mx-auto'}`}>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          返回首页
        </button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text">
          Track E: 编程语言热度 (数据可视化)
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
      <div className={`flex flex-col lg:flex-row gap-8 w-full flex-1 transition-all duration-300 ${showCode ? 'px-4' : 'max-w-7xl mx-auto'}`}>
        
        {/* Left: Chart Area */}
        <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-800 p-1 relative overflow-hidden shadow-2xl flex flex-col">
        {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                加载数据中...
            </div>
        ) : !dataset ? (
            <div className="flex-1 flex items-center justify-center text-red-500 flex-col gap-2">
                <p>数据加载失败</p>
                <p className="text-sm text-gray-400">请检查网络连接或稍后重试</p>
            </div>
        ) : (
            <>
                {/* Controls */}
                <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center gap-6">
                    <button 
                        onClick={() => {
                            if (!isPlaying && dataset && currentIndex >= dataset.timeline.length - 1) {
                                setCurrentIndex(0);
                            }
                            setIsPlaying(!isPlaying);
                            logEvent({ category: 'track_e', event_name: isPlaying ? 'pause' : 'play' });
                        }}
                        className={`p-3 rounded-full ${isPlaying ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'} hover:bg-opacity-30 transition-colors`}
                    >
                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>
                    
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="flex justify-between text-sm text-gray-400">
                            <span>年份: {dataset.timeline[currentIndex]}</span>
                            <span>进度: {Math.round((currentIndex / (dataset.timeline.length - 1)) * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max={dataset.timeline.length - 1} 
                            value={currentIndex} 
                            onChange={(e) => {
                                setCurrentIndex(parseInt(e.target.value));
                                setIsPlaying(false);
                            }}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                        />
                    </div>

                    <button 
                        onClick={() => { 
                            setCurrentIndex(0); 
                            setIsPlaying(true); 
                            logEvent({ category: 'track_e', event_name: 'restart' });
                        }}
                        className="p-2 text-gray-400 hover:text-white"
                        title="重播"
                    >
                        <RefreshCw size={20} />
                    </button>

                    <div className="w-px h-6 bg-gray-700 mx-2" />

                    <button
                        onClick={() => {
                            if (isRecording) {
                                stopRecording();
                                logEvent({ category: 'track_e', event_name: 'stop_recording' });
                            } else {
                                startRecording();
                                logEvent({ category: 'track_e', event_name: 'start_recording' });
                            }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                            isRecording 
                            ? 'bg-red-600 hover:bg-red-700 animate-pulse text-white' 
                            : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30'
                        }`}
                    >
                        {isRecording ? <Square size={16} fill="currentColor" /> : <Video size={16} />}
                        {isRecording ? '停止' : '录制'}
                    </button>
                </div>

                {/* Chart Area */}
                <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-4 min-h-[600px]">
                    <ReactECharts 
                        ref={echartsRef}
                        option={getOption} 
                        style={{ height: '100%', width: '100%', minHeight: '600px' }} 
                        opts={{ renderer: 'canvas' }}
                    />
                </div>
            </>
        )}
      </div>

      {/* Right Sidebar (Controls + Code) */}
      <div className={`flex flex-col gap-6 w-full lg:w-96 shrink-0 transition-all duration-300 ${showCode ? 'lg:mr-[440px]' : ''}`}>
          {/* Controls Panel (Existing code retained) */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl h-fit">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <RefreshCw className={isPlaying ? "animate-spin" : ""} size={20} />
              控制台
            </h2>

            <div className="space-y-6">
              {/* Playback Controls */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">当前年份</span>
                  <span className="text-2xl font-mono font-bold text-green-400">
                    {dataset?.timeline[currentIndex] || '----'}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!isPlaying && dataset && currentIndex >= dataset.timeline.length - 1) {
                        setCurrentIndex(0);
                      }
                      setIsPlaying(!isPlaying);
                    }}
                    className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                      isPlaying 
                        ? 'bg-yellow-600 hover:bg-yellow-500 text-white' 
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    {isPlaying ? '暂停演示' : '开始演示'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentIndex(0);
                    }}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
                    title="重置"
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
              </div>

              {/* Recording Controls */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                 <h3 className="text-sm font-medium text-gray-400 mb-3">实验记录</h3>
                 <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {isRecording ? <Square size={20} fill="currentColor" /> : <Video size={20} />}
                  {isRecording ? '停止录制' : '录制实验视频'}
                </button>
                {isRecording && (
                  <div className="mt-2 text-center text-xs text-red-400 font-mono">
                    ● 正在录制中...
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>

      {/* Code Explainer (Inline) */}
      {showCode && (
        <AIChatPanel 
          title="数据分析室 (Data Lab)"
          contextData={dataset}
          contextType="data"
          tourConfig={tourConfig}
          presetQuestions={presetQuestions}
          onClose={() => setShowCode(false)} 
        />
      )}
      </div>
    </div>
  );
}
