// RyftCoin - Test Suite
// TypeScript kaynak dosyası

interface TestResult {
  ok: boolean;
  message: string;
}

interface UserData {
  username: string;
  coins: number;
  lastSeen: string;
}

// Timestamp
const timestampEl = document.getElementById("timestamp") as HTMLElement;
timestampEl.textContent = `⏱ ${new Date().toLocaleString("tr-TR")}`;

// Frontend Status
const frontendStatus = document.getElementById("frontend-status") as HTMLElement;
frontendStatus.textContent = "✅ TypeScript aktif";
frontendStatus.className = "result ok";

// --- Frontend Test ---
const testBtn = document.getElementById("test-btn") as HTMLButtonElement;
const frontendResult = document.getElementById("frontend-result") as HTMLElement;

testBtn.addEventListener("click", (): void => {
  const result: TestResult = runFrontendTest();
  frontendResult.textContent = result.message;
  frontendResult.className = result.ok ? "result ok" : "result err";
});

function runFrontendTest(): TestResult {
  try {
    const arr: number[] = [1, 2, 3, 4, 5];
    const sum: number = arr.reduce((a, b) => a + b, 0);
    const now: Date = new Date();
    return {
      ok: true,
      message: `✅ Toplam: ${sum} | Saat: ${now.toLocaleTimeString("tr-TR")}`
    };
  } catch (e) {
    return { ok: false, message: "❌ Hata oluştu" };
  }
}

// --- Backend Test ---
const apiBtn = document.getElementById("api-btn") as HTMLButtonElement;
const apiResult = document.getElementById("api-result") as HTMLElement;

apiBtn.addEventListener("click", async (): Promise<void> => {
  apiResult.textContent = "⏳ Bağlanıyor...";
  apiResult.className = "result loading";

  try {
    const res = await fetch("/api/ping");
    if (res.ok) {
      const data = await res.json() as { message: string };
      apiResult.textContent = `✅ ${data.message}`;
      apiResult.className = "result ok";
    } else {
      throw new Error("HTTP " + res.status);
    }
  } catch (e) {
    // GitHub Pages'de backend olmaz, bu beklenen
    apiResult.textContent = "⚠️ Backend bulunamadı (GitHub Pages'de normal)";
    apiResult.className = "result err";
  }
});

// --- Storage Test ---
const storageBtn = document.getElementById("storage-btn") as HTMLButtonElement;
const storageResult = document.getElementById("storage-result") as HTMLElement;

storageBtn.addEventListener("click", (): void => {
  const result: TestResult = runStorageTest();
  storageResult.textContent = result.message;
  storageResult.className = result.ok ? "result ok" : "result err";
});

function runStorageTest(): TestResult {
  try {
    const testData: UserData = {
      username: "test_user",
      coins: 100,
      lastSeen: new Date().toISOString()
    };
    localStorage.setItem("ryft_test", JSON.stringify(testData));
    const raw = localStorage.getItem("ryft_test");
    if (!raw) throw new Error("Veri bulunamadı");
    const parsed = JSON.parse(raw) as UserData;
    return {
      ok: true,
      message: `✅ ${parsed.username} | ${parsed.coins} coin kaydedildi`
    };
  } catch (e) {
    return { ok: false, message: "❌ Storage hatası" };
  }
}
