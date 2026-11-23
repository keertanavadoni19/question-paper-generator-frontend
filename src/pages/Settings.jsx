import { useState } from "react";
import { Save, RotateCcw, Server } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { API_URL, USE_MOCK } from "../services/api";
import { storage } from "../services/storage";
import { validateFullName } from "../utils/validation";

export default function Settings() {
  const { user, updateProfile, logout } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user.fullName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    const msg = validateFullName(fullName);
    setError(msg);
    if (msg) return;
    setSaving(true);
    await updateProfile({ fullName: fullName.trim() });
    setSaving(false);
    toast.success("Profile updated");
  };

  const resetDemo = () => {
    storage.clearAll();
    logout();
    window.location.href = "/login";
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile and app configuration." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <form onSubmit={save} noValidate className="space-y-4">
            <Input id="st-name" label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={error} />
            <Input id="st-email" label="Email" value={user.email} disabled />
            <div className="flex items-center gap-2 text-sm text-slate-600">Role: <Badge color={user.role === "admin" ? "indigo" : "cyan"}>{user.role}</Badge></div>
            <Button type="submit" icon={Save} loading={saving}>Save profile</Button>
          </form>
        </Card>

        <Card title="Backend connection">
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2"><Server className="h-4 w-4 text-slate-400" />API URL: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{API_URL}</code></p>
            <p>Mode: {USE_MOCK ? <Badge color="amber">Mock data (no backend)</Badge> : <Badge color="green">Live API</Badge>}</p>
            <p className="text-slate-500">
              Change these in the <code className="rounded bg-slate-100 px-1 text-xs">.env</code> file (<code className="text-xs">VITE_API_URL</code>, <code className="text-xs">VITE_USE_MOCK</code>) and restart <code className="text-xs">npm run dev</code>.
            </p>
            {USE_MOCK && (
              <div className="border-t border-slate-100 pt-4">
                <Button variant="secondary" icon={RotateCcw} onClick={() => setConfirmReset(true)}>Reset demo data</Button>
                <p className="mt-2 text-xs text-slate-500">Clears papers, questions, syllabus edits and users stored in this browser.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
      <ConfirmDialog open={confirmReset} title="Reset all demo data?" message="Everything saved in this browser is cleared and you'll be logged out." confirmLabel="Reset" onCancel={() => setConfirmReset(false)} onConfirm={resetDemo} />
    </>
  );
}
