import { Plus, Trash2, Sparkles, X, LogOut } from "lucide-react";

export default function Sidebar({ convos, activeId, onSelect, onNew, onDelete, open, onClose, email, onSignOut }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-white/5 bg-zinc-950 transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <Sparkles size={16} />
          </div>
          <span className="font-semibold tracking-tight">Companion</span>
          <button className="ml-auto md:hidden" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="px-3">
          <button
            onClick={onNew}
            className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm transition hover:bg-white/10"
          >
            <Plus size={16} /> New conversation
          </button>
        </div>

        <p className="px-4 pb-2 pt-5 text-xs uppercase tracking-wider text-zinc-500">Conversations</p>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2">
          {convos.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                c.id === activeId ? "bg-white/10" : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              <span className="flex-1 truncate">{c.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                className="text-zinc-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2 border-t border-white/5 p-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs uppercase">
            {email?.[0]}
        </div>
        <span className="flex-1 truncate text-sm text-zinc-400">{email}</span>
        <button onClick={onSignOut} title="Sign out" className="text-zinc-500 hover:text-zinc-200">
            <LogOut size={16} />
        </button>
        </div>
      </aside>
    </>
  );
}