# 第三方来源与许可

Phi Prism 的新增代码以 GPL-3.0-or-later 发布。存档结构、AES 参数、云接口与榜单算法参考以下上游项目，已保留归属信息。没有包含任何玩家的实际账户凭证或实际存档。

| 内容 | 来源 | 许可 / 说明 |
| --- | --- | --- |
| 存档格式、协议与定数资料 | https://github.com/Catrong/phi-plugin | GPL-3.0；本项目按 GPL-3.0-or-later 提供源码 |
| 曲绘 | https://github.com/Catrong/phi-plugin-ill | 游戏曲绘仍归各原作者及权利人；素材归属与代码许可分别处理 |
| ZIP 解压缩 | fflate 0.8.2, https://github.com/101arrowz/fflate | MIT，assets/fflate-LICENSE.txt |
| AES 解密与摘要 | CryptoJS 4.2.0, https://github.com/brix/crypto-js | MIT，assets/crypto-js-LICENSE.txt |
| 数字字体 | Barlow Condensed SemiBold, https://github.com/google/fonts/tree/main/ofl/barlowcondensed | SIL Open Font License 1.1，assets/Barlow-OFL.txt |
| 中文与日文字体子集 | Noto Sans CJK SC, https://github.com/notofonts/noto-cjk | SIL Open Font License 1.1，assets/Noto-OFL.txt；按本站使用字符生成子集，字体别名 PhiSans |

assets/art.js 中的曲绘经过尺寸优化并以内嵌方式存储。上游每首曲目的画师信息保存在 assets/data.js 中，并可在单曲详情查看。Phigros 的游戏名称及相关标识归相应权利人所有。

examples/test-save.zip 是自动生成的人工测试夹具，不是玩家存档。examples/demo-scores.json 与示例图片中的成绩是人工模拟数据。
