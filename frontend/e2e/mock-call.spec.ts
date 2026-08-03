import { expect, test } from "@playwright/test";

test("mock call lifecycle", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByLabel("API-ключ ElevenLabs").fill("mock-key");
  await page.getByRole("button", { name: "Проверить ключ" }).click();
  await expect(page.getByText("Mock-ключ принят")).toBeVisible();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.getByRole("button", { name: /Создать AI-агента|Обновить AI-агента/ }).click();
  await expect(page.getByText("Агент создан").first()).toBeVisible();
  await page.getByRole("button", { name: "Позвонить" }).click();
  await expect(page.getByText("Mock realtime-сессия активна")).toBeVisible();
  await expect(page.getByText("Какая у вас роль в найме?")).toBeVisible();
  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.getByRole("button", { name: "Включить" })).toBeVisible();
  await page.getByRole("button", { name: "Завершить разговор" }).click();
  await expect(page.getByText("Разговор завершён, Agent ID сохранён")).toBeVisible();
  await expect(page.getByRole("button", { name: "Позвонить" })).toBeEnabled();
});
