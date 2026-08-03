import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

vi.mock("@elevenlabs/react", () => ({
  useConversation: () => ({
    getInputVolume: () => 0,
    getOutputVolume: () => 0,
    startSession: vi.fn(),
    endSession: vi.fn()
  })
}));

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the required Russian controls", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /Создать AI-агента/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Позвонить/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Настройки/i })).toBeInTheDocument();
    expect(screen.getByText("Технический лог")).toBeInTheDocument();
    expect(screen.getByText("Таймер звонка")).toBeInTheDocument();
  });

  it("stores mock API key in sessionStorage and mock agent id in localStorage", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Настройки/i }));
    await user.type(screen.getByLabelText("API-ключ ElevenLabs"), "mock-key");
    await user.click(screen.getByRole("button", { name: /Проверить ключ/i }));
    expect(await screen.findByText(/Mock-ключ принят/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Сохранить$/i }));
    await user.click(screen.getByRole("button", { name: /Создать AI-агента/i }));
    expect(await screen.findAllByText(/Агент создан/i)).not.toHaveLength(0);

    expect(sessionStorage.getItem("voicehire.elevenlabs.apiKey")).toBe("mock-key");
    expect(localStorage.getItem("voicehire.elevenlabs.agentId")).toMatch(/^agent_mock_/);
  });

  it("selects a real voice id after successful live key validation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/validate-key")) {
          return Response.json({
            valid: true,
            message: "Ключ действителен",
            userEndpointAvailable: false,
            warning: "Проверка профиля не выполняется для ограниченного API-ключа.",
            voices: [
              { id: "real_voice_1", name: "Мария", category: "professional" },
              { id: "real_voice_2", name: "Антон", category: "professional" }
            ]
          });
        }
        return Response.json({}, { status: 404 });
      })
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Настройки/i }));
    await user.type(screen.getByLabelText("API-ключ ElevenLabs"), "live-key");
    await user.click(screen.getByRole("button", { name: /Проверить ключ/i }));

    const voiceSelect = screen.getByLabelText("Голос") as HTMLSelectElement;
    await waitFor(() => expect(voiceSelect.value).toBe("real_voice_1"));
    expect(screen.getByText("Мария (real_voice_1)")).toBeInTheDocument();
    expect(localStorage.getItem("voicehire.voiceId")).toBe("real_voice_1");
  });

  it("does not create a live agent with a mock voice id", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        agentId: "agent_should_not_exist",
        created: true,
        updated: false,
        configHash: "hash"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Настройки/i }));
    await user.type(screen.getByLabelText("API-ключ ElevenLabs"), "live-key");
    await user.click(screen.getByRole("button", { name: /^Сохранить$/i }));
    await user.click(screen.getByRole("button", { name: /Создать AI-агента/i }));

    expect(await screen.findByText("Выберите настоящий голос ElevenLabs перед созданием агента.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fills lead form after mock conversation ends without submitting it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Настройки/i }));
    await user.type(screen.getByLabelText("API-ключ ElevenLabs"), "mock-key");
    await user.click(screen.getByRole("button", { name: /Проверить ключ/i }));
    await screen.findByText(/Mock-ключ принят/i);
    await user.click(screen.getByRole("button", { name: /^Сохранить$/i }));
    await user.click(screen.getByRole("button", { name: /Создать AI-агента/i }));
    await screen.findAllByText(/Агент создан/i);
    await user.click(screen.getByRole("button", { name: "Позвонить" }));
    await screen.findByText(/Эдуард/, {}, { timeout: 3_000 });
    await user.click(screen.getByRole("button", { name: "Завершить разговор" }));

    await waitFor(() => expect(screen.getByLabelText("Имя")).toHaveValue("Эдуард"));
    expect(screen.getByLabelText("Телефон или email")).toHaveValue("+70000000000");
    expect(screen.getByLabelText("Комментарий")).toHaveValue("Интересуется стоимостью VoiceHire AI и согласен на связь со специалистом.");
    expect(screen.queryByText("Заявка сохранена в демонстрационном режиме.")).not.toBeInTheDocument();
    expect(screen.getByText("lead_extraction_started")).toBeInTheDocument();
    expect(screen.getByText("lead_extracted")).toBeInTheDocument();
  });
});
