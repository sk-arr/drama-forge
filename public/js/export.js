(function (root, factory) {
  "use strict";

  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DramaForgeExport = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function csvEscape(value) {
    var text = String(value == null ? "" : value);
    if (/[",\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function buildCsv(headers, rows) {
    var lines = [headers || []].concat(rows || []).map(function (row) {
      return (row || []).map(csvEscape).join(",");
    });
    return "\uFEFF" + lines.join("\r\n");
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function dateStamp(date) {
    var value = date || new Date();
    return [
      value.getFullYear(),
      pad2(value.getMonth() + 1),
      pad2(value.getDate()),
    ].join("");
  }

  function downloadText(filename, text, mimeType) {
    var blob = new Blob([text], { type: mimeType || "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  async function copyText(text) {
    var value = String(text == null ? "" : text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    var textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  return {
    buildCsv: buildCsv,
    copyText: copyText,
    csvEscape: csvEscape,
    dateStamp: dateStamp,
    downloadText: downloadText,
  };
});
