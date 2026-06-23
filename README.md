# 🧹 Copy Space Cleaner

![License](https://img.shields.io/badge/license-MIT-green)
![Type](https://img.shields.io/badge/type-zero--dependency-blue)
![Status](https://img.shields.io/badge/status-archived-lightgrey)

> 一个零依赖的本地小工具：把网页 / PDF 复制出来的文本，按「Word 友好」规则清理空格，并实时生成可编辑的 Markdown。

> [!NOTE]
> **本仓库已归档（Archived）**，不再继续开发或接受 issue / PR。
> 代码以现状（as-is）提供，仍可正常本地运行，欢迎自由 fork 继续维护。

---

## 功能概览

- 左侧粘贴网页 / PDF 复制出的原文
- 按「Word 友好」规则自动清理空格（中英贴合、数字与单位留 1 空格）
- 右侧实时生成并可继续手动编辑 Markdown
- 可覆盖保存或追加保存到本地 `.md` 文件（基于浏览器 File System Access API）

---

## 启动

在项目目录运行：

```bash
python3 -m http.server 5173
```

然后打开 <http://localhost:5173>。

> 建议使用 Chrome / Edge —— 它们支持直接写入本地文件；其他浏览器可用「下载 md」兜底。

---

## 使用流程

1. 把网页或 PDF 文本粘贴到左侧「原始文本」区
2. 右侧会实时生成清理后的 Markdown
3. 点击「打开已有 md」读取现有文件（自动导入并清理）
   - 若当前编辑区已有内容，会先弹窗确认是否替换，避免误覆盖
4. 点击「新建 / 另存为 md」可指定一个新的保存目标文件
5. 可选：开启「自动覆盖保存到 md」做实时落盘，或手动点「覆盖保存 / 追加保存」
6. 在「规则设置（Word 友好）」里可切换规则、修改单位列表
7. 如浏览器不支持直接写文件，可点「下载 md」

---

## 默认清理规则（Word 友好）

- 去掉中文与中文之间的空格
- 去掉中文与英文字母 / 数字之间的空格（`我是 AI` → `我是AI`）
- 去掉中文标点前后的空格（`我们提出 一种方法。 日常` → `我们提出一种方法。日常`）
- 数字与单位之间标准化为一个空格（`10MB/s` → `10 MB/s`）
- 英文段落中多余空格压缩为一个
- 去掉行尾空白
- 超过 2 个连续空行压缩为 2 个

---

## 单位规则说明

- 「数字与单位空格」只处理你在「单位列表」里配置的单位
- 单位列表用逗号分隔，例如：`kg,km,MB/s,ms,°C,kWh`
- 可按文档类型增删单位，避免误替换

---

## 文件结构

| 文件 | 说明 |
| --- | --- |
| `index.html` | 界面 |
| `app.js` | 规则引擎、清理与文件保存逻辑 |
| `README.md` | 说明文档 |

---

## License

MIT © 20bytes
