# InputChecks 功能差距与上新计划

更新日期：2026-09-30  
参考站：[ScrollTest.net](https://www.scrolltest.net/)  
当前原则：**所有已存在页面的 SEO 内容保持原样；仅全新页面撰写新的 SEO。**  
本批已获授权：`/spacebar-clicker`、`/controller-test`、`/microphone-test` 三个新工具页。

发布记录：2026-09-28 已通过 Wrangler 发布到现有 Cloudflare Pages 项目 `inputchecks`。2026-09-29 第二批显示器工具部署地址为 `https://00b45d61.inputchecks.pages.dev`；2026-09-30 第三批部署地址为 `https://10eb36d2.inputchecks.pages.dev`。两批均按用户要求未执行上线后页面验证。

## 一、执行边界

1. 已有 URL 的 title、meta description、H1/H2、正文、FAQ、结构化数据、canonical 和现有内链不因本计划改写。已有工具可以增加检测能力、交互控件及必要的结果提示，但不借功能更新重写原页面的 SEO 内容。
2. 全新工具页才按照仓库现行的 `inputchecks-tool-pages` 规范撰写 SEO：一个关键词意图组对应一个页面；唯一 H1、明确 H2、独特且不超过 60 字符的完整标题、140–160 字符的描述、首屏可用控件、充分的原创说明、相关测试与可靠来源。
3. 任何全新工具页、关键词落地页或故障指南，在创建 URL 之前都先提交关键词意图、URL、页面角色、核心交互和内链方案，取得明确批准。下面是候选清单，不表示已获批准。

## 二、参考站与本站功能差距

| 范围 | 参考站具备的能力 | InputChecks 当前情况 | 建议 |
| --- | --- | --- | --- |
| 滚轮计时 | 15/30/45/60/90/120 秒 | 本轮已增加 15/30/60 秒；滚动即开始，可提前结束 | 先实测这三档，再判断 45/90/120 秒是否有实际价值 |
| 滚轮控制 | 开始、暂停、继续、重置；测试区双击切换 | 已有滚动即开始、完成、重置；没有暂停/继续 | 可补暂停/继续，但要排除暂停造成的事件间隔误判；双击不是必需入口 |
| 实时面板 | 速度、DeltaX/DeltaY、DeltaMode、累计位移和峰值 | 已有反向次数/比例、匹配次数、最近一秒事件率、间隔、最近 Delta 与横向事件数；缺累计 X/Y 和正负峰值 | 在现有工具卡中补充，标注 DeltaMode 单位，避免把原始 Delta 当作硬件精度 |
| 结果分析 | 健康摘要、采样质量、滚动段异常、多个图表和事件表 | 本轮已增加基本结果报告与最近十条事件；尚无滚动段分析、多图对照 | 先定义可解释、可测试的异常规则，再增加高级图表；避免凭少量样本给出硬件健康分 |
| 反向提示 | 声音与弹窗警告 | 现有结果状态提示，无声音弹窗 | 保持非打断式提示；声音可作为用户主动开启的可选项 |
| CPS | 多种时长 | 现有 `/cps-test` 为固定 5 秒 | 在原工具内部增加时长选择，**不改该页现有 SEO 内容** |
| Space 键 | 独立的速度测试 | 现有 `/spacebar-test` 主要检测每次按键是否注册 | 若要做速度测试，建议独立新页，避免与可靠性测试混淆 |
| 手柄 | 按钮、摇杆等测试 | 尚无手柄工具 | 新页面候选；需要真实设备与浏览器兼容测试 |
| 音视频 | 麦克风、摄像头测试 | 尚无 | 需求确认后分开建页；优先处理权限与隐私说明 |
| 显示器 | 坏点、灰阶、渐变、拖影等测试 | 尚无 | 与输入设备受众距离较远，放在后期；每个独立测试对应清晰意图 |

参考站的搜索、深色模式、分类导航也可单独评估，但它们不是检测能力缺口，当前不作为工具上新的前置条件。InputChecks 不照搬参考站的文案、图形、算法名或未经验证的结论。

## 三、实施顺序

### P0：完善已有工具的功能；已有 SEO 全部保留

1. **验证本轮滚轮增强。** 用有刻度鼠标、无级滚轮和触控板，在 Chrome、Safari、Firefox 中各做上下行采样。检查 15/30/60 秒计时、低样本报告、横向事件和反向事件。测试结果只描述浏览器事件。
2. **滚轮高级指标。** 增加累计 DeltaX/DeltaY、最大正向与负向 DeltaY；在单位变化时显示不可直接比较的提示。随后评估暂停/继续和滚动段异常分析。所有新增解释留在工具交互区域，不改首页 SEO 正文。
3. **CPS 多时长。** 在 `/cps-test` 的工具组件中加入 1/5/10/30/60 秒回合，显示总点击、平均 CPS、峰值和重测。保持 `/cps-test` 现有 title、meta、H1/H2、正文、FAQ、schema 和内链不变。

### P1：本批授权的三个新工具页

| 关键词意图 | 建议 URL 与页面角色 | 首屏主流程 | 新页内计划链接 |
| --- | --- | --- | --- |
| `spacebar clicker`、`spacebar CPS`：测速度，区别于现有 Space 键可靠性测试 | `/spacebar-clicker`；独立工具页 | 选择 5/10/30 秒，聚焦测试区，按 Space；显示次数、平均/峰值 CPS、重测 | `/spacebar-test`、`/keyboard-test`、`/keyboard-ghosting-test`、`/cps-test` |
| `controller test`、`gamepad test`：查看手柄输入 | `/controller-test`；独立工具页 | 连接手柄，按任意键激活；实时显示按钮、摇杆轴、扳机和未连接状态 | `/keyboard-test`、`/mouse-test`、`/reaction-time-test` |
| `microphone test`：检测浏览器音频输入 | `/microphone-test`；独立工具页 | 用户主动授权；实时电平、设备选择、最长 15 秒本地录音回放 | `/controller-test`、`/keyboard-test`、`/mouse-test` |

本批顺序为 `/spacebar-clicker`、`/controller-test`、`/microphone-test`。它们分别覆盖相邻键盘需求、游戏手柄输入和音频输入。新页可以链接到已有页面；按本次边界，不为建立回链而修改已有页面的 SEO 内链。

### P2：新类别；根据需求再批准

| 关键词意图 | 建议 URL 与页面角色 | 首屏主流程 | 新页内计划链接 / 前置条件 |
| --- | --- | --- | --- |
| `webcam test` | `/webcam-test`；独立工具页 | 用户点击预览并授权，查看本地画面、分辨率和设备切换 | 未来链接 `/microphone-test`；验证移动端权限行为 |
| `dead pixel test` | `/dead-pixel-test`；独立工具页 | 一键进入全屏纯色轮换，支持键盘切换和清晰退出 | 未来链接显示器专项工具；先验证色彩、全屏和可访问性 |

以上候选页面不预设发布日期。摄像头页面仍需单独批准；不先创建空白或“即将推出”的搜索页面。

### 2026-09-29：第二批——显示器测试工具组（已批准并部署）

对照 ScrollTest 的显示器测试分类，本站当时没有可直接对应的屏幕检查工具。本批四页覆盖静态像素/灰阶问题与运动表现；搜索意图相互区分，并形成相关测试内链组。用户于 2026-09-29 批准此 URL 组，页面已完成并部署。

| 关键词意图 | URL / 页面角色 | Title 草案（含品牌，≤60 字符） | Meta description 草案（140–160 字符） | 首屏主流程与内链 |
| --- | --- | --- | --- | --- |
| `dead pixel test`：找出屏幕上持续异常的像素 | `/dead-pixel-test`；独立坏点检查工具 | `Dead Pixel Test: Find Stuck Pixels Online | InputChecks`（55） | `Check your screen for dead or stuck pixels with fullscreen color patterns. Switch colors manually or cycle them automatically to inspect the panel safely.`（154） | 点击开始后显示全屏纯色；支持手动切换、自动轮换、键盘操作和退出。明确由用户目视检查、不自动诊断。链接灰阶色带、灰阶均匀度、运动模糊测试。 |
| `gray banding test`：查看渐变中是否出现阶梯或色带 | `/gray-banding-test`；独立灰阶渐变工具 | `Gray Banding Test: Inspect Monitor Gradients | InputChecks`（58） | `Inspect monitor banding with fullscreen grayscale gradients, near-black shades, and mid-gray patterns. Compare what you see at a normal viewing distance.`（153） | 提供全灰阶渐变、暗部渐变等图样，全屏检查并可切换图样。说明浏览器渲染、显示器设置和环境光都会影响观感。链接坏点、均匀度、运动模糊测试。 |
| `gray uniformity test`：检查屏幕不同区域的亮度或色调差异 | `/gray-uniformity-test`；独立灰阶均匀度工具 | `Gray Uniformity Test: Check Screen Uniformity | InputChecks`（59） | `Check screen uniformity with fullscreen gray levels that can reveal uneven brightness or tint. Use consistent room lighting and compare the whole panel.`（152） | 显示全屏 5% 与 50% 灰等均匀场，提供图样切换与退出。说明这只能辅助目视检查，结果受屏幕亮度、环境光和面板特性影响。链接坏点、灰阶色带、运动模糊测试。 |
| `motion blur test`：观察运动时的模糊或重影 | `/motion-blur-test`；独立动态显示工具 | `Motion Blur Test: Check Monitor Ghosting | InputChecks`（54） | `Watch an adjustable high-contrast pattern move across your screen to compare blur and ghosting. Use fullscreen and change one monitor setting at a time.`（152） | 运行可调速度的高对比移动图样，提供暂停、全屏和速度控制，方便对照显示器设置。说明网页图样不是仪器测量，不给出响应时间或硬件分数。链接坏点、灰阶色带、均匀度测试。 |

页面按表中顺序实现。每页采用独立 H1 与对应关键词；页面补充使用步骤、指标解释、限制、FAQ 和规范/来源链接。该批没有修改已有 URL 的 SEO 文案或内链，也没有改首页或全站导航。按用户要求，部署后未进行页面验证。

### 2026-09-30：第三批——色彩、高光与锐度测试（已批准并部署）

已有新页面覆盖坏点、灰阶色带、灰阶均匀度和运动模糊。对照 ScrollTest 的显示器分类，本批三页分别检查彩色通道、近白高光层次和细节/缩放。用户于 2026-09-30 批准此 URL 组，页面已完成并部署；相互添加了相关测试内链，并链接到直接相关的现有显示器测试页。

| 关键词意图 | URL / 页面角色 | Title 草案（含品牌，≤60 字符） | Meta description 草案（140–160 字符） | 首屏主流程与计划内链 |
| --- | --- | --- | --- | --- |
| `color bars test`、`monitor color test`：目视比较红绿蓝与青品红黄通道 | `/color-bars-test`；显示器彩条通道检查工具 | `Color Bars Test – Check Display Channels | InputChecks`（54） | `Check primary and secondary color fields in your browser to spot obvious channel, tint, or clipping issues. This visual check does not measure color accuracy.`（158） | 全屏显示八色主/次通道，逐块检查稳定性与明显偏色；说明这不是色彩校准或色域测量。链接近白测试、锐度测试、坏点测试、灰阶色带测试。 |
| `white saturation test`、`monitor white clipping test`：检查接近白色的细节是否合并 | `/white-saturation-test`；近白高光层次工具 | `White Saturation Test – Check Highlight Detail | InputChecks`（60） | `Inspect near-white steps to see whether highlight tones remain distinct. Compare settings carefully; this browser pattern is not a luminance measurement.`（153） | 在白色背景上显示逐渐接近白色的细阶，支持全屏和稳定对照；强调不应为了看清每格而把白色压灰。链接彩条、锐度、均匀度、灰阶色带测试。 |
| `monitor sharpness test`、`screen sharpness test`：观察细线、棋盘格、缩放模糊或锐化光晕 | `/monitor-sharpness-test`；显示器细节与像素映射检查工具 | `Monitor Sharpness Test – Check Screen Detail | InputChecks`（58） | `View fine checkerboards and alternating lines to spot scaling softness, ringing, or excess sharpening. Compare at native resolution and 100% browser zoom.`（154） | 提供细棋盘格、单像素线条和高对比边缘，提示先设原生分辨率与 100% 浏览器缩放；说明设备像素比可能影响浏览器图样。链接彩条、近白测试、坏点测试、灰阶色带测试。 |

页面按彩条、近白、锐度的顺序实现。正文解释方法、结果边界、可复现的比较步骤和常见误判，并引用适当的标准/厂商资料。只新增这三个英文页面，没有改已有 URL 的 title、meta、H1/H2、正文、FAQ、schema 或内链，也没有增加首页或全站导航入口。按用户要求，部署后未访问线上页面验证。

## 四、全新页面的 SEO 与验收规则

- 新页按现有站点的英文写作风格和工具卡布局实现：首屏直接可测，静态 HTML 内有可见控件；正文解释使用方法、指标含义、局限、示例与下一步。
- 每页只有一个主要关键词意图，避免与现有 `/spacebar-test`、`/keyboard-test`、`/cps-test` 等页面争抢相同搜索意图。建议在发布前核对完整 title 长度、meta description 长度、H1/H2、canonical、sitemap、OG 和结构化数据。
- 新工具页提供 3–6 个相关测试链接；有直接相关的指南时才链接，事实依据优先引用规范或官方文档。不得暗示浏览器工具能确诊硬件。
- 验收包括键盘与移动端可用性、低样本/无设备/权限拒绝状态、浏览器端性能和真实设备测试。上线后观察数据再调整新页 SEO，不以模板化扩页代替产品验证。
- 对已有 URL 的 SEO 内容不做“顺手优化”。未来如需调整，由用户另行明确指定页面与范围。

## 五、需要确认的上新决策

1. 本批三个新工具完成后，由用户在生产网站验收。已有页面的 SEO 内容保持原样。
2. 滚轮高级指标、CPS 多时长属于后续已有工具功能增强；如安排实施，只修改测试交互，不修改原页面 SEO。
3. 摄像头和显示器等新的 URL 属于下一批决策，仍需逐项给出页面方案并取得明确批准。

## 参考

- [ScrollTest.net](https://www.scrolltest.net/)：滚轮功能、相关工具与类别观察，2026-09-28。
- [ScrollTest Dead Pixel Test](https://www.scrolltest.net/dead-pixel-test)、[Gray Banding Test](https://www.scrolltest.net/gray-banding-test)、[Gray Uniformity Test](https://www.scrolltest.net/gray-uniformity-test)、[Motion Blur Test](https://www.scrolltest.net/motion-blur-test)：第二批显示器工具能力对照，2026-09-29。
- [ScrollTest Color Bars Test](https://www.scrolltest.net/color-bars-test)、[White Saturation Test](https://www.scrolltest.net/white-saturation-test)、[Monitor Sharpness Test](https://www.scrolltest.net/monitor-sharpness-test)：第三批候选页面调研，2026-09-30。
- [ITU-R Recommendation BT.2111](https://www.itu.int/rec/R-REC-BT.2111/en)：正式 HDR 电视彩条测试图规范；第三批彩条页说明其网页样式不声称符合此规范。
- [EIZO Monitor Test](https://www.eizo.com/library/basics/eizo-monitor-test/)：显示器目视检查项目与锐度测试参考。
- [W3C UI Events](https://www.w3.org/TR/uievents/)：WheelEvent 的 Delta 与单位边界。
- 仓库 `.agents/skills/inputchecks-tool-pages/SKILL.md`：新页确认和 SEO 规范。
