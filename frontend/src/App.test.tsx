import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { detectInitialLocale } from "./i18n.js";

vi.mock("@elevenlabs/react", () => ({
  useConversation: () => ({
    getInputVolume: () => 0,
    getOutputVolume: () => 0,
    startSession: vi.fn(),
    endSession: vi.fn()
  })
}));

const setLocale = (locale: "ru" | "en") => localStorage.setItem("voicehire.locale", locale);

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses English by default even for a Russian browser locale", () => {
    expect(detectInitialLocale(null, "ru-RU")).toBe("en");
    expect(detectInitialLocale(null, "en-US")).toBe("en");
    expect(detectInitialLocale("ru", "en-US")).toBe("ru");

    render(<App />);

    expect(screen.getByRole("button", { name: /Create AI agent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Call$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByText("Technical log")).toBeInTheDocument();
    expect(screen.getByText("Call timer")).toBeInTheDocument();
    expect(screen.queryByText("Технический лог")).not.toBeInTheDocument();
  });

  it("opens the user guide from the header in the selected language", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Open user guide" }));
    expect(screen.getByRole("dialog", { name: "How to use VoiceHire Sales AI" })).toBeInTheDocument();
    expect(screen.getByText("The API key is kept only for the current browser session. Keys and tokens never appear in the technical log.")).toBeInTheDocument();
  });

  it("renders the required Russian controls when RU is selected", () => {
    setLocale("ru");
    render(<App />);

    expect(screen.getByRole("button", { name: /Создать AI-агента/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Позвонить/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Настройки/i })).toBeInTheDocument();
    expect(screen.getByText("Технический лог")).toBeInTheDocument();
    expect(screen.getByText("Таймер звонка")).toBeInTheDocument();
  });

  it("switches locale, persists it, and sends the matching English prompt", async () => {
    setLocale("ru");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/validate-key")) {
        return Response.json({
          valid: true,
          message: "Ключ действителен",
          userEndpointAvailable: false,
          voices: [{ id: "real_voice_1", name: "Rachel", category: "professional" }]
        });
      }
      if (url.endsWith("/agents/ensure")) {
        const body = JSON.parse(String(init?.body)) as { settings: { language: string; systemPrompt: string } };
        expect(body.settings.language).toBe("en");
        expect(body.settings.systemPrompt).toContain("Always speak in English");
        return Response.json({ agentId: "agent_1", created: true, updated: false, configHash: "hash" });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "EN" }));
    expect(localStorage.getItem("voicehire.locale")).toBe("en");
    expect(screen.getByRole("button", { name: /Create AI agent/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Settings/i }));
    await user.type(screen.getByLabelText("ElevenLabs API key"), "live-key");
    await user.click(screen.getByRole("button", { name: /Validate key/i }));
    await waitFor(() => expect(screen.getByLabelText("Voice")).toHaveValue("real_voice_1"));
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await user.click(screen.getByRole("button", { name: /Create AI agent/i }));

    await screen.findAllByText(/Agent created/i);
  });

  it("locks the locale switch during an active call and unlocks it after ending", async () => {
    setLocale("en");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Settings/i }));
    await user.type(screen.getByLabelText("ElevenLabs API key"), "mock-key");
    await user.click(screen.getByRole("button", { name: /Validate key/i }));
    await screen.findByText(/Mock key accepted/i);
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await user.click(screen.getByRole("button", { name: /Create AI agent/i }));
    await screen.findAllByText(/Agent created/i);
    await user.click(screen.getByRole("button", { name: "Call" }));

    expect(screen.getByRole("button", { name: "RU" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "EN" })).toBeDisabled();

    await user.click(await screen.findByRole("button", { name: "End conversation" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "RU" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "EN" })).toBeEnabled();
  });

  it("stores mock API key in sessionStorage and mock agent id in localStorage", async () => {
    setLocale("ru");
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
    setLocale("ru");
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
    setLocale("ru");
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

  it("shows localized backend error reasons", async () => {
    setLocale("en");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "INSUFFICIENT_PERMISSIONS",
              message: "У ключа недостаточно разрешений для этого действия."
            }
          },
          { status: 403 }
        )
      )
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Settings/i }));
    await user.type(screen.getByLabelText("ElevenLabs API key"), "live-key");
    await user.click(screen.getByRole("button", { name: /Validate key/i }));

    expect(await screen.findByText("The key does not have enough permissions for this action.")).toBeInTheDocument();
  });

  it("does not expose API keys or conversation tokens in the technical log", async () => {
    setLocale("en");
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Settings/i }));
    await user.type(screen.getByLabelText("ElevenLabs API key"), "mock-key");
    await user.click(screen.getByRole("button", { name: /Validate key/i }));
    await screen.findByText(/Mock key accepted/i);
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await user.click(screen.getByRole("button", { name: /Create AI agent/i }));
    await screen.findAllByText(/Agent created/i);
    await user.click(screen.getByRole("button", { name: "Call" }));
    await screen.findByText(/Mock realtime session is active/i);

    expect(screen.queryByText(/mock-key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mock_session_/i)).not.toBeInTheDocument();
  });

  it("fills lead form after mock conversation ends without submitting it", async () => {
    setLocale("ru");
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
