export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface StreamOptions {
  messages: ChatMessage[];
  systemPrompt: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
  fileData?: { type: string; content: string; fileName: string } | null;
}

function getAiApiUrl(): string {
  if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
    return "/api/chat";
  }
  const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return `${base}/api/chat`;
}

export async function streamChat(opts: StreamOptions) {
  const aiUrl = getAiApiUrl();

  try {
    const body: Record<string, unknown> = {
      messages: opts.messages,
      systemPrompt: opts.systemPrompt,
    };

    if (opts.fileData) {
      body.fileData = opts.fileData;
    }

    const res = await fetch(aiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!res.ok) {
      throw new Error(`AI API returned ${res.status}`);
    }

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream") && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.error) {
              opts.onError(parsed.error);
              return;
            }

            const text = parsed.text;
            if (text) {
              opts.onDelta(text);
            }

            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              opts.onDelta(deltaContent);
            }
          } catch {
            // Incomplete JSON, skip
          }
        }
      }

      opts.onDone();
    } else {
      const data = await res.json();

      if (data.error) {
        opts.onError(data.error);
        return;
      }

      const text = data.text || data.choices?.[0]?.message?.content || "";
      if (text) {
        opts.onDelta(text);
      }

      opts.onDone();
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      opts.onDone();
      return;
    }
    opts.onError(`Failed to connect to AI API. ${(e as Error).message}`);
  }
}
