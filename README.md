# Phi Prism · Phigros 查分器

一个可以直接部署到 GitHub Pages 的纯静态 Phigros 成绩网站。无需 Node.js 构建、后端、数据库、Cloudflare Worker 或付费 API。

## 最快开始

解压后双击根目录 `index.html`，点击“先体验演示成绩”。页面、曲库、327 首曲绘、字体与解析库均已内置。`file://` 下的浏览器存储、剪贴板和网络能力因浏览器而异；推荐在 GitHub Pages 的 HTTPS 页面使用完整功能。

## GitHub Pages 部署

1. 在 GitHub 创建一个公开仓库。
2. 上传本包解压后的**内容**，让 `index.html`、`.nojekyll` 和 `assets/` 直接位于仓库根目录；不要只上传 ZIP。
3. 进入仓库 `Settings → Pages`。
4. `Source` 选择 `Deploy from a branch`，分支选 `main`，目录选 `/ (root)`，保存。
5. 等待 GitHub 部署完成，使用 Pages 页面显示的网址访问。

资源均使用相对路径，支持仓库子路径，例如 `https://你的用户名.github.io/仓库名/`。无需 npm install、npm build 或 GitHub Actions 构建。GitHub 免费账号可使用公开仓库的 Pages。

## 功能

- 国内 TapTap 云存档：输入 25 位 sessionToken，读取玩家信息及最新云存档，浏览器本地解密。
- 本地导入：Phigros 原始云存档 ZIP、本工具导出的 JSON、包含 gameRecord 的兼容 JSON。
- 成绩榜：B20（旧制 φ1+B19）、B30（φ3+B27）、B50、自定义 4—100 项，附 6 项 Overflow。
- 单曲查询：曲名、曲师、谱师、ID 搜索，难度、章节、评级筛选，排序与分页。
- 统计：已玩谱面、通关、FC、φ、评级与 ACC 分布、平均 ACC、最高定数、累计最佳分数、章节完成度、课题记录、RKS 构成、等效 RKS 计算器。
- 推分计划：选择总 RKS 目标增量，计算单谱面目标 ACC，计入 Best 槽位与 φ 槽位变化。
- 历史：按账号保存最近 12 份不同成绩快照，总计最多 36 份；趋势与成绩变化对比；JSON 备份和恢复。
- 图片：Best N、单曲、统计、推分计划；横竖版；PNG/JPG；分辨率、主题色、背景曲绘、背景亮度、自定义背景与头像、昵称、签名、隐私与水印选项；预览后下载，兼容浏览器支持复制图片。
- 电脑与手机布局；文件拖入导入；`/` 快捷键打开曲目搜索。

## 在线查分与 sessionToken

通过你已使用的可信查分工具的“导出 sessionToken”功能，或你自己设备上的账户数据获取 token。本站不提供扫码登录，不需要 TapTap 密码，不要求把凭证交给站长。

浏览器仅向 `https://rak3ffdi.cloud.tds1.tapapis.cn/1.1` 发送 sessionToken。读取玩家信息后，使用该玩家的 ID 查询 `/gamesaves` 并选择最新存档。下载存档时**不携带** token，也不通过公共代理。

默认只在当前会话使用 token；选中“记住 token”后才保存到此站点的 localStorage。清除按钮可移除已保存凭证。成绩 JSON、历史备份与图片均不包含 token。不要把 token 写入源码、公开仓库或截图。

**跨域备用流程：**如果云存档下载域名不允许浏览器跨域读取，页面会显示“下载原始存档 ZIP”链接。手动下载后导入本站，即可继续使用全部本地统计和出图功能，不需要架设后端。网络、接口变更和浏览器策略可能影响在线读取；静态网站无法自行修改远端的跨域策略。

连接修订版 **2026-10-24-r2**：读取失败时先点击“连接诊断（不使用 token）”，可下载不含真实凭证的报告。该诊断只向官方接口发送固定无效占位符，先通过预期的拒绝响应检查资料接口，再以固定不存在用户的筛选条件检查存档列表接口；它不验证真实 token，也不验证存档文件下载。错误会区分读取资料、查询存档、下载阶段，并标明离线、超时、HTTP、格式或网络错误。浏览器不支持 `AbortSignal.timeout()` 时也能请求，超时由兼容方式管理。网络错误的具体 DNS/TLS/CORS 原因受浏览器限制，可能还需查看 F12 → Console；请勿截图或分享请求头。

当前已验证云存档接口的跨域预检、解析算法与模拟完整请求；交付时没有使用真实玩家的 sessionToken 做端到端账号同步。`tests/VERIFICATION.md` 记录具体验证范围。

## RKS 与统计口径

单谱面定数为 `d`，ACC 使用 0—100 的百分数：

```text
ACC < 70：RKS = 0
其他情况：RKS = d × ((ACC - 55) / 45)²
现行总 RKS = (最高 3 个 φ 位 + 最高 27 个 Best 位) / 30
```

φ 位要求 1000000 分且 100% ACC。同一 φ 谱面可以同时计入 φ 位和 Best 位；缺位按 0 计算。B20 使用旧制公式，其他自定义榜单仅用于扩展展示。页面总 RKS 和推分建议始终按现行 B30 计算。

推分建议表示**独立更新一首谱面**后的真实总体增量；目标 ACC 向上取整到 0.01%，计算过程会处理新满分进入 φ 位的变化。多张建议的提升不能直接相加。无法靠单曲达到目标时不编造目标。满分成绩不再推荐提升。

全连标识统一显示为蓝色 V（Full Combo），普通 V 评级显示为白色；全连计数包含 φ，评级分布中 φ、蓝色 V、白色 V、S、A、B、C、F 互斥。内部 FC 标记与 JSON 数据格式保持兼容。通关按分数至少 700000 统计。存档不包含的游玩时长、次数和单次判定不作推测。曲库更新可能令重算 RKS 与云存档摘要不同。未知谱面会保留，缺少定数时不参与 RKS。

长图会按浏览器画布尺寸和内存预算自动降低倍率；自定义超过 60 项的长榜单尤其如此。图片背景与曲绘已内嵌为 data URL，避免外链画布污染；直接打开 index.html 也可以生成和下载图片。复制图片需要浏览器和 HTTPS 支持。

## JSON 格式

见 `examples/demo-scores.json`。至少需要：

```json
{
  "schema": "phi-prism/1",
  "profile": {"name": "玩家昵称"},
  "records": [
    {"id": "Glaciaxion.SunsetRay", "level": "IN", "score": 980000, "acc": 98.5, "fc": false}
  ]
}
```

曲目 ID 可带 `.0` 后缀；难度支持 EZ、HD、IN、AT 或 0—3。本工具优先使用内置曲库的定数；未收录曲目可在条目中提供 `constant`。兼容 `gameRecord: { "曲目ID.0": [[分数,ACC,FC], null, ...] }` 与各难度对象数组。

本地 ZIP 支持 `gameRecord` 版本 1、`user` 版本 1，以及当前兼容的 gameProgress 基础字段。新版本结构不兼容时会明确报错，不会悄悄当成空成绩。单文件导入上限 12 MB，解压目标数据上限 8 MB。

## 文件结构

| 路径 | 用途 |
| --- | --- |
| `index.html` | 网站入口 |
| `assets/style.css` | 响应式 Phigros 风格界面 |
| `assets/app.js` | 交互、筛选、历史、导入导出 |
| `assets/core.js` | RKS、推分、二进制解析、云存档读取 |
| `assets/export.js` | Canvas 成绩图排版 |
| `assets/data.js` | 曲目信息与定数快照 |
| `assets/art.js`、`assets/art-data/` | 曲绘初始化与分块数据；整个目录必须上传 |
| `assets/vendor/` | 本地解压与加密依赖 |
| `examples/` | 演示 JSON、人工构造的解析测试 ZIP、示例图片 |
| `tools/update_data.py` | 可选的曲库更新工具 |
| `tests/` | 正确性验证与说明 |

## 更新曲库

网站运行不需要 Python。更新素材时，可在有 Python 的电脑执行：

```bash
python -m pip install pillow
python tools/update_data.py
```

脚本从上游下载元数据与曲绘、生成新的 `assets/data.js`、`assets/art.js` 和 `assets/art-data/` 分块脚本，再更新 `index.html`、这两个文件及完整的 `assets/art-data/` 目录即可。只更新元数据可使用 `--skip-art`。如果只需要临时使用新定数，网站说明弹窗支持导入曲库 JSON（只对当前会话生效）。

## 许可与来源

本项目代码使用 GPL-3.0-or-later，详见 LICENSE。协议与结构参考 Catrong/phi-plugin；曲库及曲绘来自该项目及 phi-plugin-ill。fflate、CryptoJS 与 Barlow 字体保留各自许可。曲绘及游戏相关素材版权仍归原作者和权利人所有，不能据代码许可推定素材可自由商用。完整说明见 THIRD_PARTY_NOTICES.md。

这是非官方工具，与 Pigeon Games、Phigros、TapTap 无隶属关系。

额外网络回归验证：`node tests/network.test.cjs`。

### 2026-10-24-r2：存档列表跨域重定向修复

原地址 `/1.1/gamesaves/?…` 的 GET 返回 301，转向 `/1.1/gamesaves?…`，但中间重定向响应缺少 `Access-Control-Allow-Origin`。先前 OPTIONS 预检可通过，因而未发现这个问题。现已直接请求不带末尾斜杠的规范地址，并扩展连接诊断检查两个接口。更新部署后请按 Ctrl+F5，连接面板应显示 `2026-10-24-r2`。

### 曲绘修复：2026-10-24

已恢复全部 327 张曲绘，并拆为 25 个静态脚本，每个不超过 512 KiB。请完整上传 `index.html`、`assets/art.js`、`assets/art-data/`、`assets/app.js`；建议直接覆盖完整包。曲绘仍以 data URL 保存，兼容 GitHub Pages 子目录、本地双击和 Canvas 图片导出，不依赖外部图床。若分块漏传，页面底部会提示曲绘加载数量。

曲绘完整性检查：`node tests/art.test.cjs`，检查 HTML 引用的所有 JavaScript 语法、327 张图片的二进制长度、分块大小与加载顺序。

## 谱面查询

从首页导航进入“谱面查询”，或打开 charts.html。无需登录。支持官方 JSON v1/v3、自动播放、暂停、拖动进度、0.25—2 倍速、保持音调、独立音符流速、A/B 循环、全屏、音量与背景设置。支持导入自己的 JSON 和音频。

谱面和音频本地优先，缺失时从 7aGiven/Phigros_Resource 的 chart/music 分支加载。首次打开在线资源可能较慢。外部资源不可用时可用离线下载或文件导入。下载文件无需加入 Git；如需线上站使用本地资源，须主动将 offline 目录发布，否则 Pages 使用在线来源。

下载器：Python 3.8+，无第三方依赖。

```bash
python tools/download_resources.py --song Glaciaxion --difficulty IN
python tools/download_resources.py --chapter "Chapter 5" --difficulty IN AT
python tools/download_resources.py --types charts audio illustrations
```

已存在且有效的文件跳过；--refresh 强制重新下载。download-report.json 包含 SHA256 和失败项。反复运行可补齐失败文件。离线谱面同时生成 JSON 和 JS，JS 供双击入口加载。

章节使用当前曲库的 chapter 字段分组，章内沿用当前曲库曲序；章节移动/游戏版本差异需更新 charts-index.json/js 后校对，不宣称覆盖所有版本的特殊章节排序。当前播放器是官谱读谱演示，不含游戏专属剧情、特殊着色器和额外视频。

## 2026-10-30 修复

- 速度事件的 floorPosition 在新版官谱中已移除；现按秒累计积分重建每段位移，避免后半段音符跑到视野外。
- 更名“谱面查询”；曲目列表显示内置曲绘。
- 支持官谱根字段 blockAreaList 的时间、矩形、移动、缩放、旋转、锚点、缓动和反向区域，提供“显示噪域”开关。噪域几何依据原始数据，Canvas 红色噪点为近似效果；未重现原游戏完整着色器、触摸失效与音频滤波。播放器为自动读谱展示，没有触摸判定。
- 几何/缓动语义交叉核对： https://github.com/TeamFlos/phira/pull/901 。

### 机打效果
谱面查询中的“机打效果”默认勾选。开启后，音符到达判定线自动显示金色击打闪光、粒子、AUTO PERFECT 与 COMBO；长条持续发光，尾端结束显示效果。关闭后恢复普通谱面预览，并关闭自动击打音。开关不修改云存档、成绩与 RKS。拖动进度、循环跳转和切歌会重置效果时间边界，避免补播跳过的音符效果。
