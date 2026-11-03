import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const FIXTURE = fileURLToPath(new URL("./fixtures/smile.jpg", import.meta.url));
const patient = `patient-${Date.now()}@example.com`;
const CLINIC = "Smile Studio (Pune)";

async function signIn(page: Page, email: string, role: "Patient" | "Dentist") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  if (role === "Dentist") {
    await page.getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: "Dentist" }).click();
    await page.getByRole("combobox", { name: "Clinic" }).click();
    await page.getByRole("option", { name: CLINIC }).click();
  }
  await page.getByRole("button", { name: "Continue" }).click();
  // Wait for the redirect; navigating away earlier would drop the token before it's stored.
  await expect(page).toHaveURL(role === "Dentist" ? /\/clinic/ : /\/app/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
}

test("patient screening → AI plan → dentist approval", async ({ page }) => {
  await signIn(page, patient, "Patient");
  await expect(page.getByRole("heading", { name: "My scans" })).toBeVisible();

  await page.getByRole("link", { name: "New scan" }).first().click();
  await page.getByTestId("file-input").setInputFiles(FIXTURE);
  await page.getByRole("combobox", { name: "Clinic" }).click();
  await page.getByRole("option", { name: CLINIC }).click();
  await page.getByRole("button", { name: "Screen photo" }).click();

  await expect(page).toHaveURL(/\/app\/scans\//);
  await expect(page.getByText("What the screening noticed")).toBeVisible();
  await expect(page.getByText("Discoloration")).toBeVisible();
  await expect(page.getByText(/not a diagnosis/).first()).toBeVisible();

  await page.getByRole("button", { name: "Draft my plan" }).click();
  await expect(page.getByText("Awaiting dentist review")).toBeVisible();
  await expect(page.getByText("In-office whitening").first()).toBeVisible();
  // The validator inserted an exam first and kept whitening before bonding.
  const steps = page.locator("ol > li p.font-semibold");
  await expect(steps.first()).toContainText("examination");

  await page.getByRole("button", { name: "How long does whitening last?" }).click();
  await expect(page.getByText(/six months to three years/)).toBeVisible();
  const scanUrl = page.url();
  const scanId = scanUrl.split("/").pop()!;
  await signOut(page);

  await signIn(page, `dentist-${Date.now()}@example.com`, "Dentist");
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await page.getByTestId(`queue-${scanId}`).click();
  await page.getByLabel("Review notes").fill("Let's start with a cleaning next week.");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Plan approved and shared with the patient")).toBeVisible();
  await expect(page.getByTestId(`queue-${scanId}`)).toHaveCount(0);
  await page.getByRole("link", { name: "AI metrics" }).click();
  await expect(page.getByText("vision.findings")).toBeVisible();
  await signOut(page);

  await signIn(page, patient, "Patient");
  await page.goto(scanUrl);
  await expect(page.getByText("Approved by your dentist")).toBeVisible();
  await expect(page.getByText("Let's start with a cleaning next week.")).toBeVisible();
});
