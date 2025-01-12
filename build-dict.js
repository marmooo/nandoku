import { TextLineStream } from "jsr:@std/streams/text-line-stream";
import { JKAT, Kanji } from "npm:@marmooo/kanji@0.0.8";
import { YomiDict } from "npm:yomi-dict@0.2.0";
import { Onkun } from "npm:onkun@0.3.0";

async function loadInappropriateWordsJa() {
  const dict = {};
  const file = await Deno.open("inappropriate-words-ja/Sexual.txt");
  const lineStream = file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());
  for await (const word of lineStream) {
    if (!word) continue;
    if (!["イク", "催眠"].includes(word)) {
      dict[word] = true;
    }
  }
  dict["性病"] = true;
  return dict;
}

async function loadSudachiFilter() {
  const dict = {};
  const paths = [
    "SudachiDict/src/main/text/small_lex.csv",
    "SudachiDict/src/main/text/core_lex.csv",
    // "SudachiDict/src/main/text/notcore_lex.csv",
  ];
  for (const path of paths) {
    const file = await Deno.open(path);
    const lineStream = file.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());
    for await (const line of lineStream) {
      if (!line) continue;
      const arr = line.split(",");
      const lemma = arr[0];
      const leftId = arr[1];
      const pos1 = arr[5];
      const pos2 = arr[6];
      const form = arr[10];
      const abc = arr[14];
      if (leftId == "-1") continue;
      if (pos1 == "補助記号") continue;
      if (pos2 == "固有名詞") continue;
      if (abc != "A") continue;
      if (form != "*" && !form.includes("終止形")) continue;
      dict[lemma] = true;
    }
  }
  return dict;
}

function getYomis(kanji, grade) {
  const onkun = onkunDict.get(kanji);
  if (grade <= 9) {
    return onkun["Joyo"];
    // if (grade <= 5) {
    //   return onkun["小学"];
    // } else if (grade <= 7) {
    //   const yomis = [];
    //   yomis.push(...onkun["小学"]);
    //   yomis.push(...onkun["中学"]);
    //   return yomis;
    // } else if (grade <= 9) {
    //   const yomis = [];
    //   yomis.push(...onkun["小学"]);
    //   yomis.push(...onkun["中学"]);
    //   yomis.push(...onkun["高校"]);
    //   return yomis;
  } else if (onkun) {
    return onkun["Unihan"];
  } else {
    console.log(`warning: ${kanji} onkun is undefined`);
    return [];
  }
}

async function parseLemma() {
  const hiraganaRegexp = /^[ぁ-ゔァ-ヴー]+$/;
  const filterRegexp =
    /^[ぁ-ゔァ-ヴー\u3400-\u9FFF\uF900-\uFAFF\u{20000}-\u{2FFFF}]+$/u;
  const inappropriateWordsJa = await loadInappropriateWordsJa();
  const sudachiFilter = await loadSudachiFilter();

  const dict = {};
  const file = await Deno.open(
    "nwc2010-ngrams/word/over999/1gms/1gm-0000",
  );
  const lineStream = file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());
  for await (const line of lineStream) {
    if (!line) continue;
    const arr = line.split(/\s/);
    const lemma = arr[0];
    if (lemma in sudachiFilter === false) continue;
    if (lemma in inappropriateWordsJa) continue;
    if (lemma.length == 1) continue; // 一文字の語彙は無視
    if (!filterRegexp.test(lemma)) continue; // 数字記号は無視
    if (hiraganaRegexp.test(lemma)) continue;
    if (!isDifficultReading(lemma)) continue; // 難読漢字以外は無視
    const count = parseInt(arr[1]);
    if (lemma in dict) {
      dict[lemma] += count;
    } else {
      dict[lemma] = count;
    }
  }
  const arr = Object.entries(dict).sort((a, b) => b[1] - a[1]);
  return arr;
}

function kanaToHira(str) {
  return str.replace(/[ァ-ヶ]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

function combination(...array) {
  function make(arr1, arr2) {
    if (arr1.length === 0) return arr2;
    return arr1.reduce((arr, v1) => {
      arr2.forEach((v2) => {
        const group = [].concat(v1, v2);
        arr.push(group);
      });
      return arr;
    }, []);
  }
  return array.reduce(make, []);
}

function toHiragana(onkunDict) {
  const dict = onkunDict.dict;
  for (const onkun of Object.values(dict)) {
    for (const [key, yomis] of Object.entries(onkun)) {
      onkun[key] = yomis.map((yomi) => kanaToHira(yomi));
    }
  }
}

const dakuonCandidates = Array.from("かきくけこさしすせそたちつてとはひふへほ");
const dakuonList = Array.from("がぎぐげござじずぜぞだぢづでどばびぶべぼ");
const dakuonDict = {};
dakuonCandidates.forEach((char, i) => dakuonDict[char] = dakuonList[i]);

function addDakuon(onkunDict) {
  const dict = onkunDict.dict;
  for (const onkun of Object.values(dict)) {
    for (const [key, yomis] of Object.entries(onkun)) {
      yomis.forEach((yomi) => {
        if (yomi[0] in dakuonDict) {
          const dakuon = dakuonDict[yomi[0]];
          onkun[key].push(dakuon + yomi.slice(1));
        }
      });
    }
  }
}

const handakuonCandidates = Array.from("はひふへほ");
const handakuonList = Array.from("ぱぴぷぺぽ");
const handakuonDict = {};
handakuonCandidates.forEach((char, i) =>
  handakuonDict[char] = handakuonList[i]
);

function addHandakuon(onkunDict) {
  const dict = onkunDict.dict;
  for (const onkun of Object.values(dict)) {
    for (const [key, yomis] of Object.entries(onkun)) {
      yomis.forEach((yomi) => {
        if (yomi[0] in handakuonDict) {
          const handakuon = handakuonDict[yomi[0]];
          onkun[key].push(handakuon + yomi.slice(1));
        }
      });
    }
  }
}

const sokuonCandidates = Array.from("きくちつ");
const sokuonDict = {};
sokuonCandidates.forEach((char) => sokuonDict[char] = true);

function addSokuon(onkunDict) {
  const dict = onkunDict.dict;
  for (const onkun of Object.values(dict)) {
    for (const [key, yomis] of Object.entries(onkun)) {
      yomis.forEach((yomi) => {
        if (yomi.at(-1) in sokuonDict) {
          onkun[key].push(yomi.slice(0, -1) + "っ");
        }
      });
    }
  }
}

// https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/okurikana/honbun02.html
// ex: 当たる --> 当る
function addKyoyous(onkunDict) {
  const dict = onkunDict.dict;
  for (const onkun of Object.values(dict)) {
    for (const [key, yomis] of Object.entries(onkun)) {
      yomis.forEach((yomi) => {
        if (yomi.includes("-")) {
          const arr = yomi.split("-");
          for (let i = 1; i < arr[1].length; i++) {
            onkun[key].push(
              `${arr[0]}${arr[1].slice(0, i)}-${arr[1].slice(i)}`,
            );
          }
        }
      });
    }
  }
}

function addNouns(onkunDict) {
  const dict = onkunDict.dict;
  for (const [kanji, onkun] of Object.entries(dict)) {
    for (const [key, yomis] of Object.entries(onkun)) {
      const yomiCandidates = yomiDict.get(kanji);
      if (yomiCandidates) {
        const set = new Set([...yomis, ...yomiCandidates]);
        onkun[key] = [...set];
      }
    }
  }
}

const renjouDict = {
  "あ": "な",
  "い": "に",
  "う": "ぬ",
  "え": "ね",
  "お": "の",
};

function toRenjou(yomi) {
  return yomi.replaceAll(/ん([あいうえお])/g, (_, p1) => "ん" + renjouDict[p1]);
}

function isDifficultReading(lemma) {
  // 常用漢字の音訓以外はすべて難読漢字とみなす
  const kanjis = lemma.replaceAll(/[ぁ-ゔァ-ヴー]/g, "");
  if (getGrade(kanjis) >= 10) return true;

  const patterns = Array.from(kanaToHira(lemma)).map((char) => {
    if (/[ぁ-ゔァ-ヴー]/.test(char)) {
      return [char];
    } else {
      const grade = jkat.getGrade(char);
      const yomis = getYomis(char, grade);
      return yomis;
    }
  }).map((arr) => {
    if (arr.length == 0) return [""];
    return arr;
  });
  const yomis = yomiDict.get(lemma);
  if (!yomis) return true;
  return !combination(...patterns).some((arr) => {
    const yomi = arr.map((onkun) => onkun.split("-")[0]).join("");
    if (yomis.includes(yomi)) return true;
    // https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/okurikana/honbun04.html
    // 例外 / 許容
    // ex: 町並 vs 町並み
    for (let i = 1; i <= 3; i++) {
      if (yomis.includes(yomi.slice(0, -i))) return true;
    }
    // 連声
    // ex: 天皇: てん+おう --> てんのう
    const renjou = toRenjou(yomi);
    if (yomi != renjou && yomis.includes(renjou)) return true;
    return false;
  });
}

function getGrade(word) {
  const grades = Array.from(word).map((kanji) => {
    const grade = jkat.getGrade(kanji);
    return (grade >= 0) ? grade : 12;
  });
  return Math.max(...grades);
}

function splitByGrade(arr) {
  const graded = new Array(JKAT.length + 1);
  for (let grade = 0; grade <= JKAT.length; grade++) {
    graded[grade] = [];
  }
  for (const [lemma, count] of arr) {
    const kanjis = lemma.replaceAll(/[ぁ-ゔァ-ヴー]/g, "");
    if (kanjis.length == 0) continue;
    const grade = getGrade(kanjis);
    graded[grade].push([lemma, count]);
  }
  return graded;
}

const outDir = "dist";
const yomiDict = await YomiDict.fetch(
  "https://raw.githubusercontent.com/marmooo/yomi-dict/v0.1.8/yomi.csv",
);
const onkunDict = new Onkun();
await onkunDict.fetchJoyo(
  "https://raw.githubusercontent.com/marmooo/onkun/v0.2.8/data/joyo-2017.csv",
);
await onkunDict.fetch(
  "Joyo",
  "https://raw.githubusercontent.com/marmooo/onkun/v0.2.8/data/joyo-2010.csv",
);
await onkunDict.fetch(
  "Unihan",
  "https://raw.githubusercontent.com/marmooo/onkun/v0.2.8/data/Unihan-2023-07-15.csv",
);
toHiragana(onkunDict);
addDakuon(onkunDict);
addHandakuon(onkunDict);
addSokuon(onkunDict);
addKyoyous(onkunDict);
addNouns(onkunDict);

const jkat = new Kanji(JKAT);

const result = await parseLemma();
Deno.writeTextFile(
  `${outDir}/all.csv`,
  result.map((x) => x.join(",")).join("\n"),
);
const graded = splitByGrade(result);
for (let grade = 0; grade < graded.length; grade++) {
  Deno.writeTextFile(
    `${outDir}/${grade + 1}.csv`,
    graded[grade].map((x) => x.join(",")).join("\n"),
  );
}
