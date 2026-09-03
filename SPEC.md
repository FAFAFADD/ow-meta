# OW Meta 数据站 SPEC(MVP)

目标:基于暴雪官方 rates 接口的《守望先锋2》meta 数据站。零后端、零 LLM、免费托管。
面向海外用户(英文文案)。MVP 只做三件套:英雄榜页 / 单英雄详情页(含趋势线) / 补丁变动页。

## 1. 数据源(已验证)

- URL 模板:`https://overwatch.blizzard.com/en-us/rates/data/?input={input}&region={region}&gameMode={mode}&map=all-maps&role=All&rq=0`
- 已验证响应结构(24KB JSON,无需鉴权,无 CORS 头):
  `{"rates": {"rates": [{"id": "ana", "cells": {"name": "Ana", "winrate": 48.3, "pickrate": 38.2, "banrate": 0}, "hero": {"color": "48699eff", "name": "Ana", "portrait": "<url>", "subrole": "tactician", "role": "SUPPORT", "roleIcon": "<url>"}}]}, "columns": [...]}`
- 参数:`input=PC`,`region=us|eu|asia`,`gameMode=competitive|quickplay`(先做这两个 mode,其他可留参)
- 数据是"当前补丁"快照,无历史。**项目护城河 = 自己持续存档**,所以快照必须落盘,一天不落。

## 2. 架构(最懒且能工作:纯静态站 + GitHub Actions,零服务器)

```
ow-meta/
├── scripts/
│   ├── fetch.py      # 抓取所有 region×mode 组合,规范化为 JSON(失败重试3次,间隔1s)
│   ├── snapshot.py   # 调 fetch → 写 data/snapshots/snapshot-<UTC时间>.json;
│   │                 # 与上一快照 diff,若任一英雄 winrate/pickrate/banrate 变化或英雄集合变化
│   │                 # → 追加一条补丁事件到 data/patch-events.jsonl(时间+变化的英雄+变化值);
│   │                 # 同时更新 data/latest.json
│   └── build.py      # 从 data/ 生成 dist/ 静态站(纯手写 HTML/CSS/JS,无框架无 npm build)
├── data/             # 快照与事件(会被 git 提交,这是资产)
├── dist/             # 构建产物
├── .github/workflows/pipeline.yml
└── README.md
```

## 3. 页面(英文文案,深色游戏风,简洁,移动端可用;CSS 手写,不引 UI 框架)

- `dist/index.html` — **英雄榜**:表格列 = 英雄(头像+名)/角色/胜率/选取率/禁率;
  顶部切换 region(us/eu/asia)+ mode(competitive/quickplay);按角色分组显示(TANK/DAMAGE/SUPPORT);
  列可排序;数据来自 data/latest.json(直接 fetch,本地 file:// 打开时若无数据则提示用 python -m http.server)。
- `dist/heroes/<hero-id>.html` — **英雄详情**:当前数据卡片 + winrate/pickrate 历史趋势线
  (从最早快照起;纯 SVG 手绘折线,零第三方依赖;快照 <2 个时显示"数据积累中…")+ 该英雄历次补丁变动记录。
- `dist/patches.html` — **补丁变动**:按时间倒序,每事件列出变化英雄、胜率/选率前后值、涨跌标注。

## 4. 管道(GitHub Actions)

- `.github/workflows/pipeline.yml`:cron `0 */4 * * *` + `workflow_dispatch`;
  步骤:checkout → setup-python(3.12)→ pip install requests → `python scripts/snapshot.py && python scripts/build.py`;
  若 data/ 或 dist/ 有变更 → git commit + push 回 main;
  部署:推 gh-pages 分支 或 actions/upload-pages-artifact(选最简可行的,写进 README)。

## 5. 验收标准

1. 仓库根目录 `python scripts/snapshot.py && python scripts/build.py` 全跑通
   (Windows 环境,Python 命令是 `python` 不是 `python3`;缺依赖就 pip install requests)
2. `dist/index.html` 打开显示完整英雄榜(≥20 英雄),region/mode 切换与排序生效
3. `dist/heroes/ana.html` 存在,趋势图逻辑正确(2+ 快照出线,1 快照显示积累提示)
4. `data/latest.json` 结构 = {region: {mode: [hero...]}} 或等价,字段含 winrate/pickrate/banrate/role/name/portrait
5. 至少提交 2 次不同时间的快照(可用手动改时间戳模拟)验证 patch-events 判定逻辑

## 6. 禁止事项(超范围即失败)

- 不做:登录/账号系统、支付、评论、AI/LLM 功能、个人生涯页(绑定战网)、多语言、移动 App、爬非官方接口
- 不做:框架化前端(React/Vue/Next)、npm 构建链;静态 HTML+JS 足够
