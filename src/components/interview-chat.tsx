import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircuitBoard, Cpu, HardDrive, ListChecks, Tag } from "lucide-react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { BrandMark } from "@/components/brand-mark";
import { supabase } from "@/integrations/supabase/client";

const TOOL_META: Record<string, { label: string; icon: typeof Cpu }> = {
  search_catalog: { label: "Filtering the machine catalog", icon: CircuitBoard },
  check_price: { label: "Checking current price", icon: Tag },
  record_workload_profile: { label: "Writing the workload profile", icon: ListChecks },
  record_recommendation: { label: "Writing the three picks", icon: HardDrive },
};

const OPENERS = [
  "I'm a design student, I carry my laptop every day and I edit photos in Lightroom.",
  "I want a machine that runs a 30B local model as an agent, on all night.",
  "Accounting work, 40 browser tabs, two big spreadsheets, budget is $900.",
];

function toolNameOf(type: string) {
  return type.startsWith("tool-") ? type.slice(5) : type;
}

export function InterviewChat({
  sessionId,
  initialMessages,
  onAnalysisUpdated,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
  onAnalysisUpdated: () => void;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (url, options) => {
          const { data } = await supabase.auth.getSession();
          const headers = new Headers(options?.headers);
          if (data.session?.access_token) {
            headers.set("authorization", `Bearer ${data.session.access_token}`);
          }
          return fetch(url, { ...options, headers });
        },
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages, sessionId },
        }),
      }),
    [sessionId],
  );

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport,
    onFinish: () => onAnalysisUpdated(),
    onError: (error) => {
      const message = error.message || "The assistant could not respond.";
      if (message.includes("402")) {
        toast.error("AI credits exhausted. Add credits in Settings to continue.");
      } else if (message.includes("429")) {
        toast.error("Rate limited. Wait a moment and send that again.");
      } else {
        toast.error(message);
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput, sessionId]);

  useEffect(() => {
    if (!busy) focusInput();
  }, [busy, focusInput]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    void sendMessage({ text: trimmed });
    focusInput();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl px-4 py-6">
          {messages.length === 0 ? (
            <div className="py-10">
              <BrandMark className="size-9" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                Describe the work, not the machine.
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Tell me what you actually do on it — the programs, the file sizes, whether you
                carry it, whether it stays on. I will ask until the answers are specific enough to
                act on, then name three machines and the prices they sell for right now.
              </p>
              <div className="mt-6 space-y-2">
                <span className="label-caps">Start with something like</span>
                {OPENERS.map((opener) => (
                  <button
                    key={opener}
                    type="button"
                    onClick={() => submit(opener)}
                    className="block w-full border border-rule bg-surface px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/60 hover:bg-accent"
                  >
                    {opener}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={
                  message.role === "assistant"
                    ? "bg-transparent p-0 text-foreground"
                    : "bg-primary text-primary-foreground"
                }
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <MessageResponse key={`${message.id}-t-${index}`}>
                        {part.text}
                      </MessageResponse>
                    );
                  }

                  if (part.type.startsWith("tool-")) {
                    const name = toolNameOf(part.type);
                    const meta = TOOL_META[name];
                    const Icon = meta?.icon ?? Cpu;
                    const toolPart = part as unknown as {
                      state: "input-streaming" | "input-available" | "output-available" | "output-error";
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    return (
                      <Tool key={`${message.id}-x-${index}`} defaultOpen={false} className="my-2">
                        <ToolHeader
                          type={part.type as `tool-${string}`}
                          state={toolPart.state}
                          title={
                            <span className="flex items-center gap-2">
                              <Icon className="size-3.5" />
                              <span className="label-caps text-foreground">
                                {meta?.label ?? name}
                              </span>
                            </span>
                          }
                        />
                        <ToolContent>
                          <ToolInput input={toolPart.input} />
                          <ToolOutput
                            output={
                              toolPart.output ? (
                                <pre className="figure overflow-x-auto text-[11px] leading-relaxed">
                                  {JSON.stringify(toolPart.output, null, 2)}
                                </pre>
                              ) : null
                            }
                            errorText={toolPart.errorText}
                          />
                        </ToolContent>
                      </Tool>
                    );
                  }

                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" ? (
            <div className="px-1 py-2">
              <Shimmer className="text-sm">Reading that…</Shimmer>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-rule bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-2xl">
          <PromptInput
            onSubmit={(_message, event) => {
              event.preventDefault();
              submit(input);
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Answer in your own words — specifics help more than jargon"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={busy || input.trim().length === 0} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
