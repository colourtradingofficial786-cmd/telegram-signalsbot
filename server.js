// Node.js کے ضروری ٹولز جو کلاؤڈ پر ویب سائٹس سے ڈیٹا لاتے ہیں
const fetch = require('node-fetch');

// کنفیگریشن
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxW7OL9tBbZlBz54UWBHa-cUqkwmBhL2_biKxPZYjs4U3IP9nYy153UIyps68_cdke/exec";
let activeServer = '1M'; // WINGO 1M پر سیٹ ہے
let lastResultPeriod = "";
let currentPrediction = null;
let tgHistoryMemory = [];

// نمبرز کی میپنگ (Tri-Layer Mapping)
const algorithmMap = {
  0: { size: 'BIG', alpha: 'B', opposites: [2, 3] },
  1: { size: 'BIG', alpha: 'B', opposites: [3, 4] },
  2: { size: 'SMALL', alpha: 'S', opposites: [7, 8] },
  3: { size: 'BIG', alpha: 'B', opposites: [1, 2] },
  4: { size: 'SMALL', alpha: 'S', opposites: [5, 6] },
  5: { size: 'SMALL', alpha: 'S', opposites: [7, 8] },
  6: { size: 'BIG', alpha: 'B', opposites: [2, 4] },
  7: { size: 'SMALL', alpha: 'S', opposites: [8, 9] },
  8: { size: 'BIG', alpha: 'B', opposites: [1, 3] },
  9: { size: 'SMALL', alpha: 'S', opposites: [5, 6] }
};

// ٹیلی گرام پر آٹو پوسٹ بھیجنے کا فنکشن
async function sendAutoTelegram(text) {
  if (!GOOGLE_SCRIPT_URL) return;
  try {
    const payload = { text: text };
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    console.log("ٹیلی گرام پر سگنل کامیابی سے بھیج دیا گیا ہے!");
  } catch (e) {
    console.error("ٹیلی گرام برج ایرر:", e);
  }
}

// ہسٹری ٹیبل بنانا
function generateTGHistoryTable() {
  if (tgHistoryMemory.length === 0) {
    return "Period: 000 | BIG | WIN ✅\n";
  }
  let tableLines = [];
  tgHistoryMemory.forEach(row => {
    tableLines.push(`Period: ${row.period} | ${row.prediction} | ${row.status}`);
  });
  return tableLines.join("\n") + "\n";
}

// ویب سائٹ سے لائیو ڈیٹا لانے کا فنکشن (بہتر سیکیورٹی بائی پاس کے ساتھ)
async function fetchMarketData() {
  try {
    const url = `https://draw.ar-lottery01.com/WinGo/WinGo_${activeServer}/GetHistoryIssuePage.json?pageNo=1&pageSize=30`;
    
    // یہ ہیڈرز ویب سائٹ کو دھوکہ دیں گے کہ یہ ایک اصلی موبائل براؤزر ہے
    const response = await fetch(url, {
      headers: {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\"",
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": "\"Android\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      },
      referrer: "https://basantgame.club/",
      referrerPolicy: "strict-origin-when-cross-origin",
      method: "GET",
      mode: "cors"
    });

    const textData = await response.text();
    
    // اگر ویب سائٹ نے اب بھی بلاک کر کے ایچ ٹی ایم ایل بھیجی تو یہاں پتہ چل جائے گا
    if (textData.trim().startsWith("<")) {
      console.log("ویب سائٹ نے اب بھی بلاک کیا ہوا ہے، ہم 10 سیکنڈ بعد دوبارہ کوشش کریں گے۔");
      return;
    }

    const data = JSON.parse(textData);
    const list = data.data.list;
    const latest = list[0];

    // اگر نیا پیریڈ آیا ہے تو پروسیس کریں
    if (latest.issueNumber !== lastResultPeriod) {
      if (lastResultPeriod !== "") {
        processResult(latest);
      }
      lastResultPeriod = latest.issueNumber;
      const nextPeriod = (BigInt(latest.issueNumber) + 1n).toString();
      runAntiLossEngine(nextPeriod, latest);
    }
  } catch (e) {
    console.error("مارکیٹ ڈیٹا لانے میں مسئلہ آرہا ہے:", e.message);
  }
}

// اینٹی لاس سگنل جنریٹر
function runAntiLossEngine(currentPeriod, latestResult) {
  const lastNumber = parseInt(latestResult.number);
  if (isNaN(lastNumber) || lastNumber < 0 || lastNumber > 9) return;

  const formula = algorithmMap[lastNumber];
  const finalSize = formula.size;
  const targets = formula.opposites;

  currentPrediction = {
    period: currentPeriod,
    size: finalSize,
    alpha: formula.alpha,
    opposites: targets
  };

  let histTable = generateTGHistoryTable();
  let shortPeriod = currentPrediction.period.slice(-3);
  let serverName = activeServer === '1M' ? "WINGO 1-MIN" : "WINGO 30S";

  let signalPost = `👑 𝗔𝗦𝗜𝗙 👑\n` +
                   `🌟 **V I P  S I G N A L** 🌟\n` +
                   `━━━━━━━━━━━━━━━━━━\n\n` +
                   `🎰 **GAME:** ${serverName}\n\n` +
                   `📌 **PERIOD:** ${shortPeriod}\n\n` +
                   `📊 **TRADE:** ${currentPrediction.size} (${currentPrediction.alpha})\n\n` +
                   `🎯 **NUMBER TRADE:** [${currentPrediction.opposites.join(", ")}]\n\n` +
                   `━━━━━━━━━━━━━━━━━━\n` +
                   `📊 **LIVE RECENT HISTORY:**\n\n` +
                   `${histTable}` +
                   `━━━━━━━━━━━━━━━━━━\n\n` +
                   `🔗 **BASANT CLUB OFFICIAL LINK:**\n` +
                   `👉 https://www.basantgame.club/#/register?invitationCode=877841273421`;

  sendAutoTelegram(signalPost);
}

// رزلٹ چیک کرنا (جیت یا ہار)
function processResult(latestItem) {
  if (!currentPrediction) return;

  const actualNum = parseInt(latestItem.number);
  const actualSize = actualNum >= 5 ? 'BIG' : 'SMALL';
  let isWin = false;
  let statusText = "LOSS ❌";

  if (actualSize === currentPrediction.size) {
    isWin = true;
    statusText = "WIN ✅";
  } else if (currentPrediction.opposites.includes(actualNum)) {
    isWin = true;
    statusText = "JACKPOT PASS ✅";
  }

  // میموری میں رزلٹ محفوظ کریں
  tgHistoryMemory.unshift({
    period: currentPrediction.period.slice(-3),
    prediction: currentPrediction.size,
    status: statusText
  });
  if (tgHistoryMemory.length > 5) tgHistoryMemory.pop();
}

// مسلسل چلنے والا لوپ (ہر 10 سیکنڈ بعد ڈیٹا چیک کرے گا)
console.log("بوٹ کامیابی سے سٹارٹ ہو گیا ہے اور لائیو سگنلز بھیج رہا ہے...");
setInterval(fetchMarketData, 10000);
