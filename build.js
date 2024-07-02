import { Eta } from "https://deno.land/x/eta@v3.4.0/src/index.ts";

const fileNames = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
];
const dirNames = [
  "小1",
  "小2",
  "小3",
  "小4",
  "小5",
  "小6",
  "中2",
  "中3",
  "高校",
  "常用",
  "準1級",
  "1級",
  "表外",
];
const gradeNames = [
  "小学1年生",
  "小学2年生",
  "小学3年生",
  "小学4年生",
  "小学5年生",
  "小学6年生",
  "中学1〜2年生",
  "中学3年生",
  "高校生",
  "常用漢字",
  "漢検準1級",
  "漢検1級",
  "表外",
];

function toContent(words) {
  const n = 100;
  let html = "";
  for (let i = 0; i < words.length; i += n) {
    const from = i;
    const to = i + n;
    const wordLinks = words.slice(from, to)
      .map((word) => toLink(word)).join("\n");
    html += `
      <div class="card">
        <div class="card-header">${from + 1}〜${to}</div>
        <div class="card-body">
          ${wordLinks}
        </div>
      </div>
    `;
  }
  return html;
}

function toLink(word) {
  let html = "\n";
  const url = "https://www.google.com/search?q=" + word + "とは";
  html += '<a href="' + url +
    '" class="mx-2" target="_blank" rel="noopener noreferer">' +
    word + "</a>\n";
  return html;
}

function selected(grade, index) {
  if (grade == index) {
    return "selected";
  } else {
    return "";
  }
}

const eta = new Eta({ views: ".", cache: true });
const allVocabs = Deno.readTextFileSync(`dist/all.csv`);
const num = allVocabs.trimEnd().split("\n").length;
for (let i = 0; i < dirNames.length; i++) {
  const words = [];
  const text = Deno.readTextFileSync(`dist/${fileNames[i]}.csv`);
  text.trimEnd().split("\n").forEach((line) => {
    words.push(line.split(",")[0]);
  });
  const dir = "src/" + dirNames[i];
  Deno.mkdirSync(dir, { recursive: true });
  const html = eta.render("page.eta", {
    num: num.toLocaleString("ja-JP"),
    grade: fileNames[i],
    gradeName: gradeNames[i],
    content: toContent(words),
    selected: selected,
  });
  Deno.writeTextFileSync(dir + "/index.html", html);
}
