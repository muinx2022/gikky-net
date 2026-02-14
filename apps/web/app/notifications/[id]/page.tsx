"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ForumLayout from "../../../components/ForumLayout";
import { api } from "../../../lib/api";
import { getAuthToken } from "../../../lib/auth-storage";

type InviteStatus = "pending" | "active" | "removed";

interface InviteState {
  status: InviteStatus;
  canRespond: boolean;
  categoryId?: string;
  categoryName?: string;
}

export default function NotificationInvitePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<InviteState | null>(null);

  const jwt = useMemo(() => (typeof window !== "undefined" ? getAuthToken() : null), []);

  const fetchStatus = async () => {
    if (!id || !jwt) return;
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/api/notifications/${id}/invite-status`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      setState(res.data?.data || null);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to load invitation status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!jwt) {
      setLoading(false);
      setError("Please sign in to view this invitation.");
      return;
    }
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, jwt]);

  const respond = async (decision: "accept" | "reject") => {
    if (!jwt || !id) return;
    try {
      setSubmitting(true);
      setError("");
      await api.post(
        `/api/notifications/${id}/respond`,
        { data: { decision } },
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );
      await fetchStatus();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || "Failed to submit response.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel =
    state?.status === "active"
      ? "You already accepted this invitation."
      : state?.status === "removed"
      ? "You already rejected this invitation."
      : "You have been invited to moderate this category.";

  return (
    <ForumLayout categories={[]}>
      <div className="mx-auto max-w-2xl pt-8">
        <div className="rounded border border-slate-400 bg-white p-6">
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Moderator Invitation</h1>
          {state?.categoryName && <p className="mb-4 text-sm text-slate-600">Category: {state.categoryName}</p>}

          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              <p className="mb-5 text-sm text-slate-700">{statusLabel}</p>

              {state?.canRespond ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => respond("accept")}
                    disabled={submitting}
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => respond("reject")}
                    disabled={submitting}
                    className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push("/")}
                  className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back to home
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </ForumLayout>
  );
}
