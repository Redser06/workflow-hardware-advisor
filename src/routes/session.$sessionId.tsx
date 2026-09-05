import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import type { UIMessage } from "ai";

import { AppShell } from "@/components/app-shell";
import { InterviewChat } from "@/components/interview-chat";
import { RecommendationPanel } from "@/components/recommendation-panel";
import { WorkloadProfilePanel } from "@/components/workload-profile-panel";
import { getSession } from "@/lib/sessions.functions";

export const Route = createFileRoute("/session/$sessionId")({
  head: () => ({
    meta: [
      { title: "Analysis — Hardware Fit" },
      {
        name: "description",
        content:
          "The interview, the requirement profile it produced, and three machines at current prices.",
      },
      { property: "og:title", content: "Analysis — Hardware Fit" },
      {
        property: "og:description",
        content:
          "The interview, the requirement profile it produced, and three machines at current prices.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <SessionView />
    </AppShell>
  ),
});

function SessionView() {
  const { sessionId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchSession = useServerFn(getSession);
  const [tab, setTab] = useState<"chat" | "analysis">("chat");

  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSession({ data: { id: sessionId } }),
    staleTime: 0,
  });

  const onAnalysisUpdated = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    void queryClient.invalidateQueries({ queryKey: ["sessions"] });
  }, [queryClient, sessionId]);

  if (sessionQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="label-caps">Loading analysis</span>
      </div>
    );
  }

  const data = sessionQuery.data;

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          That analysis does not exist, or it is not yours.
        </p>
      </div>
    );
  }

  const hasAnalysis = Boolean(data.profile || data.recommendation);

  const analysisPane = (
    <div className="h-full overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {data.profile ? (
          <WorkloadProfilePanel
            summary={data.profile.summary}
            requirements={data.profile.requirements}
          />
        ) : (
          <div className="border border-rule bg-surface px-4 py-6">
            <span className="label-caps">Workload profile</span>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Nothing yet. Answer the questions in the interview and the requirement profile fills
              in here — required figure, comfortable figure, and which part of your work set it.
            </p>
          </div>
        )}

        {data.recommendation ? (
          <RecommendationPanel picks={data.recommendation.picks} />
        ) : (
          <div className="border border-rule bg-surface px-4 py-6">
            <span className="label-caps">Recommendations</span>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Three machines appear once the profile is specific enough to filter the catalog:
              cheapest that works, balanced, and longest life.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-rule px-4 py-3">
        <h1 className="truncate text-sm font-semibold text-foreground">{data.session.title}</h1>
        <div className="flex shrink-0 border border-rule xl:hidden">
          {(["chat", "analysis"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`label-caps px-3 py-1.5 ${
                tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {value === "chat" ? "Interview" : hasAnalysis ? "Analysis" : "Analysis (empty)"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div
          className={`min-h-0 border-rule xl:block xl:border-r ${tab === "chat" ? "block" : "hidden"}`}
        >
          <InterviewChat
            sessionId={sessionId}
            initialMessages={data.messages as unknown as UIMessage[]}
            onAnalysisUpdated={onAnalysisUpdated}
          />
        </div>
        <div className={`min-h-0 xl:block ${tab === "analysis" ? "block" : "hidden"}`}>
          {analysisPane}
        </div>
      </div>
    </div>
  );
}
