# 代码注释规范示例（强制中文）

## Python 类与函数

```python
class SimulationConfig(BaseModel):
    """
    物理模拟配置参数模型。

    职责：
    - 定义双摆系统的物理属性（质量、长度、重力等）
    - 提供参数校验与默认值
    - 支持 JSON 序列化与反序列化

    依赖：
    - pydantic.BaseModel
    """
    # 摆锤1的质量（kg），必须大于0
    mass1: float = Field(..., gt=0, description='摆锤1质量')

    def calculate_energy(self) -> float:
        """
        计算当前系统的总机械能。

        Returns:
            float: 总能量（动能 + 势能），单位：焦耳 (J)

        Raises:
            ValueError: 如果系统状态未初始化
        """
        # 这里使用简化公式，忽略转动惯量
        # TODO: 后续版本需引入刚体动力学修正
        return 0.5 * self.mass1 * self.velocity ** 2
```

## TypeScript 接口与组件

```typescript
/**
 * 模拟画布组件
 *
 * 职责：
 * - 渲染双摆系统的实时动画
 * - 处理用户交互（拖拽、缩放）
 * - 管理 Matter.js 物理引擎实例
 *
 * @component
 * @example
 * <SimulationCanvas config={defaultConfig} onUpdate={handleUpdate} />
 */
export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ config }) => {
  // 使用 useRef 保持物理引擎实例，避免重渲染导致重置
  const engineRef = useRef<Matter.Engine | null>(null);

  /**
   * 初始化物理世界
   * @param canvas HTMLCanvasElement 渲染目标
   */
  const initWorld = (canvas: HTMLCanvasElement) => {
    // ...
  };
};
```
