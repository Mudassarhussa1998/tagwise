"use client";

import { useEffect, useState } from "react";
import { Mail, UserPlus, X } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button, Card, ErrorNote, Field, Modal, Spinner } from "@/components/ui";
import { api, type Invite, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function TeamPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [users, setUsers] = useState<User[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([api<User[]>("/users"), api<Invite[]>("/invites")])
      .then(([u, i]) => {
        setUsers(u);
        setInvites(i);
      })
      .catch((e) => setError(e.message));
  }, []);

  const revoke = async (invite: Invite) => {
    await api(`/invites/${invite.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    setInvites((list) => list.filter((i) => i.id !== invite.id));
  };

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="People who use the dashboard. Operators don't need an account; they just scan the QR code."
        actions={
          isAdmin && (
            <Button onClick={() => setAdding(true)}>
              <UserPlus className="size-4" /> Invite member
            </Button>
          )
        }
      />
      <ErrorNote message={error} />
      {!users ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <Card className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{initials(u.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {u.name} {u.id === user?.id && <span className="font-normal text-slate-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                </div>
                <span className="hidden text-xs text-slate-500 sm:block">Joined {formatDate(u.created_at)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">{u.role}</span>
              </div>
            ))}
          </Card>

          {invites.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Pending invites</h2>
              <Card className="divide-y divide-slate-100">
                {invites.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-600">
                      <Mail className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{i.email}</p>
                      <p className="truncate text-xs text-slate-500">
                        Invited by {i.invited_by} · {formatDate(i.created_at)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">{i.role}</span>
                    {isAdmin && (
                      <button onClick={() => revoke(i)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600" aria-label={`Revoke invite for ${i.email}`}>
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Invite a team member">
        <InviteForm
          onInvited={(i) => {
            setInvites((list) => [...list, i]);
            setAdding(false);
          }}
        />
      </Modal>
    </>
  );
}

function InviteForm({ onInvited }: { onInvited: (i: Invite) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      onInvited(await api<Invite>("/invites", { body: { email, role } }));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Work email" hint="They join your company automatically the first time they sign in with this email.">
        <input className="input" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Role">
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">Member: manage assets and maintenance</option>
          <option value="admin">Admin: also manage team and delete assets</option>
        </select>
      </Field>
      <ErrorNote message={error} />
      <div className="form-actions">
        <Button type="submit" loading={saving} className="w-full">
          Send invite
        </Button>
      </div>
    </form>
  );
}
