# 模块、场景配方与并行内容创作

这是轻量的可信仓库扩展契约，不是 ECS、任意插件平台或 JSON 脚本引擎。胜负阈值仍在同一物理循环中，模块不能直接宣布过关。完整字段规则见 [LEVEL_FORMAT.md](LEVEL_FORMAT.md) 第 5C 节。

## 边界与所有权

| 路径 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `js/physics.js` | 120Hz 步进、画线几何、载荷刚体、固定胜负规则、调用生命周期 | 不知道新关 id，不为新元素加分支 |
| `js/content.js` | 注册类型、展开配方、参数平移、构建每次试坐的实例状态、分发 hooks | 不执行 JSON 中的代码或 URL |
| `js/modules/core/` | 旧元素、v2 规则兼容适配器 | 不按关号选择机制 |
| `js/modules/<owner>/` | 独立元素/规则/配方的实现、参数校验及 Schema、自己的绘制 | 不写其他模块的私有状态，不持有全局试坐状态 |
| `js/render.js` / `js/render-art.js` | 背景/椅子/前景合成；共用画笔与人物插画 | 具体元素外观由模块负责 |
| `js/level-format.js` / `js/validation.js` | 格式版本、基础载荷/资源/边界；闭合 JSON 校验原语 | 不维护新类型参数表 |
| `js/catalog.js` / `js/levels.js` | 文件错误隔离、稳定 id、编排、浏览器刷新 / Node 加载 | 不判定可解或趣味性 |
| `levels/<owner>/` | 每关独立 JSON、分组/难度/顺序 | 不维护全局手写清单，不含答案 |
| `tests/cases/<owner>/` | 对应关卡的合法成功和有意义的失败路径 | 生产游戏不加载答案 |
| `scripts/content-index.cjs` | 同一递归发现器供开发服务及静态构建使用；拼接 v3 Schema | 不在生产 Nginx 上运行 |

### 类型、规则、prefab、关卡是四件不同的东西

- **元素**有几何和表现，例如 `core/terrain`、`lab/elevator`。一份类型实现可以被场景实例化多次，每份有自己的 id、参数与试坐状态。
- **规则**描述因果，例如 `core/gravity` 改世界重力、`core/temporary-terrain` 撤走命名地形。不是题号的别名。
- **prefab（场景配方）**只把参数展开成已有元素/规则实例，没有运行时状态，也不定义胜负。`workshop/seat` 参数化旧腿数量；`workshop/hanging-kit` 把装卸踏板、双挂点、踏板离场时刻组合在一起。
- **完整关卡**选择配方/元素/规则，提供载荷、墨水、叙事、提示和编排。例如“地板先下班” = seat + hanging-kit；“这一笔不修椅子” = seat + floor + 双环 + 球 + 猫。

## 现有类型及参数

以下 type 都是实际实现，不是待实现关键词。各数值边界以生成的 [v3 Schema](../schemas/level-v3.schema.json) 和模块 `validate` 为准。

| type | kind | params |
| --- | --- | --- |
| `core/chair` | element | 木椅矩形数组 `{x,y,w,h,kind}` |
| `core/terrain` | element | 一个矩形 `{x,y,w,h,step?,friction?}`；可选 `friction`（0–1.5）为真实刚体摩擦，以构造后写入的有效值为准——Matter 静态体默认摩擦为 1，故缺省保持现状 1，显式赋值才改变 |
| `core/cats` | element | 禁区矩形数组 `{x,y,w,h,label?}` |
| `core/anchors` | rule | v2 anchors 数组 `{x,y,radius,label}`，可选 `releaseAt`（750–4000ms，到点真实移除该环的约束；缺省永不释放） |
| `core/gravity` | rule | v2 gravity 数组 `{at,x,y,label}`，首项at=0，严格递增 |
| `core/drops` | rule | v2 drops 数组 `{at,x,y,radius,mass,label}`，可选 `restitution`（0–1，缺省 0.08；直接作用于真实圆球刚体） |
| `core/forces` | rule | 定时外力数组 `{start,end,fx,fy?,at:{x,y},label}` |
| `core/temporary-terrain` | rule | `{target,removeAt,label}` 数组；target 为命名的 core/terrain 实例，不是下标 |
| `lab/elevator` | element | `{x,y,w,h,dx,dy,start,end,label}`，实际移动的光滑承重平台 |
| `lab/trigger-lift` | element | `{button:{x,y,w,h},x,y,w,h,dx,dy,speed,label}`：感应区（button，非实心不挡笔画）被真实落球触碰后，实心平台以闭合匀速（speed 0.02–0.08/ms）滑到 `(dx,dy)` 终点；非定时，不触发则不动 |
| `workshop/seat` | prefab | `{legs:"none"|"left"|"both"}`，局部座面起点(0,0)，宽184；load 不随它改变 |
| `workshop/hanging-kit` | prefab | `{span,floorY,removeAt}`，局部原点是左挂点；右挂点偏移span，踏板位于floorY |

`scene[].at` 是正向世界平移。配方中的实例 id 自动加父前缀，例如 `dock-kit/dock`；配方内 target `dock` 自动指向该配方自己的踏板，外部规则可写 `dock-kit/dock`。先展开全部几何，再解析规则，因此引用与声明先后无关。最多两层 prefab 嵌套、总展开最多160项；没有旋转、缩放、任意字段覆盖、外部模板 URL 或表达式。非位置规则（重力/撤走引用）的平移没有作用。

导入与导出保存的是原始配方 JSON。渲染、输入和物理使用内部展开快照，展开结果不会污染文件或存档。

### 新元素示范：lab/elevator

平台初始位置来自 xywh；试坐的 `[start,end]` 内沿 `(dx,dy)` 匀速移动，之后停在终点。start 为0–3000ms，end为500–4000ms且大于start，速度最多0.08单位/ms；dx为±160、dy为±120，宽20–300、高10–60。初始和最终矩形均须在世界边界内。

- `init` 创建真实 Matter 静态运动学支撑，摩擦/静摩擦为0；不是给木椅播放移动动画。
- `beforeStep` 调用 `Body.setPosition`；接触法线把运动传到结构，木椅仍可倒、掉落。它是无限质量驱动平台，不是可被挤停的电机。
- `obstacles` 使初始实心位置自动参与画线禁入、约束和端点吸附；终点虚线只是预告，不能在开局承重。
- `render` 画当前实体、终点和行程箭头；`events` 提供开始/到站提示；`afterStep` 记录真实接触，失败时给对应建议。
- `tests/content.test.cjs` 验证实体位移65单位、椅子随之上升、横移朴素解失去接触后失败、去掉移动反而成功以及每次试坐状态重建。`tests/content-browser.cjs` 用原生鼠标验证横梁滑动接力。

所有实现都在 `js/modules/lab/elevator.js`；通用循环和合成器没有 `lab/elevator`、关号或答案路径分支。组合能力的另一例是独立斜挡板：木椅本来已稳时，未焊到椅子的墨水可以由金环挂住，把球从猫区导走，不需要添加“必须接椅”或“预设答案”特例。

## 新增一个可信模块

独立文件模板可参考 `js/modules/lab/elevator.js`。使用 UMD 小包装：Node 中 `require('../../content.js')`，浏览器中取 `globalThis.RescueContent`，调用 `register(definition)`。模块文件必须是 `js/modules/<namespace>/<slug>.js`；模块在包内自注册，不编辑中心 imports 或手写 manifest。

必需字段：

- `type`: 唯一 `namespace/slug`；注册重名直接报错，不覆盖。
- `kind`: `element`、`rule` 或 `prefab`。
- `schema`: 惰性的 JSON Schema 参数定义，尽量闭合 `additionalProperties:false`；可引用已有公共 `$defs`，独立类型也可提供完整内联定义。
- `validate(params,path,V,compiledLevel)`: 用 `V.object/number/text/array/rect/point/fail` 做类型、数值和跨字段校验；错误包含路径。规则在几何展开后校验，禁止依赖其他规则的加载先后。

可选接口：

| 接口 | 调用时机 / 合同 |
| --- | --- |
| `translate(params,at)` | 纯函数返回平移后的参数；元素平移前后均校验，规则在平移后校验 |
| `expand(params)` | 仅 prefab，返回子 scene 实例数组；不创建世界或改原始 JSON |
| `compile(params,level,{id,terrainIds,prefix})` | 核心兼容适配器把场景转到原有几何/规则数组；普通新元素无需实现 |
| `init({trial,api,Matter},params,state)` | 构建每次试坐的实例对象；state是新空对象，不用模块全局变量保存本次状态 |
| `beforeStep(context,params,state)` | 每个固定步 Engine.update 前；使用 trial.elapsed 毫秒，不用墙钟或 setInterval |
| `afterStep(context,params,state)` | 每步物理更新后、固定胜负判断前；读真实接触或更新实例诊断 |
| `obstacles(params)` | 返回开局实心矩形；由通用输入几何检查使用 |
| `stroke({level,sampled,points,api},params)` | 额外笔画限制；返回 `{code,message}` 或无值，不能放宽公共规则 |
| `events(params)` | 返回 `{at,type,label,...}` 预告；与 beforeStep 的实际变化保持一致 |
| `status({elapsed,anchorCount},params)` | 可选的简短状态文字 |
| `layer` / `render(view,params,state)` | background/chair/foreground；view有ctx、绘画原语、level/trial、时间。预览时state可能不存在；遵守Canvas save/restore |
| `failurePriority` / `failure(context,params,state)` | 仅给已经发生的通用失败补充原因，返回 `{code,reason}` 或无值；不能使失败变成功 |
| `inspect(state)` | 可选只读诊断，供 rescueDebug 查看 |

context 提供同一 Matter 库、trial 与有限几何 api；创建的刚体加入 `trial.engine.world`。新动态物体还必须加入 `trial.dynamicBodies`，以参与通用猫区碰撞检查。通用重试清空世界并丢弃所有实例状态；本契约不提供网络、DOM订阅、外部计时器或持久服务生命周期。`select`/`legacyKey` 是 core 兼容层接口，新扩展走 v3 scene，不借它们修改旧版语义。

## 内容发现、刷新、纯静态发布

```sh
npm start                              # 默认 http://127.0.0.1:4173/
# 新增 levels/my-team/new-idea.json，点击「刷新目录」
# 新增 js/modules/my-team/new-type.js，同样刷新；修改已有 JS 则整页重载
npm run level:validate -- levels/lab/up-we-go.json --cases tests/cases/lab/up-we-go.cases.json --json
npm run test:content                    # 组合契约与六关样例
npm run test:content:browser            # 需先启动 npm start；可用 GAME_URL 指定地址
npm run content:build                   # 自动生成关卡索引、模块allowlist、v3 Schema
npm run content:check                   # 比较生成物与当前开发发现，过期则非零退出
```

开发服务每次请求 `/levels/manifest.json` 与 `/js/modules/manifest.json` 都重新扫描目录，不依赖进程启动时的列表。只接受小写字母/数字/连字符路径，忽略隐藏文件、符号链接和 cases/metadata 的多点后缀。浏览器逐文件校验，坏文件可定位，重复id的全部冲突文件隔离；整体索引失败保留旧目录。

刷新不清笔画、不切关、不重建试坐、不覆盖本地库/成绩；重新选关才采用最新文件。新关 id 不要求连续；旧数字链接/成绩键保持原样。新关自己填写 progression；同 chapter 的 groupOrder 要一致，order相同时按id确定顺序。`legacy.progression.json` 只负责旧数字关编排，新作者不编辑它。

**Nginx / Python 简单静态服务没有磁盘扫描能力。** 必须先构建，然后把 `index.html`、styles、js（含modules与manifest）、levels（含manifest）、vendor、assets、schemas及文档作为同一版本发布。索引使用可重新验证的缓存策略。无需生产Node；刷新只读取该站点已经发布的文件，不从GitHub拉取未发布文件。本轮未提交、推送或部署。

## 多 agent 并行约定

1. 开工先分配 namespace 与目录所有权。例如 A 拥有 `js/modules/alice/`、`levels/alice/`、`tests/cases/alice/`、`tests/alice.test.cjs`；B 用自己的 namespace。不要共用关卡id或同名模块。
2. 新关复制一个接近的 v3 文件，改自己的稳定id、文案与 progression；使用已存在的类型或自己实现的可信模块。不为了排在下一关而修改其他人的编号。
3. 一位作者修改自己的模块、Schema参数定义、独立测试和关卡；新增模块无需动 game/physics/render。需要改公共胜负规则或核心接口时，单独交给接口所有者，不伪装成普通内容追加。
4. 成功与失败路径分开存放在自己的 cases 目录；失败也必须是合法画法。新因果优先于窄通道，难关之间安排休息关；每个组合重新跑同引擎验证，并测实际浏览器输入吸附后的路径。
5. 集成人员统一运行 content:build；生成物冲突直接重新生成，不手工合并列表。随后 content:check，按改动范围测内容与浏览器闭环。新JS代码是可信代码，必须按正常代码变更检查；JSON本身不授予执行权限。
6. 共享层变更、更多变换、额外物体形状、可视化编辑器、模型出题服务都不属于这个轻量契约；需要时另定范围，不预先搭平台。
