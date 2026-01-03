import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Matter from 'matter-js';
import { SimulationConfig } from '../../types/trackA';

/**
 * 模拟画布组件的属性定义
 */
interface SimulationCanvasProps {
  /** 物理模拟的配置参数（质量、长度、角度等） */
  config: SimulationConfig;
}

/**
 * 暴露给父组件的句柄方法
 */
export interface SimulationCanvasHandle {
  /** 获取底层的 HTMLCanvasElement 实例 */
  getCanvas: () => HTMLCanvasElement | null;
}

/**
 * 双摆模拟画布组件
 * 
 * 职责：
 * - 初始化 Matter.js 物理引擎
 * - 根据 config 渲染双摆系统
 * - 处理实时动画循环与轨迹绘制
 * - 提供 Canvas 实例供录制功能使用
 * 
 * @component
 */
const SimulationCanvas = forwardRef<SimulationCanvasHandle, SimulationCanvasProps>(({ config }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current
  }));

  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. 初始化 Matter.js 模块
    const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Constraint = Matter.Constraint,
      Events = Matter.Events;

    const engine = Engine.create();
    engineRef.current = engine;

    const render = Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: 800,
        height: 600,
        wireframes: false,
        background: '#0f172a', // Tailwind slate-900 背景色
      },
    });
    renderRef.current = render;

    // 2. 创建双摆实体
    const centerX = 400;
    const centerY = 150;

    // 锚点（固定不动）
    const anchor = Bodies.circle(centerX, centerY, 10, { isStatic: true, render: { fillStyle: '#64748b' } });

    // 第一个摆臂
    const bob1 = Bodies.circle(
      centerX + config.length1 * Math.sin(config.initialAngle1),
      centerY + config.length1 * Math.cos(config.initialAngle1),
      Math.sqrt(config.mass1) * 4, // 根据质量决定视觉大小
      { 
        mass: config.mass1,
        frictionAir: config.frictionAir,
        render: { fillStyle: config.colorMode === 'neon' ? '#3b82f6' : '#333' }
      }
    );

    const constraint1 = Constraint.create({
      bodyA: anchor,
      bodyB: bob1,
      length: config.length1,
      stiffness: 1,
      render: { strokeStyle: '#475569', lineWidth: 2 }
    });

    // 第二个摆臂
    const bob2 = Bodies.circle(
      bob1.position.x + config.length2 * Math.sin(config.initialAngle2),
      bob1.position.y + config.length2 * Math.cos(config.initialAngle2),
      Math.sqrt(config.mass2) * 4,
      { 
        mass: config.mass2,
        frictionAir: config.frictionAir,
        render: { fillStyle: config.colorMode === 'neon' ? '#ef4444' : '#333' }
      }
    );

    const constraint2 = Constraint.create({
      bodyA: bob1,
      bodyB: bob2,
      length: config.length2,
      stiffness: 1,
      render: { strokeStyle: '#475569', lineWidth: 2 }
    });

    Composite.add(engine.world, [anchor, bob1, bob2, constraint1, constraint2]);

    // 3. 自定义渲染循环（用于绘制轨迹）
    Events.on(render, 'afterRender', () => {
      const context = render.context;
      if (!context) return;

      // Add current position to trail
      trailRef.current.push({ x: bob2.position.x, y: bob2.position.y });
      if (trailRef.current.length > config.trailLength) {
        trailRef.current.shift();
      }

      // Draw trail
      context.beginPath();
      context.strokeStyle = config.colorMode === 'neon' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 0, 0, 0.2)';
      context.lineWidth = 2;
      
      if (trailRef.current.length > 0) {
        context.moveTo(trailRef.current[0].x, trailRef.current[0].y);
        for (let i = 1; i < trailRef.current.length; i++) {
          context.lineTo(trailRef.current[i].x, trailRef.current[i].y);
        }
      }
      context.stroke();
    });

    // 4. Start Simulation
    Render.run(render);
    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    // Cleanup
    return () => {
      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas) {
        // render.canvas.remove(); // React handles DOM removal
      }
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Re-run if config changes drastically? Ideally update bodies instead.

  // Handle Config Updates without full re-mount (Optional optimization for later)
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gravity.scale = 0.001 * config.gravity;
    }
  }, [config.gravity]);

  return (
    <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-slate-900">
      <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-contain" />
      <div className="absolute top-4 left-4 text-xs text-gray-500 pointer-events-none">
        FineSTEM Physics Engine v1.0
      </div>
    </div>
  );
});

export default SimulationCanvas;
