import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, RefreshCw, Video, Square } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useCanvasRecorder } from '../../hooks/useCanvasRecorder';

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

const TrackE: React.FC = () => {
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<MockDataset | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);
  
  const echartsRef = useRef<ReactECharts>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isRecording, startRecording, stopRecording } = useCanvasRecorder(canvasRef);

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
      try {
        const response = await fetch('http://localhost:8001/track-e/dataset/mock');
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
    
    // Extract current year's data: { name: 'Python', value: 120 }
    // Safeguard: ensure s.data exists and has values
    const currentData = dataset.series
      .filter(s => s.data && s.data.length > currentIndex)
      .map(s => ({
        name: s.name,
        value: s.data[currentIndex]
      }));

    // Sort for bar race effect (ascending for horizontal bar chart yAxis usually)
    // ECharts yAxis category data usually goes bottom to top.
    // If we want top to be highest value, we sort ascending and let ECharts stack them?
    // Actually for simple bar chart, if type: 'category' is yAxis, the first item in data is at bottom.
    // So to put highest value on top, we should sort ascendingly if using default inverted yAxis or check ECharts behavior.
    // Let's sort Ascending (smallest at index 0 -> bottom).
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
        inverse: false, // Default is false (bottom is index 0). Since we sorted Ascending, smallest is bottom. Good.
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
        <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text">
          Track E: 动态数据可视化
        </h1>
        <div className="w-24" />
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                加载数据中... (请确保后端已启动 http://localhost:8001)
            </div>
        ) : !dataset ? (
            <div className="flex-1 flex items-center justify-center text-red-500 flex-col gap-2">
                <p>数据加载失败</p>
                <p className="text-sm text-gray-400">请检查后端服务是否运行在端口 8001</p>
            </div>
        ) : (
            <>
                {/* Controls */}
                <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center gap-6">
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
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
                        onClick={() => { setCurrentIndex(0); setIsPlaying(true); }}
                        className="p-2 text-gray-400 hover:text-white"
                        title="重播"
                    >
                        <RefreshCw size={20} />
                    </button>

                    <div className="w-px h-6 bg-gray-700 mx-2" />

                    <button
                        onClick={isRecording ? stopRecording : startRecording}
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
    </div>
  );
};

export default TrackE;
