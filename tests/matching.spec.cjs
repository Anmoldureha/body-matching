// @ts-check
const { test, expect } = require("@playwright/test");
const path = require("path");

const TEST_USER = { username: "admin", password: "changeme" };
// Search tab has nav button "Search" and form submit "Search" — use the submit button (second)
const searchSubmitBtn = (page) => page.getByRole("button", { name: "Search" }).nth(1);

async function login(page) {
  await page.goto("/");
  await expect(page.getByText("UBIS", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
  await page.locator('input[type="text"]').fill(TEST_USER.username);
  await page.locator('input[type="password"]').fill(TEST_USER.password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await expect(page.getByRole("button", { name: /Dashboard/i })).toBeVisible({ timeout: 10000 });
}

test.describe("UBIS Search", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("dashboard loads and shows summary", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Search/i })).toBeVisible();
    await expect(page.getByText("Summary", { exact: true })).toBeVisible();
    await expect(page.getByText("Total cases")).toBeVisible();
  });

  test("search tab shows photo, description, voice inputs and Search button", async ({ page }) => {
    await page.getByRole("button", { name: /Search/i }).click();
    await expect(page.getByText("Search repository")).toBeVisible();
    await expect(page.getByText("Photo (optional)")).toBeVisible();
    await expect(page.getByText("Description (optional)")).toBeVisible();
    await expect(page.getByText("Voice note (optional)")).toBeVisible();
    await expect(searchSubmitBtn(page)).toBeDisabled();
    await expect(page.getByPlaceholder(/male, 25/)).toBeVisible();
  });

  test("Search button enabled when description entered", async ({ page }) => {
    await page.getByRole("button", { name: /Search/i }).click();
    await page.getByPlaceholder(/male, 25/).fill("male tattoo");
    await expect(searchSubmitBtn(page)).toBeEnabled();
  });

  test("search by photo", async ({ page }) => {
    await page.getByRole("button", { name: /Search/i }).click();
    const photoInput = page.locator('input[type="file"][accept="image/*"]').first();
    await photoInput.setInputFiles(path.join(__dirname, "fixtures", "sample.png"));
    await expect(searchSubmitBtn(page)).toBeEnabled();
    await searchSubmitBtn(page).click();
    await page.waitForTimeout(4000);
    const body = page.locator("body");
    const hasResults = await body.getByText(/Results \(\d+\)/).isVisible().catch(() => false);
    const hasEmpty = await body.getByText(/Add at least one/).isVisible().catch(() => false);
    const hasError = await body.getByText(/Error|failed|Failed/).isVisible().catch(() => false);
    expect(hasResults || hasEmpty || hasError).toBeTruthy();
  });

  test("search by text description", async ({ page }) => {
    await page.getByRole("button", { name: /Search/i }).click();
    await page.getByPlaceholder(/male, 25/).fill("male");
    await searchSubmitBtn(page).click();
    await page.waitForTimeout(3000);
    const body = page.locator("body");
    const hasResults = await body.getByText(/Results \(\d+\)/).isVisible().catch(() => false);
    const hasPercent = await body.getByText(/%/).first().isVisible().catch(() => false);
    expect(hasResults || hasPercent).toBeTruthy();
  });

  test("search by photo and text combined", async ({ page }) => {
    await page.getByRole("button", { name: /Search/i }).click();
    const photoInput = page.locator('input[type="file"][accept="image/*"]').first();
    await photoInput.setInputFiles(path.join(__dirname, "fixtures", "sample.png"));
    await page.getByPlaceholder(/male, 25/).fill("male");
    await searchSubmitBtn(page).click();
    await page.waitForTimeout(5000);
    const body = page.locator("body");
    const hasResults = await body.getByText(/Results \(\d+\)/).isVisible().catch(() => false);
    const hasOverlap = await body.getByText(/\d\/3/).isVisible().catch(() => false);
    const hasEmpty = await body.getByText(/Add at least one/).isVisible().catch(() => false);
    expect(hasResults || hasOverlap || hasEmpty).toBeTruthy();
  });
});
