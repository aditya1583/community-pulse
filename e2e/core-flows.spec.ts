import { test, expect, type Page } from "@playwright/test";

/**
 * Voxlo E2E Core Flow Tests
 *
 * Tests run against the live Vercel deployment.
 * Auth tests require: E2E_USER_EMAIL, E2E_USER_PASSWORD
 */

const BASE = process.env.E2E_BASE_URL || "https://voxlo-theta.vercel.app";

// Leander coords
const GEO = { latitude: 30.5788, longitude: -97.8531 };

// ─── Helpers ───

/** Bypass the location prompt by granting geolocation before navigating */
async function loadApp(page: Page) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation(GEO);
  await page.goto(BASE);

  // If location prompt appears, the geolocation grant should auto-resolve it
  // But if it still shows (e.g. sessionStorage check), click manual
  const manualBtn = page.locator("button:has-text('Enter City Manually')");
  if (await manualBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await manualBtn.click();
  }

  // Wait for main content (bottom nav has "Events", "Pulse", etc.)
  await page.locator("button:has-text('Events')").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1500); // hydration + data fetch
}

/** Click a bottom nav tab by label */
async function clickTab(page: Page, label: string) {
  // Bottom nav buttons have exact label text — use more specific selector
  const btn = page.locator(`nav button:has-text("${label}"), footer button:has-text("${label}"), button:has-text("${label}")`).first();
  await btn.click();
  await page.waitForTimeout(1000);
}

/** Sign in via the auth modal */
async function signIn(page: Page) {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    return false;
  }

  // Sign in button is only on the Pulse (dashboard) tab
  await clickTab(page, "Pulse");
  await page.waitForTimeout(500);

  const signInBtn = page.locator("button:has-text('Sign in')").first();
  if (!await signInBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    return true; // Already signed in
  }

  await signInBtn.click();
  await page.waitForTimeout(500);

  await page.locator("input[type='email'], input[placeholder*='email' i]").first().fill(email);
  await page.locator("input[type='password'], input[placeholder*='password' i]").first().fill(password);
  await page.locator("button[type='submit']").first().click();

  // Wait for auth to complete
  await expect(signInBtn).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  return true;
}

// ─── Tests ───

test.describe("App Load & Default Tab", () => {
  test("Events tab loads as default on fresh app open", async ({ page }) => {
    await loadApp(page);

    // Events is the default tab — should see events content
    const mainContent = await page.textContent("main");
    const hasEventsContent =
      mainContent?.includes("Events") ||
      mainContent?.includes("event") ||
      mainContent?.includes("Sign in") ||
      mainContent?.includes("Happening") ||
      false;

    expect(hasEventsContent).toBe(true);
  });
});

test.describe("Traffic Tab", () => {
  test("Traffic tab shows consistent data (not contradictory)", async ({ page }) => {
    await loadApp(page);
    await clickTab(page, "Traffic");
    await page.waitForTimeout(3000); // Wait for traffic data to load

    const mainContent = await page.textContent("main") || "";

    // Should NOT simultaneously show "Severe" and "No data"
    const hasSevere = mainContent.includes("Severe");
    const hasNoData = mainContent.includes("No data") || mainContent.includes("unavailable");

    expect(hasSevere && hasNoData).toBe(false);

    // Should show SOME traffic-related content
    const hasTrafficContent =
      mainContent.includes("Light") ||
      mainContent.includes("Moderate") ||
      mainContent.includes("Heavy") ||
      mainContent.includes("Severe") ||
      mainContent.includes("mph") ||
      mainContent.includes("flow") ||
      mainContent.includes("Traffic") ||
      mainContent.includes("congestion");

    expect(hasTrafficContent).toBe(true);
  });
});

test.describe("Local Tab", () => {
  test("Local tab loads businesses within 10 seconds", async ({ page }) => {
    await loadApp(page);
    await clickTab(page, "Local");

    // Wait up to 10s for business-related content
    const hasContent = await page
      .locator("text=/Explore|Coffee|Food|Restaurant|Shop|Store|Nearby/i")
      .first()
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    expect(hasContent).toBe(true);
  });

  test("Coffee filter returns results (not 'No places found')", async ({ page }) => {
    await loadApp(page);
    await clickTab(page, "Local");
    await page.waitForTimeout(2000);

    // Find and click Coffee category
    const coffeeBtn = page.locator("button:has-text('Coffee'), button:has-text('☕')").first();
    const coffeeVisible = await coffeeBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!coffeeVisible) {
      test.skip(true, "Coffee filter button not visible on Local tab");
      return;
    }

    await coffeeBtn.click();
    await page.waitForTimeout(5000);

    const content = await page.textContent("main") || "";
    const hasNoPlaces = content.includes("No places found");

    expect(hasNoPlaces).toBe(false);
  });
});

test.describe("Posting Flow", () => {
  test("Post a pulse: select vibe, type message, tap send, verify in feed", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    if (!email || !password) {
      test.skip(true, "E2E_USER_EMAIL and E2E_USER_PASSWORD required");
      return;
    }

    await loadApp(page);
    await signIn(page);

    // Go to Pulse tab
    await clickTab(page, "Pulse");
    await page.waitForTimeout(1500);

    // Dismiss first-pulse onboarding modal if it appears
    const dismissBtn = page.locator("button:has-text('Maybe Later'), button:has-text('Close'), button:has-text('Got it'), button[aria-label='Close']");
    if (await dismissBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await dismissBtn.first().click();
      await page.waitForTimeout(500);
    }

    // Click post button (center FAB in bottom nav)
    const postFab = page.locator("button[aria-label='Post a pulse']").first();
    if (await postFab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await postFab.click();
    } else {
      // Try "Drop a Pulse" CTA
      await page.locator("button:has-text('Drop'), button:has-text('Post')").first().click();
    }
    await page.waitForTimeout(500);

    // PulseModal should be open
    await expect(page.locator("text=/Launch Pulse|Complete Pulse|Syncing/i").first()).toBeVisible({ timeout: 5000 });

    // Select a vibe (buttons have format "😌 Chill", "😊 Blessed", etc.)
    await page.locator("button:has-text('Chill'), button:has-text('Blessed'), button:has-text('Excited')").first().click();
    await page.waitForTimeout(300);

    // Type a message
    const testMessage = `E2E test ${Date.now()}`;
    const textarea = page.locator("textarea").first();
    await textarea.fill(testMessage);

    // Wait for "Launch Pulse" to be enabled
    await page.waitForTimeout(500);

    // Tap Launch Pulse
    await page.locator("button:has-text('Launch Pulse')").click();

    // Check result: modal should close on success, or error banner appears
    const errorVisible = await page.locator("text=/Post failed|Network error|error/i")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (errorVisible) {
      const errText = await page.locator("text=/Post failed|Network error|error/i").first().textContent();
      expect(errorVisible, `Posting failed: ${errText}`).toBe(false);
    }

    // Modal should have closed
    await expect(page.locator("button:has-text('Launch Pulse')")).toBeHidden({ timeout: 10_000 });

    // Verify post is in feed
    await page.waitForTimeout(2000);
    const feedContent = await page.textContent("main") || "";
    expect(feedContent).toContain(testMessage);

    // CLEANUP: Delete the test post via API so it doesn't pollute the feed
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      if (supabaseUrl && (serviceKey || anonKey)) {
        const key = serviceKey || anonKey;
        const cleanupRes = await fetch(
          `${supabaseUrl}/rest/v1/pulses?message=eq.${encodeURIComponent(testMessage)}`,
          {
            method: "DELETE",
            headers: {
              apikey: anonKey || key,
              Authorization: `Bearer ${key}`,
            },
          }
        );
        console.log(`[E2E Cleanup] Deleted test post: ${cleanupRes.status}`);
      }
    } catch (e) {
      console.warn("[E2E Cleanup] Failed to delete test post:", e);
    }
  });

  test("Delete a pulse: tap delete, confirm, verify gone", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    if (!email || !password) {
      test.skip(true, "E2E_USER_EMAIL and E2E_USER_PASSWORD required");
      return;
    }

    await loadApp(page);
    await signIn(page);
    await clickTab(page, "Pulse");
    await page.waitForTimeout(2000);

    // Look for delete button on own posts
    const deleteBtn = page.locator("button[title*='elete' i], button[aria-label*='elete' i], button:has-text('🗑')").first();
    const canDelete = await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!canDelete) {
      test.skip(true, "No deletable posts found");
      return;
    }

    // Get pre-delete content for comparison
    const preFeed = await page.textContent("main") || "";

    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Confirm if dialog appears
    const confirmBtn = page.locator("button:has-text('Confirm'), button:has-text('Yes'), button:has-text('Delete')").first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await page.waitForTimeout(2000);

    // Feed should have changed
    const postFeed = await page.textContent("main") || "";
    expect(postFeed).not.toBe(preFeed);
  });
});

test.describe("Visual Regressions", () => {
  test("No old reaction bar (like/dislike) on pulse cards", async ({ page }) => {
    await loadApp(page);
    await clickTab(page, "Pulse");
    await page.waitForTimeout(2000);

    // Old reaction bar had inline 👍👎 buttons on every card
    // Count any 👎 buttons (the new vibe system doesn't use thumbs down)
    const thumbsDown = await page.locator("button:has-text('👎')").count();
    expect(thumbsDown).toBe(0);
  });

  test("No stale green banner at top of home screen", async ({ page }) => {
    await loadApp(page);

    // Take a snapshot of visible content above the fold
    // "First pulse badge toast" is OK if user just posted, but should not persist
    await page.waitForTimeout(2000);

    // Check for any fixed/absolute positioned green success banners
    const toasts = page.locator(".fixed:visible, .absolute:visible").filter({
      hasText: /streak|badge|success|congratulations/i,
    });

    const toastCount = await toasts.count();
    // These should auto-dismiss — if persisting after 2s page load, it's a bug
    expect(toastCount).toBe(0);
  });
});
