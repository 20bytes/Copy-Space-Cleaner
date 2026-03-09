const rawInput = document.getElementById("rawInput");
const cleanOutput = document.getElementById("cleanOutput");
const rawCount = document.getElementById("rawCount");
const cleanCount = document.getElementById("cleanCount");
const autoSync = document.getElementById("autoSync");
const autoSave = document.getElementById("autoSave");
const openFileBtn = document.getElementById("openFile");
const newFileBtn = document.getElementById("newFile");
const saveNowBtn = document.getElementById("saveNow");
const appendNowBtn = document.getElementById("appendNow");
const downloadBtn = document.getElementById("download");
const cleanOnceBtn = document.getElementById("cleanOnce");
const statusEl = document.getElementById("status");

const ruleZhZh = document.getElementById("ruleZhZh");
const ruleZhLatin = document.getElementById("ruleZhLatin");
const rulePunc = document.getElementById("rulePunc");
const ruleUnit = document.getElementById("ruleUnit");
const ruleLatinSpace = document.getElementById("ruleLatinSpace");
const ruleLine = document.getElementById("ruleLine");
const unitListInput = document.getElementById("unitList");

const cjkCharClass = "[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]";
const inlineSpace = "[ \\t\\u00A0\\u2002-\\u200A\\u202F\\u205F]+";
const inlineSpaceOptional = "[ \\t\\u00A0\\u2002-\\u200A\\u202F\\u205F]*";
const closePuncClass = "[，。！？；：、,.!?;:）】》〉」』”’]";
const openPuncClass = "[（【《〈「『“‘]";

let fileHandle = null;
let saveTimer = null;
let ruleChangeTimer = null;
const markdownPickerTypes = [
  {
    description: "Markdown",
    accept: {
      "text/markdown": [".md"],
      "text/plain": [".md"]
    }
  }
];

function setStatus(text, warn = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("warn", warn);
}

function updateCounters() {
  rawCount.textContent = `${rawInput.value.length} 字`;
  cleanCount.textContent = `${cleanOutput.value.length} 字`;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildUnitPattern(raw) {
  const units = raw
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!units.length) return null;

  const uniqueUnits = [...new Set(units)];
  uniqueUnits.sort((a, b) => b.length - a.length);
  return uniqueUnits.map(escapeRegex).join("|");
}

function getRuleOptions() {
  return {
    tightZhZh: ruleZhZh.checked,
    tightZhLatin: ruleZhLatin.checked,
    tightPunc: rulePunc.checked,
    numberUnitSpace: ruleUnit.checked,
    latinSpace: ruleLatinSpace.checked,
    cleanLines: ruleLine.checked,
    unitPattern: buildUnitPattern(unitListInput.value)
  };
}

function cleanChineseSpaces(input, options) {
  let text = input.replace(/\r\n/g, "\n");

  // 将常见不可见空白统一成半角空格，避免 PDF 复制后正则失效
  text = text.replace(/\u3000/g, " ");
  text = text.replace(/[\u00A0\u2002-\u200A\u202F\u205F]/g, " ");

  if (options.tightZhZh) {
    text = text.replace(new RegExp(`(${cjkCharClass})${inlineSpace}(${cjkCharClass})`, "g"), "$1$2");
  }

  if (options.tightZhLatin) {
    text = text.replace(new RegExp(`(${cjkCharClass})${inlineSpace}([A-Za-z0-9])`, "g"), "$1$2");
    text = text.replace(new RegExp(`([A-Za-z0-9])${inlineSpace}(${cjkCharClass})`, "g"), "$1$2");
  }

  if (options.tightPunc) {
    text = text.replace(new RegExp(`(${cjkCharClass})${inlineSpace}(${closePuncClass})`, "g"), "$1$2");
    text = text.replace(new RegExp(`(${openPuncClass})${inlineSpace}(${cjkCharClass})`, "g"), "$1$2");
    text = text.replace(new RegExp(`(${closePuncClass})${inlineSpace}(${cjkCharClass})`, "g"), "$1$2");

    // 英文/数字邻接中文标点时也去空格（例如：16 GB ， -> 16 GB，）
    text = text.replace(new RegExp(`([A-Za-z0-9])${inlineSpace}([，。！？；：、])`, "g"), "$1$2");
    text = text.replace(new RegExp(`([，。！？；：、])${inlineSpace}([A-Za-z0-9])`, "g"), "$1$2");
  }

  if (options.numberUnitSpace && options.unitPattern) {
    const numberPattern = "([+-]?\\d(?:[\\d,]*\\d)?(?:\\.\\d+)?)";
    text = text.replace(
      new RegExp(`${numberPattern}${inlineSpaceOptional}(${options.unitPattern})(?![A-Za-z])`, "g"),
      "$1 $2"
    );
  }

  if (options.latinSpace) {
    text = text.replace(/([A-Za-z0-9])[ \t]{2,}([A-Za-z0-9])/g, "$1 $2");
  }

  if (options.cleanLines) {
    text = text.replace(/[ \t]+\n/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");
  }

  return text.trim();
}

function regenerateFromRaw() {
  const options = getRuleOptions();
  cleanOutput.value = cleanChineseSpaces(rawInput.value, options);
  updateCounters();
  scheduleAutoSave();
}

function handleRuleChange() {
  clearTimeout(ruleChangeTimer);
  ruleChangeTimer = setTimeout(() => {
    if (autoSync.checked) {
      regenerateFromRaw();
      return;
    }
    setStatus("规则已更新。当前关闭自动生成，点击“立即清理”后生效。");
  }, 120);
}

async function ensureWritePermission(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}

async function openExistingMarkdownFile() {
  if (typeof window.showOpenFilePicker !== "function") {
    setStatus("当前浏览器不支持“打开已有文件”。请用 Chrome/Edge 并通过 localhost 打开。", true);
    return;
  }

  try {
    const handles = await window.showOpenFilePicker({
      multiple: false,
      types: markdownPickerTypes
    });
    if (!handles || !handles.length) return;

    fileHandle = handles[0];
    await loadContentFromSelectedFile();
  } catch (err) {
    if (err && err.name !== "AbortError") {
      setStatus(`打开文件失败：${err.message || String(err)}`, true);
    }
  }
}

async function createOrSaveMarkdownFile() {
  if (!window.showSaveFilePicker) {
    setStatus("当前浏览器不支持新建/另存为。请用 Chrome/Edge。", true);
    return;
  }

  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: "notes.md",
      types: markdownPickerTypes
    });

    const file = await fileHandle.getFile();
    if (file.size > 0) {
      const shouldImport = window.confirm("目标 md 文件已有内容。是否立即导入并自动清理？");
      if (shouldImport) {
        await loadContentFromSelectedFile();
        return;
      }
    }

    setStatus(`已选择写入目标：${fileHandle.name}`);
  } catch (err) {
    if (err && err.name !== "AbortError") {
      setStatus(`选择保存目标失败：${err.message || String(err)}`, true);
    }
  }
}

async function loadContentFromSelectedFile() {
  if (!fileHandle) return;

  try {
    const file = await fileHandle.getFile();
    const content = await file.text();
    const hasLocalDraft = rawInput.value.trim().length > 0 || cleanOutput.value.trim().length > 0;

    if (!content.trim().length) {
      setStatus(`已选择文件：${fileHandle.name}（文件为空，可直接开始粘贴）`);
      return;
    }

    if (hasLocalDraft) {
      const shouldReplace = window.confirm(
        "选中的 md 文件有内容。是否用该文件内容替换当前编辑区，并立即按规则清理？"
      );
      if (!shouldReplace) {
        setStatus(`已选择文件：${fileHandle.name}（未导入内容）`);
        return;
      }
    }

    rawInput.value = content;
    regenerateFromRaw();
    setStatus(`已选择并导入：${fileHandle.name}（${content.length} 字，已自动清理）`);
  } catch (err) {
    setStatus(`读取文件失败：${err.message || String(err)}`, true);
  }
}

async function writeMarkdown(content, append = false) {
  if (!fileHandle) {
    setStatus("还没选择 md 文件。请先点“打开已有 md”或“新建/另存为 md”。", true);
    return;
  }

  const granted = await ensureWritePermission(fileHandle);
  if (!granted) {
    setStatus("没有写入权限，请重新授权。", true);
    return;
  }

  try {
    let next = content;

    if (append) {
      const currentFile = await fileHandle.getFile();
      const currentText = await currentFile.text();
      const prefix = currentText.trim().length ? `${currentText.replace(/\s*$/, "")}\n\n` : "";
      next = prefix + content;
    }

    const writable = await fileHandle.createWritable();
    await writable.write(next);
    await writable.close();

    setStatus(`${append ? "追加" : "覆盖"}保存成功：${fileHandle.name}`);
  } catch (err) {
    setStatus(`写入失败：${err.message || String(err)}`, true);
  }
}

function scheduleAutoSave() {
  if (!autoSave.checked || !fileHandle) return;

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    writeMarkdown(cleanOutput.value, false);
  }, 500);
}

function downloadMarkdown() {
  const content = cleanOutput.value;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "cleaned-notes.md";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setStatus("已下载 cleaned-notes.md");
}

rawInput.addEventListener("input", () => {
  updateCounters();
  if (autoSync.checked) regenerateFromRaw();
});

cleanOutput.addEventListener("input", () => {
  updateCounters();
  scheduleAutoSave();
});

autoSync.addEventListener("change", () => {
  if (autoSync.checked) regenerateFromRaw();
});

autoSave.addEventListener("change", () => {
  if (autoSave.checked && !fileHandle) {
    setStatus("已开启自动保存，但还没选择 md 文件。", true);
  }
  scheduleAutoSave();
});

[ruleZhZh, ruleZhLatin, rulePunc, ruleUnit, ruleLatinSpace, ruleLine].forEach((ruleEl) => {
  ruleEl.addEventListener("change", handleRuleChange);
});
unitListInput.addEventListener("input", handleRuleChange);

openFileBtn.addEventListener("click", openExistingMarkdownFile);
newFileBtn.addEventListener("click", createOrSaveMarkdownFile);
saveNowBtn.addEventListener("click", () => writeMarkdown(cleanOutput.value, false));
appendNowBtn.addEventListener("click", () => writeMarkdown(cleanOutput.value, true));
downloadBtn.addEventListener("click", downloadMarkdown);
cleanOnceBtn.addEventListener("click", regenerateFromRaw);

updateCounters();
