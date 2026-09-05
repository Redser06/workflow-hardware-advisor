import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/hooks/useAuth";
import { createSession, deleteSession, listSessions } from "@/lib/sessions.functions";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, loading, signOut } = useAuth();
  const params = useParams({ strict: false }) as { sessionId?: string };

  const list = useServerFn(listSessions);
  const create = useServerFn(createSession);
  const remove = useServerFn(deleteSession);

  useEffect(() => {
    if (!loading && !session) {
      void navigate({
        to: "/auth",
        search: { redirect: window.location.pathname },
      });
    }
  }, [loading, navigate, session]);

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => list(),
    enabled: Boolean(session),
  });

  const createMutation = useMutation({
    mutationFn: () => create(),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void navigate({ to: "/session/$sessionId", params: { sessionId: id } });
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      if (params.sessionId === id) void navigate({ to: "/app" });
    },
    onError: (error) => toast.error(error.message),
  });

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="label-caps">Loading</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-rule md:flex">
        <div className="flex items-center gap-2 border-b border-rule px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark className="size-5" />
            <span className="figure text-xs font-semibold text-foreground">HARDWARE FIT</span>
          </Link>
        </div>

        <div className="px-3 py-3">
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="flex w-full items-center justify-center gap-2 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            New analysis
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <span className="label-caps px-2">Analyses</span>
          <ul className="mt-2 space-y-px">
            {(sessionsQuery.data ?? []).map((item) => {
              const active = params.sessionId === item.id;
              return (
                <li
                  key={item.id}
                  className={`group flex items-center gap-1 px-1 ${
                    active ? "bg-accent" : "hover:bg-accent/60"
                  }`}
                >
                  <Link
                    to="/session/$sessionId"
                    params={{ sessionId: item.id }}
                    className="min-w-0 flex-1 truncate px-2 py-2 text-xs text-foreground"
                  >
                    {item.title}
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-under group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
            {sessionsQuery.data?.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">Nothing yet.</li>
            ) : null}
          </ul>
        </nav>

        <div className="border-t border-rule px-4 py-3">
          <p className="figure truncate text-[11px] text-muted-foreground">{session.user.email}</p>
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => navigate({ to: "/" }));
            }}
            className="mt-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-rule px-4 py-3 md:hidden">
          <Link to="/app" className="flex items-center gap-2">
            <BrandMark className="size-5" />
            <span className="figure text-xs font-semibold text-foreground">HARDWARE FIT</span>
          </Link>
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            className="figure border border-rule px-2 py-1 text-[11px] text-foreground"
          >
            New
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
