const fs = require('fs');
const path = require('path');

// Read the three raw parts
const part1 = fs.readFileSync('/tmp/raw_bands.txt', 'utf8');
const part2 = fs.readFileSync('/tmp/raw_bands_part2.txt', 'utf8');
const part3 = fs.readFileSync('/tmp/raw_bands_part3.txt', 'utf8');

// Combine them
const fullText = part1 + '\n' + part2 + '\n' + part3;

const lines = fullText.split(/\r?\n/);

const bands = [];
let currentBand = null;

const arabicDiacriticsRegex = /[\u064B-\u0652\u0670]/;

for (let line of lines) {
  line = line.trim();
  if (!line) continue;
  if (line.startsWith('---')) continue;

  // Check for band header: e.g. "بند ۱", "### **بند ۲**"
  const bandMatch = line.match(/(?:بند\s+(\d+))|(?:\*\*بند\s+(\d+)\*\*)/);
  if (bandMatch) {
    const id = parseInt(bandMatch[1] || bandMatch[2], 10);
    currentBand = {
      id: id,
      segments: [],
      arabic: '',
      persian: ''
    };
    bands.push(currentBand);
    continue;
  }

  if (!currentBand) continue;

  // Check if it's a note
  const isNote = line.startsWith('_(') || line.includes('ترجمه ترکیبی') || line.includes('طبق متن');
  
  if (isNote) {
    // Append to last segment's Persian translation
    if (currentBand.segments.length > 0) {
      const lastSeg = currentBand.segments[currentBand.segments.length - 1];
      lastSeg.fa += '\n' + line;
    }
  } else if (arabicDiacriticsRegex.test(line)) {
    // It is Arabic because it has diacritics
    currentBand.segments.push({
      ar: line,
      fa: ''
    });
  } else {
    // It is Persian translation
    if (currentBand.segments.length > 0) {
      const lastSeg = currentBand.segments[currentBand.segments.length - 1];
      if (!lastSeg.fa) {
        lastSeg.fa = line;
      } else {
        lastSeg.fa += ' ' + line;
      }
    } else {
      console.warn(`Persian line without Arabic prefix in band ${currentBand.id}: ${line}`);
    }
  }
}

// Post-process bands to build consolidated arabic and persian fields
for (const band of bands) {
  band.arabic = band.segments.map(s => s.ar).join(' ');
  band.persian = band.segments.map(s => s.fa.replace(/\r?\n/g, ' ')).join(' ');
}

// Generate the output TypeScript content
const introTextCode = `export const introText = {
  title: "مقدمه استغفار ۷۰ بندی امیرالمؤمنین (علیه السلام)",
  sections: [
    {
      title: "داستان آموزش استغفار به اعرابی فقیر",
      content: "علامه نوری در کتاب شریف (دارالسلام) می‌نویسد: امام رضا (علیه السلام) از پدران بزرگوار خود نقل می‌کنند که امام حسین (علیه السلام) فرمودند: روزی نزد امیرالمؤمنین (علیه السلام) نشسته بودم که مردی عرب وارد شد و عرض کرد: یا امیرالمؤمنین! من مردی عیالمند و فقیر هستم و مالی که زندگی مرا کفایت کند ندارم.\\n\\nحضرت فرمودند: ای برادر عرب! چرا استغفار نمی‌کنی تا حالت نیکو شود؟\\n\\nعرض کرد: زیاد استغفار می‌کنم، اما تغییری در زندگی‌ام پیدا نشده است.\\n\\nحضرت فرمودند: ای برادر عرب خدای متعال می‌فرماید:\\n«فَقُلْتُ اسْتَغْفِرُوا رَبَّکُمْ إِنَّهُ کَانَ غَفَّاراً» (نوح - ۱۰)\\nبه آن‌ها گفتم: از پروردگار خویش آمرزش بطلبید که او بسیار آمرزنده است.\\n\\nسپس فرمودند: چون به گناه بودن بعضی از اعمالت آگاه نیستی استغفار تو ناقص است؛ زیرا از آن‌ها استغفار نمی‌کنی و نتیجه نمی‌گیری. اینک به تو استغفاری می‌آموزم که اگر آن را هنگام خواب بخوانی، خدا به تو وسعت رزق عطا فرماید.\\n\\nدعا را نوشته و به اعرابی داده و فرمودند: شب، قبل از خوابیدن، این استغفار را بخوان و گریه کن و اگر اشکت جاری نشد تباکی (حالت گریه به خود گرفتن) کن."
    },
    {
      title: "نتیجه و آثار شگفت‌انگیز دعا",
      content: "امام حسین (علیه السلام) فرمودند: سال بعد، اعرابی به خدمت حضرت آمد و عرض کرد: یا امیرالمؤمنین! خداوند به من نعمت‌های زیادی عطا فرمود. شتران و گوسفندانم آن‌قدر زیاد شده‌اند که محلی برای نگه‌داری آن‌ها ندارم.\\n\\nآن حضرت فرمودند: ای برادر عرب! قسم به آن خدایی که محمد (صلی الله علیه و آله) را به نبوت برگزید، بنده‌ای نیست که با این دعا به درگاه خدا استغفار کند، مگر اینکه خدای متعال به برکت آن، گناهانش را آمرزیده، حوائجش را برآورده و به مال و اولادش فراوانی و برکت عطا فرماید.\\n\\n(دارالسلام نوری: ۳/۱۳۳)"
    },
    {
      title: "جامعیت و اهمیت استغفار ۷۰ بندی",
      content: "مردم و حتی متدینین و خوبان، از معصیت بودن بسیاری از کارها غافلند و به گناه بودن آن توجه ندارند. این استغفار شریفی که از امیرالمؤمنین (علیه السلام) نقل شده و در هفتاد بند است، علاوه بر جامع بودن و توجه به این‌گونه گناهانی که غالباً مورد غفلت ماست و دارا بودن آثار معنوی و دنیوی مذکور در مقدمه، بسیار مقرب است و اگر کسی آن را با توجه بخواند آثار عجیبی از آن ظاهر می‌شود.\\n\\nحضرت امیر (علیه السلام) این استغفار ۷۰ بندی را که جامع‌تر از آن استغفاری است که به آن اعرابی تعلیم فرمودند، خودشان بعد از نماز صبح می‌خوانده‌اند، ولی اگر کسی موفق به خواندن آن در هنگام صبح نشود می‌تواند آن را بعد از نماز عصر بخواند.\\n\\n(البلد الأمين والدرع الحصين ص ۳۹)\\nکَانَ عَلِيٌّ علیه السلام یَسْتَغْفِرُ سَبْعِینَ مَرَّةً فِی سَحَرِ کُلِّ لَیْلَةٍ بِعَقِبِ رَکْعَتَیِ الْفَجْرِ بِهذَا الِاسْتِغْفَارِ."
    }
  ]
};`;

const concludingTextCode = `export const concludingText = {
  arabic: "فَإِنَّ لِعِبَادِكَ عَلَيَّ حُقُوقاً أَنَا مُرْتَهَنٌ بِهَا تَغْفِرُهَا لِي كَيْفَ شِئْتَ وَ أَنَّى شِئْتَ يَا أَرْحَمَ الرَّاحِمِينَ.",
  persian: "زیرا بندگانت بر گردنم حقوقی دارند که من در گرو آن‌ها هستم، پس هرگونه و هر زمان که خواستی آن‌ها را ببخش و بیامرز، ای مهربان‌ترین مهربانان!"
};`;

const fileContent = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PrayerBand {
  id: number;
  arabic: string;
  persian: string;
  segments?: { ar: string; fa: string }[];
}

${introTextCode}

${concludingTextCode}

export const prayerBands: PrayerBand[] = ${JSON.stringify(bands, null, 2)};
`;

fs.writeFileSync('/src/data/prayers.ts', fileContent, 'utf8');
console.log(`Successfully parsed ${bands.length} bands and generated prayers.ts!`);
