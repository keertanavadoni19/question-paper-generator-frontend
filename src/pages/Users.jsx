import { useEffect, useMemo, useState } from "react";
import { Trash2, Users as UsersIcon } from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import SearchInput from "../components/ui/SearchInput";
import Loader from "../components/ui/Loader";
import EmptyState from "../components/ui/EmptyState";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { deleteUser, listUsers, updateUser } from "../services/userService";
import { formatDate } from "../utils/helpers";

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => {
    listUsers().then(setUsers);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (users ?? []).filter((u) => !term || u.fullName.toLowerCase().includes(term) || u.email.includes(term));
  }, [users, search]);

  const change = async (id, changes, message) => {
    const updated = await updateUser(id, changes);
    setUsers((list) => list.map((u) => (u.id === id ? updated : u)));
    toast.success(message);
  };

  const handleDelete = async () => {
    await deleteUser(toDelete.id);
    setUsers((list) => list.filter((u) => u.id !== toDelete.id));
    setToDelete(null);
    toast.success("User removed");
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Manage Admin and Teacher accounts." />
      <Card bodyClassName="p-0">
        <div className="border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or email" className="max-w-sm" />
        </div>
        {!users ? (
          <Loader />
        ) : !filtered.length ? (
          <EmptyState icon={UsersIcon} title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const isMe = u.id === me.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{u.fullName}{isMe && <span className="ml-1 text-xs text-slate-400">(you)</span>}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={u.role}
                          disabled={isMe}
                          onChange={(e) => change(u.id, { role: e.target.value }, `${u.fullName} is now ${e.target.value === "admin" ? "an Admin" : "a Teacher"}`)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:bg-slate-50"
                          aria-label={`Role of ${u.fullName}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="teacher">Teacher</option>
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          disabled={isMe}
                          onClick={() => change(u.id, { status: u.status === "active" ? "inactive" : "active" }, `${u.fullName} ${u.status === "active" ? "deactivated" : "activated"}`)}
                          className="disabled:cursor-not-allowed"
                          title={isMe ? "You can't deactivate yourself" : "Click to toggle"}
                        >
                          <Badge color={u.status === "active" ? "green" : "slate"}>{u.status}</Badge>
                        </button>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(u.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        {!isMe && (
                          <Button size="icon" variant="ghost" onClick={() => setToDelete(u)} aria-label={`Delete ${u.fullName}`} className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmDialog open={Boolean(toDelete)} title="Remove user?" message={`${toDelete?.fullName} will no longer be able to log in. Their papers are kept.`} confirmLabel="Remove" onCancel={() => setToDelete(null)} onConfirm={handleDelete} />
    </>
  );
}
