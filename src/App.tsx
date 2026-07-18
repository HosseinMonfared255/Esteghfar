/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Moon,
  Sun,
  Settings,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Share2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
  Sliders,
  Type,
  Grid,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
  Check,
  Trash2,
  Calendar,
  Compass,
  ArrowUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { prayerBands, introText, concludingText, PrayerBand } from "./data/prayers";

// --- Highly Optimized Monotonic Alignment Engine ---

function stripDiacritics(text: string): string {
  return text.replace(/[\u064B-\u0652\u0670]/g, "");
}

function normalizeWord(word: string): string {
  let w = stripDiacritics(word);
  w = w.toLowerCase();
  w = w.replace(/ي/g, "ی").replace(/ى/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ت");
  if (w.startsWith("ال") && w.length > 3) {
    w = w.substring(2);
  }
  return w;
}

function getSimilarityScore(arClause: string, faClause: string): number {
  const arWords = arClause.split(/[\s،,؛;\.!؟\?]+/).map(normalizeWord).filter(w => w.length > 1);
  const faWords = faClause.split(/[\s،,؛;\.!؟\?]+/).map(normalizeWord).filter(w => w.length > 1);
  
  let score = 0;
  for (const arW of arWords) {
    for (const faW of faWords) {
      if (arW === faW) {
        score += 5; // Strong match for exact cognates
      } else if (arW.length >= 3 && faW.length >= 3) {
        if (arW.includes(faW) || faW.includes(arW)) {
          score += 3;
        }
      }
    }
  }
  
  const arRaw = stripDiacritics(arClause);
  const faRaw = faClause;
  
  if (arRaw.includes("اللَّهُمَّ") || arRaw.includes("الهم")) {
    if (faRaw.includes("الها") || faRaw.includes("خدایا") || faRaw.includes("خدا")) score += 4;
  }
  if (arRaw.includes("رب") || arRaw.includes("الرب")) {
    if (faRaw.includes("پروردگار")) score += 4;
  }
  if (arRaw.includes("عبد") || arRaw.includes("العبد")) {
    if (faRaw.includes("بنده")) score += 4;
  }
  if (arRaw.includes("ذنب") || arRaw.includes("الذنب") || arRaw.includes("ذنوب")) {
    if (faRaw.includes("گناه")) score += 4;
  }
  if (arRaw.includes("عثرت") || arRaw.includes("عثرة")) {
    if (faRaw.includes("لغزش")) score += 4;
  }
  if (arRaw.includes("عفو") || arRaw.includes("العفو")) {
    if (faRaw.includes("گذشت") || faRaw.includes("عفو")) score += 4;
  }
  if (arRaw.includes("تقوى") || arRaw.includes("تقوی")) {
    if (faRaw.includes("تقوا")) score += 4;
  }
  if (arRaw.includes("اجابت")) {
    if (faRaw.includes("اجابت")) score += 4;
  }
  
  return score;
}

function splitWithPunctuation(text: string): { text: string; punc: string }[] {
  const matches = Array.from(text.matchAll(/([^،,؛;\.!؟\?]+)([،,؛;\.!؟\?]+)?/g));
  const parts: { text: string; punc: string }[] = [];
  for (const match of matches) {
    parts.push({
      text: match[1].trim(),
      punc: match[2] || ""
    });
  }
  if (parts.length === 0 && text.trim().length > 0) {
    parts.push({ text: text.trim(), punc: "" });
  }
  return parts;
}

function alignSentences(arabicText: string, persianText: string): { ar: string; fa: string }[] {
  const arParts = splitWithPunctuation(arabicText);
  const faParts = splitWithPunctuation(persianText);
  
  if (arParts.length === 0 || faParts.length === 0) {
    return [{ ar: arabicText, fa: persianText }];
  }
  
  const N = arParts.length;
  const M = faParts.length;
  
  const dp: number[][] = Array.from({ length: N + 1 }, () => Array(M + 1).fill(-Infinity));
  const parent: [number, number][][] = Array.from({ length: N + 1 }, () => Array(M + 1).fill([-1, -1]));
  
  dp[0][0] = 0;
  
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= M; j++) {
      if (dp[i][j] === -Infinity) continue;
      
      // Try to form a block by taking some Arabic clauses and some Persian clauses
      // We can take up to 3 clauses from each to prevent too large blocks
      for (let di = 1; di <= 3; di++) {
        for (let dj = 1; dj <= 3; dj++) {
          if (i + di <= N && j + dj <= M) {
            const arSub = arParts.slice(i, i + di);
            const faSub = faParts.slice(j, j + dj);
            
            const arBlock = arSub.map(p => p.text + p.punc).join(" ");
            const faBlock = faSub.map(p => p.text + p.punc).join(" ");
            
            const sim = getSimilarityScore(arBlock, faBlock);
            
            // Length compatibility score
            const arLen = arBlock.length;
            const faLen = faBlock.length;
            const lenRatio = Math.min(arLen, faLen) / Math.max(arLen, faLen);
            const lenScore = lenRatio * 6; // weight for length balance
            
            // Block size penalty to prefer smaller blocks when they have good similarity
            const sizePenalty = (di > 1 ? -1 : 0) + (dj > 1 ? -1 : 0);
            
            const transitionScore = sim + lenScore + sizePenalty;
            const nextScore = dp[i][j] + transitionScore;
            
            if (nextScore > dp[i + di][j + dj]) {
              dp[i + di][j + dj] = nextScore;
              parent[i + di][j + dj] = [i, j];
            }
          }
        }
      }
      
      // Also allow 1-to-0 or 0-to-1 matching if we're desperate, but with a heavy penalty
      if (i + 1 <= N) {
        const nextScore = dp[i][j] - 15; // heavy penalty for unpaired Arabic clause
        if (nextScore > dp[i + 1][j]) {
          dp[i + 1][j] = nextScore;
          parent[i + 1][j] = [i, j];
        }
      }
      if (j + 1 <= M) {
        const nextScore = dp[i][j] - 15; // heavy penalty for unpaired Persian clause
        if (nextScore > dp[i][j + 1]) {
          dp[i][j + 1] = nextScore;
          parent[i][j + 1] = [i, j];
        }
      }
    }
  }
  
  // Reconstruct path
  const path: [number, number][] = [];
  let curr: [number, number] = [N, M];
  while (curr[0] !== 0 || curr[1] !== 0) {
    path.push(curr);
    curr = parent[curr[0]][curr[1]];
  }
  path.push([0, 0]);
  path.reverse();
  
  const pairs: { ar: string; fa: string }[] = [];
  for (let k = 0; k < path.length - 1; k++) {
    const [prevI, prevJ] = path[k];
    const [nextI, nextJ] = path[k + 1];
    
    const arSub = arParts.slice(prevI, nextI);
    const faSub = faParts.slice(prevJ, nextJ);
    
    const arStr = arSub.map(p => p.text + p.punc).join(" ");
    const faStr = faSub.map(p => p.text + p.punc).join(" ");
    
    // Only push non-empty or group them
    if (arStr || faStr) {
      pairs.push({ ar: arStr || "", fa: faStr || "" });
    }
  }
  
  return pairs;
}

export default function App() {
  // --- Persisted States via LocalStorage ---
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("istighfar_darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  const [arabicFontSize, setArabicFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("istighfar_arabicFontSize");
    return saved ? parseInt(saved, 10) : 22;
  });

  const [persianFontSize, setPersianFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("istighfar_persianFontSize");
    return saved ? parseInt(saved, 10) : 15;
  });

  const [selectedFont, setSelectedFont] = useState<string>(() => {
    const saved = localStorage.getItem("istighfar_selectedFont");
    return saved || "Amiri";
  });

  const [showTranslation, setShowTranslation] = useState<boolean>(() => {
    const saved = localStorage.getItem("istighfar_showTranslation");
    return saved ? JSON.parse(saved) : true;
  });

  const [readBands, setReadBands] = useState<number[]>(() => {
    const saved = localStorage.getItem("istighfar_readBands");
    return saved ? JSON.parse(saved) : [];
  });

  const [bookmarkedBands, setBookmarkedBands] = useState<number[]>(() => {
    const saved = localStorage.getItem("istighfar_bookmarkedBands");
    return saved ? JSON.parse(saved) : [];
  });

  const [viewMode, setViewMode] = useState<"list" | "focus">(() => {
    const saved = localStorage.getItem("istighfar_viewMode");
    return (saved as "list" | "focus") || "list";
  });

  const [translationMode, setTranslationMode] = useState<"sentence" | "block">(() => {
    const saved = localStorage.getItem("istighfar_translationMode");
    return (saved as "sentence" | "block") || "sentence";
  });

  // --- UI/Interaction States ---
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "bookmarked" | "read" | "unread">("all");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    const saved = localStorage.getItem("istighfar_showIntro");
    return saved ? JSON.parse(saved) : true;
  });
  const [showJumpGrid, setShowIntroJumpGrid] = useState<boolean>(false);
  const [currentFocusIndex, setCurrentFocusIndex] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  // Tasbih counter for selected band
  const [tasbihCounts, setTasbihCounter] = useState<Record<number, number>>(() => {
    const saved = localStorage.getItem("istighfar_tasbihCounts");
    return saved ? JSON.parse(saved) : {};
  });

  // Save states to localStorage when they change
  useEffect(() => {
    localStorage.setItem("istighfar_darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("istighfar_arabicFontSize", arabicFontSize.toString());
  }, [arabicFontSize]);

  useEffect(() => {
    localStorage.setItem("istighfar_persianFontSize", persianFontSize.toString());
  }, [persianFontSize]);

  useEffect(() => {
    localStorage.setItem("istighfar_selectedFont", selectedFont);
  }, [selectedFont]);

  useEffect(() => {
    localStorage.setItem("istighfar_showTranslation", JSON.stringify(showTranslation));
  }, [showTranslation]);

  useEffect(() => {
    localStorage.setItem("istighfar_readBands", JSON.stringify(readBands));
  }, [readBands]);

  useEffect(() => {
    localStorage.setItem("istighfar_bookmarkedBands", JSON.stringify(bookmarkedBands));
  }, [bookmarkedBands]);

  useEffect(() => {
    localStorage.setItem("istighfar_showIntro", JSON.stringify(showIntro));
  }, [showIntro]);

  useEffect(() => {
    localStorage.setItem("istighfar_viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("istighfar_translationMode", translationMode);
  }, [translationMode]);

  useEffect(() => {
    localStorage.setItem("istighfar_tasbihCounts", JSON.stringify(tasbihCounts));
  }, [tasbihCounts]);

  // Scroll to top detection
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Show a floating feedback toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Toggle specific states
  const toggleBookmark = (id: number) => {
    setBookmarkedBands((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        triggerToast("بند از نشانه‌گذاری‌ها حذف شد");
        return prev.filter((item) => item !== id);
      } else {
        triggerToast("بند به نشانه‌گذاری‌ها اضافه شد");
        return [...prev, id];
      }
    });
  };

  const toggleRead = (id: number) => {
    setReadBands((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        triggerToast("به عنوان خوانده‌نشده علامت‌گذاری شد");
        return prev.filter((item) => item !== id);
      } else {
        triggerToast("به عنوان خوانده‌شده علامت‌گذاری شد");
        return [...prev, id];
      }
    });
  };

  const incrementTasbih = (id: number) => {
    setTasbihCounter((prev) => {
      const current = prev[id] || 0;
      const updated = { ...prev, [id]: current + 1 };
      return updated;
    });
  };

  const resetTasbih = (id: number) => {
    setTasbihCounter((prev) => {
      const updated = { ...prev, [id]: 0 };
      return updated;
    });
  };

  // Copy helper
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`متن ${type} کپی شد!`);
  };

  // Search and filter logic
  const filteredBands = prayerBands.filter((band) => {
    const matchesSearch =
      band.arabic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      band.persian.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === "bookmarked") {
      return bookmarkedBands.includes(band.id);
    }
    if (filterMode === "read") {
      return readBands.includes(band.id);
    }
    if (filterMode === "unread") {
      return !readBands.includes(band.id);
    }

    return true;
  });

  const jumpToBand = (id: number) => {
    if (viewMode === "list") {
      const element = document.getElementById(`band-${id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Highlight briefly
        element.classList.add("ring-4", "ring-orange-500/50");
        setTimeout(() => {
          element.classList.remove("ring-4", "ring-orange-500/50");
        }, 1500);
      }
    }
    else {
      const indexInFiltered = filteredBands.findIndex((band) => band.id === id);
      if (indexInFiltered !== -1) {
        setCurrentFocusIndex(indexInFiltered);
      } else {
        // Switch to all filters first if not matches current filters
        setFilterMode("all");
        const idx = prayerBands.findIndex((band) => band.id === id);
        if (idx !== -1) {
          setCurrentFocusIndex(idx);
        }
      }
    }
    setShowIntroJumpGrid(false);
  };

  const handleResetProgress = () => {
    if (confirm("آیا از پاک کردن تمامی نشانه‌گذاری‌ها و بندهای خوانده‌شده مطمئن هستید؟")) {
      setReadBands([]);
      setBookmarkedBands([]);
      setTasbihCounter({});
      triggerToast("تمامی پیشرفت‌ها بازنشانی شد.");
    }
  };

  const getProgressPercentage = () => {
    if (prayerBands.length === 0) return 0;
    return Math.round((readBands.length / prayerBands.length) * 100);
  };

  return (
    <div
      className={`transition-colors duration-300 min-h-screen pb-16 font-sans ${
        darkMode ? "bg-[#1a1a1a] text-slate-100" : "bg-[#fdf6e3] text-[#2d2d2d]"
      }`}
      dir="rtl"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium bg-orange-600 text-white flex items-center gap-2 border border-orange-500/20"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300 ${
          darkMode
            ? "bg-[#1a1a1a]/90 border-zinc-800"
            : "bg-[#fdf6e3]/95 border-[#e5e5e5]"
        }`}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 text-white p-2 rounded-xl shadow-md shadow-orange-500/10">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base md:text-lg tracking-tight">استغفار ۷۰ بندی</h1>
              <p className={`text-[10px] md:text-xs ${darkMode ? "text-slate-400" : "text-orange-800/80"}`}>
                امیرالمؤمنین حضرت علی علیه السلام
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark Mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2.5 rounded-xl border transition-all hover:scale-105 ${
                darkMode
                  ? "bg-zinc-800 border-zinc-700 text-amber-400"
                  : "bg-orange-50 border-[#e5e5e5] text-orange-700"
              }`}
              title={darkMode ? "حالت روز" : "حالت شب"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Jump Grid button */}
            <button
              onClick={() => setShowIntroJumpGrid(!showJumpGrid)}
              className={`p-2.5 rounded-xl border transition-all hover:scale-105 ${
                showJumpGrid
                  ? "bg-orange-500 text-white border-orange-400"
                  : darkMode
                  ? "bg-zinc-800 border-zinc-700 text-slate-300"
                  : "bg-orange-50 border-[#e5e5e5] text-orange-700"
              }`}
              title="پرش به بند"
            >
              <Grid className="w-4 h-4" />
            </button>

            {/* Settings button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-xl border transition-all hover:scale-105 ${
                showSettings
                  ? "bg-orange-500 text-white border-orange-400"
                  : darkMode
                  ? "bg-zinc-800 border-zinc-700 text-slate-300"
                  : "bg-orange-50 border-[#e5e5e5] text-orange-700"
              }`}
              title="تنظیمات قلم و ظاهر"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Scroll Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 left-6 z-40 p-3 rounded-full bg-orange-500 text-white shadow-xl hover:bg-orange-600 transition-colors"
            title="رفتن به بالای صفحه"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        {/* Navigation Grid Drawer / Modal */}
        <AnimatePresence>
          {showJumpGrid && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-5 rounded-2xl border shadow-xl ${
                darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#e5e5e5]"
              }`}
            >
              <div className="flex items-center justify-between mb-4 border-b pb-3 border-black/[0.05] dark:border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <Grid className="w-4 h-4 text-orange-500" />
                  <h3 className="font-bold text-sm">پرش سریع به بندهای استغفار</h3>
                </div>
                <span className="text-xs text-slate-400">بند ۱ تا ۷۰</span>
              </div>
              <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
                {Array.from({ length: 70 }, (_, i) => i + 1).map((num) => {
                  const isRead = readBands.includes(num);
                  const isBookmarked = bookmarkedBands.includes(num);
                  return (
                    <button
                      key={num}
                      onClick={() => jumpToBand(num)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all relative ${
                        isRead
                          ? "bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30"
                          : darkMode
                          ? "bg-zinc-800 hover:bg-zinc-700 text-slate-300"
                          : "bg-orange-50 hover:bg-orange-100 text-orange-800 border border-[#e5e5e5]"
                      }`}
                    >
                      {num}
                      {isBookmarked && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-5 rounded-2xl border shadow-xl space-y-5 ${
                darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-[#e5e5e5]"
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-black/[0.05] dark:border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-orange-500" />
                  <h3 className="font-bold text-sm">تنظیمات ظاهر و ابزارها</h3>
                </div>
                <button
                  onClick={() => {
                    setArabicFontSize(22);
                    setPersianFontSize(15);
                    setSelectedFont("Amiri");
                    setShowTranslation(true);
                    setTranslationMode("sentence");
                    triggerToast("تنظیمات به حالت اولیه بازگشت");
                  }}
                  className="text-xs text-orange-500 flex items-center gap-1 hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>بازنشانی</span>
                </button>
              </div>

              {/* Font Sizer Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1">
                      <Type className="w-3.5 h-3.5 text-slate-400" />
                      اندازه قلم متن عربی
                    </span>
                    <span className="font-semibold text-orange-600">{arabicFontSize} پیکسل</span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="34"
                    value={arabicFontSize}
                    onChange={(e) => setArabicFontSize(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <p
                    className="text-center font-arabic border py-1.5 px-2 rounded-lg truncate mt-1 bg-orange-500/5 dark:bg-zinc-800/40"
                    style={{ fontSize: `${arabicFontSize}px`, fontFamily: selectedFont === "Amiri" ? "Amiri" : "Vazirmatn" }}
                  >
                    بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1">
                      <Type className="w-3.5 h-3.5 text-slate-400" />
                      اندازه قلم ترجمه فارسی
                    </span>
                    <span className="font-semibold text-orange-600">{persianFontSize} پیکسل</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="24"
                    value={persianFontSize}
                    onChange={(e) => setPersianFontSize(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <p
                    className="text-center border py-1.5 px-2 rounded-lg truncate mt-1 bg-orange-500/5 dark:bg-zinc-800/40 font-sans"
                    style={{ fontSize: `${persianFontSize}px` }}
                  >
                    به نام خداوند بخشنده مهربان
                  </p>
                </div>
              </div>

              {/* Font Family selector & Display options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-slate-400">قلم متن عربی</span>
                  <div className="flex gap-2">
                    {["Amiri", "Vazirmatn", "sans-serif"].map((font) => (
                      <button
                        key={font}
                        onClick={() => setSelectedFont(font)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border ${
                          selectedFont === font
                            ? "bg-orange-500 text-white border-orange-400"
                            : darkMode
                            ? "bg-zinc-800 border-zinc-700 text-slate-300 hover:bg-zinc-700"
                            : "bg-orange-50 border-[#e5e5e5] text-orange-800 hover:bg-orange-100"
                        }`}
                      >
                        {font === "Amiri" ? "قلم امیری (نسخ)" : font === "Vazirmatn" ? "وزیرمتن" : "سیستم"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-medium text-slate-400">گزینه‌های نمایش و ترجمه</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 ${
                        showTranslation
                          ? "bg-orange-500 text-white border-orange-400"
                          : darkMode
                          ? "bg-zinc-800 border-zinc-700 text-slate-400"
                          : "bg-orange-50 border-[#e5e5e5] text-orange-800"
                      }`}
                    >
                      {showTranslation ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>نمایش ترجمه فارسی</span>
                    </button>

                    {showTranslation && (
                      <div className="flex bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-black/[0.05] dark:border-white/[0.05] flex-1 min-w-[200px]">
                        <button
                          onClick={() => setTranslationMode("sentence")}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                            translationMode === "sentence"
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          }`}
                        >
                          جمله به جمله
                        </button>
                        <button
                          onClick={() => setTranslationMode("block")}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                            translationMode === "block"
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          }`}
                        >
                          بند کامل
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 border-black/[0.05] dark:border-white/[0.05] flex flex-wrap justify-between items-center gap-3">
                <span className="text-xs text-slate-400">پیشرفت‌ها و تاریخچه مطالعه را می‌توانید بازنشانی کنید:</span>
                <button
                  onClick={handleResetProgress}
                  className="py-1.5 px-3 rounded-xl text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>پاک کردن پیشرفت‌ها</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Introduction Section Toggle & Card */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            darkMode
              ? "bg-zinc-900/60 border-zinc-800"
              : "bg-white border-[#eeeeee] shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowIntro(!showIntro)}
              className="flex items-center gap-2 hover:opacity-80 transition-all text-right"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm">مقدمه، فضیلت و داستان آموزش استغفار ۷۰ بندی</h3>
                <p className="text-[10px] text-slate-400">چرا باید این دعا را با آگاهی و گریه بخوانیم؟</p>
              </div>
            </button>
            <button
              onClick={() => setShowIntro(!showIntro)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold ${
                darkMode
                  ? "border-zinc-700 bg-zinc-800 text-slate-300"
                  : "border-[#e5e5e5] bg-orange-50 text-orange-700 hover:bg-orange-100/50"
              }`}
            >
              {showIntro ? "پنهان کردن" : "نمایش مقدمه"}
            </button>
          </div>

          <AnimatePresence>
            {showIntro && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-4 pt-4 border-t border-black/[0.05] dark:border-white/[0.05] space-y-4"
              >
                {introText.sections.map((sec, idx) => (
                  <div key={idx} className="space-y-2">
                    <h4 className="font-bold text-xs text-orange-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                      {sec.title}
                    </h4>
                    <p className={`text-xs leading-relaxed text-justify whitespace-pre-line ${
                      darkMode ? "text-slate-300" : "text-[#5d5d5d]"
                    }`}>
                      {sec.content}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Progress Statistics Banner */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            darkMode
              ? "bg-zinc-950/40 border-zinc-850"
              : "bg-orange-50/60 border-orange-150/80 shadow-[0_2px_4px_rgba(0,0,0,0.01)]"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                وضعیت پیشرفت قرائت
              </span>
              <h3 className="font-bold text-sm">
                قرائت شده: <span className="text-orange-600 dark:text-orange-400">{readBands.length}</span> از{" "}
                <span className="font-semibold">۷۰</span> بند ({getProgressPercentage()}٪)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {/* Progress Slider Display */}
              <div className="w-full sm:w-36 h-2 bg-orange-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-400 transition-all duration-500"
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400">
                {getProgressPercentage()}%
              </span>
            </div>
          </div>
        </div>

        {/* Search, View Mode, and Filters Row */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="جستجو در متن عربی یا معنی فارسی..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pr-9 pl-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  darkMode
                    ? "bg-zinc-900 border-zinc-800 text-slate-100 placeholder-slate-500"
                    : "bg-white border-[#eeeeee] text-slate-900 placeholder-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-400 hover:text-orange-500"
                >
                  پاک کردن
                </button>
              )}
            </div>

            {/* View Mode Toggle (List vs Focus Mode) */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-[#eeeeee] dark:border-zinc-800/80">
              <button
                onClick={() => setViewMode("list")}
                className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === "list"
                    ? "bg-orange-500 text-white shadow"
                    : "text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-slate-300"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>نمایش لیستی</span>
              </button>
              <button
                onClick={() => {
                  setViewMode("focus");
                  setCurrentFocusIndex(0);
                }}
                className={`flex-1 sm:flex-none py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  viewMode === "focus"
                    ? "bg-orange-500 text-white shadow"
                    : "text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-slate-300"
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>حالت تمرکز (تک‌بند)</span>
              </button>
            </div>
          </div>

          {/* Filter Pill Row */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: "all", label: "همه بندها" },
              { id: "bookmarked", label: "نشانه‌گذاری شده" },
              { id: "read", label: "خوانده شده" },
              { id: "unread", label: "خوانده نشده" }
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setFilterMode(pill.id as any)}
                className={`py-1.5 px-3.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  filterMode === pill.id
                    ? "bg-orange-500 text-white border-orange-400 shadow-sm"
                    : darkMode
                    ? "bg-zinc-800/80 border-zinc-700/50 text-slate-300 hover:bg-zinc-700"
                    : "bg-white border-[#e5e5e5] text-slate-600 hover:bg-orange-50"
                }`}
              >
                {pill.label}
                {pill.id === "bookmarked" && bookmarkedBands.length > 0 && (
                  <span className="mr-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-mono">
                    {bookmarkedBands.length}
                  </span>
                )}
                {pill.id === "read" && readBands.length > 0 && (
                  <span className="mr-1 px-1.5 py-0.5 rounded-full bg-orange-200 text-orange-950 text-[9px] font-mono">
                    {readBands.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        {filteredBands.length === 0 ? (
          <div
            className={`p-12 text-center rounded-2xl border ${
              darkMode ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-[#eeeeee]"
            }`}
          >
            <p className="text-slate-400 text-sm">هیچ بندی با فیلتر فعلی یافت نشد.</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs text-orange-500 font-bold hover:underline"
              >
                پاک کردن جستجو
              </button>
            )}
          </div>
        ) : viewMode === "list" ? (
          // --- VIEW MODE: LIST SCROLL ---
          <div className="space-y-6">
            {filteredBands.map((band) => {
              const isRead = readBands.includes(band.id);
              const isBookmarked = bookmarkedBands.includes(band.id);
              const tasbihCount = tasbihCounts[band.id] || 0;

              return (
                <div
                  key={band.id}
                  id={`band-${band.id}`}
                  className={`p-5 md:p-6 rounded-2xl border transition-all duration-300 relative ${
                    isRead
                      ? darkMode
                        ? "bg-zinc-900/80 border-orange-950/40 shadow-sm"
                        : "bg-orange-50/20 border-orange-100 shadow-sm"
                      : darkMode
                      ? "bg-zinc-900 border-zinc-800 shadow-sm hover:border-zinc-700"
                      : "bg-white border-[#eeeeee] shadow-sm hover:border-orange-200"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-4 border-b pb-3 border-black/[0.05] dark:border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center">
                        {band.id}
                      </span>
                      <h4 className="font-bold text-sm tracking-tight">بند {band.id}</h4>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Bookmark button */}
                      <button
                        onClick={() => toggleBookmark(band.id)}
                        className={`p-1.5 rounded-lg transition-all ${
                          isBookmarked ? "text-amber-500 scale-110" : "text-slate-400 hover:text-amber-500"
                        }`}
                        title={isBookmarked ? "حذف نشانه‌گذاری" : "نشانه‌گذاری بند"}
                      >
                        {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                      </button>

                      {/* Read button */}
                      <button
                        onClick={() => toggleRead(band.id)}
                        className={`p-1.5 rounded-lg transition-all ${
                          isRead ? "text-orange-500 scale-110" : "text-slate-400 hover:text-orange-500"
                        }`}
                        title={isRead ? "علامت به عنوان خوانده‌نشده" : "علامت به عنوان خوانده‌شده"}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Prayer Body */}
                  <div className="space-y-5">
                    {showTranslation && translationMode === "sentence" ? (
                      <div className="space-y-4">
                        {alignSentences(band.arabic, band.persian).map((pair, idx) => (
                          <div 
                            key={idx} 
                            className="pb-3 border-b last:border-0 border-dashed border-black/[0.06] dark:border-white/[0.06] space-y-2"
                          >
                            <p
                              className="leading-relaxed font-arabic font-normal tracking-wide text-justify select-all"
                              style={{
                                fontSize: `${arabicFontSize}px`,
                                fontFamily: selectedFont === "sans-serif" ? "sans-serif" : selectedFont === "Vazirmatn" ? "Vazirmatn" : "Amiri",
                                lineHeight: "1.8"
                              }}
                            >
                              {pair.ar}
                            </p>
                            <p
                              className={`text-justify ${
                                darkMode ? "text-slate-300" : "text-[#5d5d5d]"
                              }`}
                              style={{
                                fontSize: `${persianFontSize}px`,
                                lineHeight: "1.7"
                              }}
                            >
                              {pair.fa}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {/* Arabic Section */}
                        <div className="text-center relative">
                          <p
                            className={`leading-relaxed font-arabic font-normal tracking-wide text-justify select-all whitespace-pre-line`}
                            style={{
                              fontSize: `${arabicFontSize}px`,
                              fontFamily: selectedFont === "sans-serif" ? "sans-serif" : selectedFont === "Vazirmatn" ? "Vazirmatn" : "Amiri",
                              lineHeight: "1.8"
                            }}
                          >
                            {band.arabic}
                          </p>
                        </div>

                        {/* Persian Section */}
                        {showTranslation && (
                          <div
                            className={`pt-4 border-t border-black/[0.05] dark:border-white/[0.05] text-justify ${
                              darkMode ? "text-slate-300" : "text-[#5d5d5d]"
                            }`}
                            style={{
                              fontSize: `${persianFontSize}px`,
                              lineHeight: "1.7"
                            }}
                          >
                            <span className="text-orange-500 font-bold block text-xs mb-1.5">ترجمه فارسی:</span>
                            <p>{band.persian}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Tasbih/Counter Companion footer */}
                  <div className="mt-5 pt-3 border-t border-black/[0.05] dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Counter container */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">ذکربند:</span>
                      <button
                        onClick={() => incrementTasbih(band.id)}
                        className="py-1 px-2.5 rounded-lg bg-orange-600 text-white font-mono font-bold hover:bg-orange-500 transition-colors shadow-sm shadow-orange-500/10"
                      >
                        {tasbihCount} مرتبه
                      </button>
                      {tasbihCount > 0 && (
                        <button
                          onClick={() => resetTasbih(band.id)}
                          className="text-[10px] text-rose-400 hover:text-rose-500 hover:underline"
                        >
                          صفر کن
                        </button>
                      )}
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(band.arabic, "عربی")}
                        className="p-1 px-2 rounded-lg hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                        title="کپی متن عربی"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی عربی</span>
                      </button>
                      {showTranslation && (
                        <button
                          onClick={() => copyToClipboard(band.persian, "فارسی")}
                          className="p-1 px-2 rounded-lg hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                          title="کپی ترجمه فارسی"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>کپی ترجمه</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // --- VIEW MODE: FOCUS SLIDER (ONE BAND AT A TIME) ---
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs px-2">
              <span className="text-slate-400">
                بند <span className="font-bold text-orange-500">{currentFocusIndex + 1}</span> از{" "}
                <span className="font-semibold">{filteredBands.length}</span> (فیلتر شده)
              </span>
              <span className="text-slate-400">حالت مطالعه تمرکزی</span>
            </div>

            {/* Focus Card Slider Container */}
            <div className="relative">
              {/* Previous/Next quick arrows overlay on desktops */}
              <button
                onClick={() => setCurrentFocusIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentFocusIndex === 0}
                className="absolute top-1/2 -right-4 -translate-y-1/2 z-10 p-2 rounded-full shadow-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all hidden md:flex"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => setCurrentFocusIndex((prev) => Math.min(filteredBands.length - 1, prev + 1))}
                disabled={currentFocusIndex === filteredBands.length - 1}
                className="absolute top-1/2 -left-4 -translate-y-1/2 z-10 p-2 rounded-full shadow-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all hidden md:flex"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Focus Card Card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={filteredBands[currentFocusIndex]?.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className={`p-6 md:p-8 rounded-3xl border shadow-xl transition-all ${
                    readBands.includes(filteredBands[currentFocusIndex]?.id)
                      ? darkMode
                        ? "bg-zinc-900/80 border-orange-950/40"
                        : "bg-orange-50/20 border-orange-100"
                      : darkMode
                      ? "bg-zinc-900 border-zinc-800"
                      : "bg-white border-[#eeeeee]"
                  }`}
                >
                  {/* Card Title Bar */}
                  <div className="flex items-center justify-between mb-6 border-b pb-4 border-black/[0.05] dark:border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <span className="w-10 h-10 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center shadow-md shadow-orange-500/10">
                        {filteredBands[currentFocusIndex]?.id}
                      </span>
                      <div>
                        <h4 className="font-bold text-base tracking-tight">بند {filteredBands[currentFocusIndex]?.id}</h4>
                        <p className="text-[10px] text-slate-400">استغفار حضرت امیرالمؤمنین (ع)</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Bookmark Toggle */}
                      <button
                        onClick={() => toggleBookmark(filteredBands[currentFocusIndex]?.id)}
                        className={`p-2 rounded-xl transition-all ${
                          bookmarkedBands.includes(filteredBands[currentFocusIndex]?.id)
                            ? "text-amber-500 bg-amber-500/10 scale-105"
                            : "text-slate-400 hover:text-amber-500 hover:bg-slate-500/10"
                        }`}
                        title="نشانه‌گذاری بند"
                      >
                        <Bookmark className="w-4 h-4" />
                      </button>

                      {/* Read Toggle */}
                      <button
                        onClick={() => toggleRead(filteredBands[currentFocusIndex]?.id)}
                        className={`p-2 rounded-xl transition-all ${
                          readBands.includes(filteredBands[currentFocusIndex]?.id)
                            ? "text-orange-500 bg-orange-500/10 scale-105"
                            : "text-slate-400 hover:text-orange-500 hover:bg-slate-500/10"
                        }`}
                        title="علامت به عنوان خوانده شده"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Prayer Text */}
                  <div className="space-y-6">
                    {showTranslation && translationMode === "sentence" ? (
                      <div className="space-y-5">
                        {alignSentences(
                          filteredBands[currentFocusIndex]?.arabic || "",
                          filteredBands[currentFocusIndex]?.persian || ""
                        ).map((pair, idx) => (
                          <div 
                            key={idx} 
                            className="pb-4 border-b last:border-0 border-dashed border-black/[0.06] dark:border-white/[0.06] space-y-2.5"
                          >
                            <p
                              className="leading-relaxed font-arabic font-normal tracking-wide text-justify select-all"
                              style={{
                                fontSize: `${arabicFontSize + 2}px`,
                                fontFamily: selectedFont === "sans-serif" ? "sans-serif" : selectedFont === "Vazirmatn" ? "Vazirmatn" : "Amiri",
                                lineHeight: "1.9"
                              }}
                            >
                              {pair.ar}
                            </p>
                            <p
                              className={`text-justify ${
                                darkMode ? "text-slate-300" : "text-[#5d5d5d]"
                              }`}
                              style={{
                                fontSize: `${persianFontSize + 1}px`,
                                lineHeight: "1.8"
                              }}
                            >
                              {pair.fa}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {/* Arabic Verse text */}
                        <div className="text-center py-2">
                          <p
                            className="leading-relaxed font-arabic font-normal tracking-wide text-justify select-all whitespace-pre-line"
                            style={{
                              fontSize: `${arabicFontSize + 2}px`,
                              fontFamily: selectedFont === "sans-serif" ? "sans-serif" : selectedFont === "Vazirmatn" ? "Vazirmatn" : "Amiri",
                              lineHeight: "1.9"
                            }}
                          >
                            {filteredBands[currentFocusIndex]?.arabic}
                          </p>
                        </div>

                        {/* Persian Translation text */}
                        {showTranslation && (
                          <div
                            className={`pt-6 border-t border-black/[0.05] dark:border-white/[0.05] text-justify ${
                              darkMode ? "text-slate-300" : "text-[#5d5d5d]"
                            }`}
                            style={{
                              fontSize: `${persianFontSize + 1}px`,
                              lineHeight: "1.8"
                            }}
                          >
                            <span className="text-orange-500 font-bold block text-sm mb-2">ترجمه فارسی:</span>
                            <p>{filteredBands[currentFocusIndex]?.persian}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Counter section */}
                  <div className="mt-8 pt-4 border-t border-black/[0.05] dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">ذکر شمار بند:</span>
                      <button
                        onClick={() => incrementTasbih(filteredBands[currentFocusIndex]?.id)}
                        className="py-1.5 px-4 rounded-xl bg-orange-600 text-white font-mono font-bold text-xs hover:bg-orange-500 transition-colors shadow-md shadow-orange-500/10"
                      >
                        {tasbihCounts[filteredBands[currentFocusIndex]?.id] || 0} مرتبه قرائت
                      </button>
                      {(tasbihCounts[filteredBands[currentFocusIndex]?.id] || 0) > 0 && (
                        <button
                          onClick={() => resetTasbih(filteredBands[currentFocusIndex]?.id)}
                          className="text-xs text-rose-400 hover:text-rose-500 font-semibold hover:underline"
                        >
                          صفر کردن شمارش
                        </button>
                      )}
                    </div>

                    {/* Clipboard utility controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(filteredBands[currentFocusIndex]?.arabic, "عربی")}
                        className="p-1.5 rounded-xl hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 flex items-center gap-1.5 text-xs transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی عربی</span>
                      </button>
                      {showTranslation && (
                        <button
                          onClick={() => copyToClipboard(filteredBands[currentFocusIndex]?.persian, "فارسی")}
                          className="p-1.5 rounded-xl hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 flex items-center gap-1.5 text-xs transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>کپی ترجمه</span>
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Mobile Footer Carousel Control buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setCurrentFocusIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentFocusIndex === 0}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  darkMode ? "bg-zinc-800 border-zinc-700 text-slate-300 hover:bg-zinc-700" : "bg-white border-[#eeeeee] text-slate-700 hover:bg-orange-50"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <ChevronRight className="w-4 h-4" />
                <span>بند قبلی</span>
              </button>

              <span className="text-xs font-bold font-mono">
                {currentFocusIndex + 1} / {filteredBands.length}
              </span>

              <button
                onClick={() => setCurrentFocusIndex((prev) => Math.min(filteredBands.length - 1, prev + 1))}
                disabled={currentFocusIndex === filteredBands.length - 1}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  darkMode ? "bg-zinc-800 border-zinc-700 text-slate-300 hover:bg-zinc-700" : "bg-white border-[#eeeeee] text-slate-700 hover:bg-orange-50"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span>بند بعدی</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Concluding Section block */}
        <div
          className={`p-6 rounded-3xl border transition-all ${
            darkMode
              ? "bg-zinc-900 border-orange-950/40 shadow-lg text-slate-100"
              : "bg-orange-50/40 border-orange-100 shadow-sm text-slate-900"
          }`}
        >
          <div className="flex items-center gap-2 mb-4 border-b pb-3 border-black/[0.05] dark:border-white/[0.05]">
            <div className="p-2 rounded-xl bg-orange-500 text-white">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm">دعای پایانی استغفار ۷۰ بندی</h3>
              <p className="text-[10px] text-slate-400">پس از اتمام قرائت ۷۰ بند این بخش را تلاوت کنید</p>
            </div>
          </div>

          <div className="space-y-4">
            <p
              className="text-center font-arabic leading-relaxed tracking-wide select-all whitespace-pre-line"
              style={{
                fontSize: `${arabicFontSize + 1}px`,
                fontFamily: selectedFont === "sans-serif" ? "sans-serif" : selectedFont === "Vazirmatn" ? "Vazirmatn" : "Amiri",
                lineHeight: "1.8"
              }}
            >
              {concludingText.arabic}
            </p>

            {showTranslation && (
              <p
                className={`text-justify leading-relaxed pt-3 border-t border-black/[0.05] dark:border-white/[0.05] ${
                  darkMode ? "text-slate-300" : "text-[#5d5d5d]"
                }`}
                style={{
                  fontSize: `${persianFontSize}px`
                }}
              >
                {concludingText.persian}
              </p>
            )}
          </div>
        </div>

        {/* Help & Instruction Manual Info Footer */}
        <div className="py-8 text-center space-y-4 border-t border-slate-700/10 dark:border-slate-200/5">
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            این برنامه به طور کامل آفلاین بوده و داده‌های مطالعه شما در حافظه مرورگر تلفن همراه‌تان ذخیره می‌شود تا در قرائت‌های بعدی بتوانید ادامه دهید.
          </p>
          <div className="flex justify-center items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              التماس دعا
            </span>
            <span>•</span>
            <span className="font-mono">استغفار علی بن ابی‌طالب (ع)</span>
          </div>
        </div>
      </main>
    </div>
  );
}

