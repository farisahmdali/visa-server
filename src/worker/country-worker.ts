// countryWorker.ts
import { parentPort, workerData } from "worker_threads";

(async () => {
  try {
    const { country, email, password, env } = workerData;
    process.env = { ...process.env, ...env };
    // Dynamically load the country class
    const CountryModule = await import(`../country/${country}`);
    const CountryClass = CountryModule.default;

    // Create instance
    const instance = new CountryClass("C:/Program Files/Google/Chrome/Application/chrome.exe");

    // Run init
    await instance.init(email, password);

    // Tell parent we’re ready
    parentPort?.postMessage({ event: "initialized", country });

    // Listen for OTP messages from parent
    parentPort?.on("message", async (msg) => {
      if (msg.event === "otp") {
        try {
          await instance.fillOTP(msg.otp);
          parentPort?.postMessage({ event: "otpApplied", country, otp: msg.otp });
        } catch (err: any) {
          parentPort?.postMessage({ event: "otpError", country, error: err.message || err });
        }
      }
    });

  } catch (error: any) {
    parentPort?.postMessage({ event: "error", country: workerData.country, error: error.message || error });
  }
})();
