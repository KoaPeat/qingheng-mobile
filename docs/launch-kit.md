# 轻衡发布与推广素材

以下文案可直接用于发布。仓库是统一入口；发布前确认 README、截图、公开演示和部署文档已上线。不要把私人手机站点、真实记录、账户配置或凭据作为演示。

## 中文开发者社区长文

**标题：开源了我的个人饮食与体重记录工具「轻衡」：本地记录，可选 AI 与自部署同步**

我想要一个在手机上随手记录饮食和体重的工具：先把每天吃了什么、体重变化记下来，需要时再接入 AI 或云同步。因此做了「轻衡」，现在把代码公开，欢迎试用和提意见。

目前主要有这些功能：

- 手动记录饮食、体重，查看营养统计和历史；
- 记录默认保存在当前设备，支持 JSON 导入和导出；
- 可选 AI 辅助录入，使用自己的服务地址、模型和 API Key，识别结果需要人工核对；
- 可按部署文档连接自己的同步服务，管理自己的存储与读写凭据。

公开预览版前端位于 `web/`，可以作为静态网页部署。我希望轻衡先把日常记录、备份和手机操作做好，再逐步改进。AI 服务可能收费；自部署同步也需要自己配置。它是个人记录工具，营养数据与识别结果包含估算，不能替代专业判断。

代码与上手说明：https://github.com/KoaPeat/qingheng-mobile

虚构数据演示：https://koapeat.github.io/qingheng-mobile/web/?demo=1

欢迎反馈最影响你使用的一个问题，尤其是手机操作、记录流程和自部署文档。如果对你有帮助，欢迎点一个 ⭐ Star，方便以后找到更新。

## 简短社交动态

把自己用的饮食与体重记录工具「轻衡」开源了。

手机记录、本地保存、JSON 备份；可选接入自己的 AI，也可以自行部署同步服务。希望记录这件事能简单一点，数据由自己管理。

项目仍在持续改进，欢迎试用和反馈。觉得有用也欢迎 ⭐ Star：
https://github.com/KoaPeat/qingheng-mobile

虚构数据演示：https://koapeat.github.io/qingheng-mobile/web/?demo=1

## English Show HN draft

**Title: Show HN: Qingheng, a local-first food and weight tracker for mobile browsers**

I built Qingheng for my own daily food and weight logging and have open-sourced it.

The public preview is a static mobile web app in `web/`. Records stay in the current device's browser storage by default, with JSON import and export. AI-assisted entry is optional and uses your own provider, model, and API key. There is also a self-hosted sync option with separate read and write credentials.

The current interface and most documentation are in Chinese. AI estimates need human review, provider charges may apply, and self-hosted sync requires configuration. This is a personal logging tool, not a clinical product.

Repository and setup instructions: https://github.com/KoaPeat/qingheng-mobile

Demo with fictional data: https://koapeat.github.io/qingheng-mobile/web/?demo=1

I'd appreciate feedback on the mobile logging workflow, backup experience, and self-hosting instructions. If you try it, what is the first part you would change?

## 30–60 秒演示脚本

仅使用公开示例或虚构数据，录屏前隐藏浏览器账户和通知。

1. 0–10 秒：打开首页，介绍“个人饮食与体重记录”。
2. 10–25 秒：手动新增一餐，再编辑数量；展示录入后的营养统计。
3. 25–35 秒：添加虚构晨重，查看历史。
4. 35–45 秒：展示 JSON 导出与导入入口，说明记录保存在本机。
5. 45–60 秒：展示仓库和部署文档；字幕注明“AI 自备接口，同步自行部署”。

若要展示 AI 或同步，先在隔离测试环境完成验证；不要录下 API Key、令牌和私人记录。没有完成演示验证的功能只展示文档入口。

## 两周执行安排

| 时间 | 任务 | 完成标准 |
| --- | --- | --- |
| 第 1 天 | 检查开源文件、许可、示例配置和截图 | 新用户可以找到用途、安装方法与限制；无个人数据或凭据 |
| 第 2 天 | 让一位不了解项目的人按文档运行 | 记录卡住的位置，修正文档；未验证步骤明确标注 |
| 第 3 天 | 发布首个公开 Release | 版本说明准确，下载与文档链接可用 |
| 第 4 天 | 发布一篇中文社区介绍 | 遵守社区规则，正文含截图、仓库入口和具体反馈问题 |
| 第 5–6 天 | 回复反馈，优先处理影响首次使用的问题 | 每个可复现问题有记录，敏感数据及时引导私下处理 |
| 第 7 天 | 发布一次进展记录 | 写明修复了什么、仍有哪些限制；避免无变化重复推广 |
| 第 8–9 天 | 补最常见的上手问题并录演示 | README 能回答实际用户提出的问题 |
| 第 10 天 | 如适合，再发英文介绍或第二个相关社区 | 先阅读社区规则；英文文案明确中文界面现状 |
| 第 11–13 天 | 完成小修复，整理适合新贡献者的 Issue | 任务有复现步骤、期望行为和可验证的完成标准 |
| 第 14 天 | 回顾数据与反馈，决定下一阶段 | 用证据选择一到两个重点，发布简短更新 |

不要群发私信、购买 Star、互刷收藏，或在无关仓库和评论中贴推广。外部发布应由维护者确认账号与社区后执行。

## 初始指标与记录方法

发布当天记录基线；下表是观测方法，不代表项目已达到任何数值。GitHub 流量数据只反映平台提供的范围，不能当成完整用户数。

| 指标 | 记录方式 | 两周后要回答的问题 |
| --- | --- | --- |
| Stars / Forks | 发布前、7 天、14 天各记录一次 | 哪次公开分享后，有更多人愿意保留或研究项目？ |
| 仓库访问与克隆 | GitHub Insights → Traffic，及时保存汇总 | 有访问却少有尝试时，上手入口是否不清楚？ |
| 首次运行反馈 | 邀请愿意参与者自愿描述，使用匿名汇总 | 卡在哪一步，能否自行解决？ |
| 有效问题与功能建议 | Issue 标签与人工归纳 | 最常见的三个需求是什么？ |
| 修复进度 | 可复现问题的首次回复、处理结果 | 是否优先解决了影响记录与备份的问题？ |

不设保证能达到的 Star 数；初期以获得几条可复现的使用反馈、帮助新用户完成首次记录为重点。不要为统计收集个人饮食、体重、密钥或未征得同意的身份信息，也不必为推广给应用增加追踪代码。
