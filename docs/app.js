"use strict";
// RyftCoin - Test Suite
// TypeScript kaynak dosyası
// Timestamp
const timestampEl = document.getElementById("timestamp");
timestampEl.textContent = `⏱ ${new Date().toLocaleString("tr-TR")}`;
// Frontend Status
const frontendStatus = document.getElementById("frontend-status");
frontendStatus.textContent = "✅ TypeScript aktif";
frontendStatus.className = "result ok";
// --- Frontend Test ---
const testBtn = document.getElementById("test-btn");
const frontendResult = document.getElementById("frontend-result");
testBtn.addEventListener("click", () => {
    const result = runFrontendTest();
    frontendResult.textContent = result.message;
    frontendResult.className = result.ok ? "result ok" : "result err";
});
function runFrontendTest() {
    try {
        const arr = [1, 2, 3, 4, 5];
        const sum = arr.reduce((a, b) => a + b, 0);
        const now = new Date();
        return {
            ok: true,
            message: `✅ Toplam: ${sum} | Saat: ${now.toLocaleTimeString("tr-TR")}`
        };
    }
    catch (e) {
        return { ok: false, message: "❌ Hata oluştu" };
    }
}
// --- Backend Test ---
const apiBtn = document.getElementById("api-btn");
const apiResult = document.getElementById("api-result");
apiBtn.addEventListener("click", async () => {
    apiResult.textContent = "⏳ Bağlanıyor...";
    apiResult.className = "result loading";
    try {
        const res = await fetch("/api/ping");
        if (res.ok) {
            const data = await res.json();
            apiResult.textContent = `✅ ${data.message}`;
            apiResult.className = "result ok";
        }
        else {
            throw new Error("HTTP " + res.status);
        }
    }
    catch (e) {
        // GitHub Pages'de backend olmaz, bu beklenen
        apiResult.textContent = "⚠️ Backend bulunamadı (GitHub Pages'de normal)";
        apiResult.className = "result err";
    }
});
// --- Storage Test ---
const storageBtn = document.getElementById("storage-btn");
const storageResult = document.getElementById("storage-result");
storageBtn.addEventListener("click", () => {
    const result = runStorageTest();
    storageResult.textContent = result.message;
    storageResult.className = result.ok ? "result ok" : "result err";
});
function runStorageTest() {
    try {
        const testData = {
            username: "test_user",
            coins: 100,
            lastSeen: new Date().toISOString()
        };
        localStorage.setItem("ryft_test", JSON.stringify(testData));
        const raw = localStorage.getItem("ryft_test");
        if (!raw)
            throw new Error("Veri bulunamadı");
        const parsed = JSON.parse(raw);
        return {
            ok: true,
            message: `✅ ${parsed.username} | ${parsed.coins} coin kaydedildi`
        };
    }
    catch (e) {
        return { ok: false, message: "❌ Storage hatası" };
    }
}
