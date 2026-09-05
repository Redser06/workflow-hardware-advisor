import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { createSession, listSessions } from "@/lib/sessions.functions";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Your analyses — Hardware Fit" },
      {
        name: "description",
        content: "Every hardware analysis you have run, with its requirement profile and picks.",
      },
      { property: "og:title", content: "Your analyses — Hardware Fit" },
      {
        property: "og:description",
        content: "Every hardware analysis you have run, with its requirement profile and picks.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <SessionIndex />
    </AppShell>
  ),
});

function SessionIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useServerFn(listSessions);
  const create = useServerFn(createSession);

  const sessionsQuery = useQuery({ queryKey: ["sessions"], queryFn: () => list() });

  const createMutation = useMutation({
    mutationFn: () => create(),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void navigate({ to: "/session/$sessionId", params: { sessionId: id } });
    },
    onError: (error) => toast.error(error.message),
  });

  const sessions = sessionsQuery.data ?? [];

  return (
    <div className="h-full overflow-y-auto px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-foreground">Analyses</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Each analysis is one workflow: the questions, the requirement profile it produced, and the
          three machines that met it.
        </p>

        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="mt-6 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Start a new analysis
        </button>

        <ul className="mt-8 border border-rule">
          {sessions.map((item) => (
            <li key={item.id} className="border-b border-rule last:border-b-0">
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/session/$sessionId", params: { sessionId: item.id } })
                }
                className="flex w-full items-baseline justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <span className="truncate text-sm text-foreground">{item.title}</span>
                <span className="figure shrink-0 text-[11px] text-muted-foreground">
                  {new Date(item.updated_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
          {sessions.length === 0 && !sessionsQuery.isLoading ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">
              No analyses yet. Start one and describe the work you do.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
