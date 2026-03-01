# Pico 硬件题库（MicroPython）（20题）

1) DeviceCheck：板载 LED 闪烁 | beginner | 运行即闪烁、串口输出OK | 风险：环境→fallback：用 Thonny 直连
2) 呼吸灯（PWM） | beginner | LED 明暗平滑变化 | 风险：PWM不懂→fallback：用延时闪烁
3) 按钮控制 LED 开关 | beginner | 按下切换状态 | 风险：抖动→fallback：简单延时
4) 双模式灯：常亮/闪烁 | beginner | 两种模式可切换 | 风险：状态乱→fallback：只两状态
5) 计时器：按下开始计时 | beginner | 秒数正确输出 | 风险：时间基准→fallback：只计数循环
6) 反应速度测试 | intermediate | 测反应时间 | 风险：随机→fallback：固定延时
7) 摩斯电码灯 | intermediate | 闪灯编码 | 风险：编码表→fallback：只做SOS
8) 简易密码锁（按钮序列） | intermediate | 正确序列开灯 | 风险：状态机→fallback：只3位序列
9) 温度读取（若有传感器） | intermediate | 输出稳定温度 | 风险：无传感器→fallback：用模拟值
10) 光照自动灯（光敏） | intermediate | 低光→亮灯 | 风险：阈值波动→fallback：加滞回
11) 蜂鸣器报警（可选） | intermediate | 条件触发响/停 | 风险：无蜂鸣器→fallback：用LED代替
12) “交通灯”状态机 | beginner | 红黄绿循环正确 | 风险：硬件多→fallback：用1LED模拟
13) 计数器：每按一下+1 | beginner | 计数正确输出 | 风险：抖动→fallback：延时
14) 节拍器 | beginner | 固定节奏闪灯 | 风险：无
15) 迷你游戏：抢答灯 | intermediate | 最快按到的人赢 | 风险：硬件不足→fallback：单按钮计时
16) “情绪灯”模式切换 | beginner | 三种灯效切换 | 风险：模式多→fallback：只2种
17) 简易数据记录（串口日志） | beginner | 输出格式稳定 | 风险：格式乱→fallback：固定模板
18) 去抖动挑战 | intermediate | 正确区分一次按下 | 风险：理解难→fallback：讲解+示例
19) 低电量提示（模拟） | intermediate | 模拟值低→提示 | 风险：无
20) “安全开关” | intermediate | 连按两次才启动 | 风险：状态机→fallback：计时窗口简化
