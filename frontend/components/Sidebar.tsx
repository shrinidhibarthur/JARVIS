"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",       label: "Dashboard", icon: "⬡" },
  { href: "/email",  label: "Email",     icon: "✉" },
  { href: "/teams",  label: "Teams",     icon: "💬" },
  { href: "/tasks",  label: "Tasks",     icon: "✓" },
  { href: "/goals",  label: "Goals",     icon: "◎" },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <nav
      className="w-52 shrink-0 flex flex-col py-5 px-3 gap-0.5"
      style={{
        background: "linear-gradient(180deg, var(--j-sidebar-bg) 0%, var(--j-sidebar-bg-2) 100%)",
        borderRight: "1px solid var(--j-sidebar-border)",
      }}
    >
      {/* Brand */}
      <div className="px-2 mb-7 mt-1">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-bold glow-cyan" style={{ color: "var(--j-sidebar-accent)" }}>⬡</span>
          <span className="font-bold text-base tracking-[0.18em]" style={{ color: "var(--j-sidebar-accent)" }}>JARVIS</span>
        </div>
        <p className="text-xs mt-1 pl-8" style={{ color: "var(--j-sidebar-muted)" }}>Executive Assistant</p>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-0.5 flex-1">
        {NAV.map((item) => {
          const active = path === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative"
              style={active ? {
                background: "color-mix(in srgb, var(--j-sidebar-accent) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--j-sidebar-accent) 32%, transparent)",
                boxShadow: "inset 3px 0 0 color-mix(in srgb, var(--j-sidebar-accent) 80%, transparent)",
                color: "var(--j-sidebar-accent)",
              } : {
                border: "1px solid transparent",
                color: "var(--j-sidebar-text)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--j-sidebar-accent) 8%, transparent)";
                  (e.currentTarget as HTMLElement).style.color = "var(--j-sidebar-accent)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--j-sidebar-text)";
                }
              }}
            >
              <span className="w-5 text-center text-sm" style={active ? { color: "var(--j-sidebar-accent)" } : { color: "var(--j-sidebar-muted)" }}>
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
              {active && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--j-sidebar-accent)", boxShadow: "0 0 6px color-mix(in srgb, var(--j-sidebar-accent) 80%, transparent)" }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-4 px-2" style={{ borderTop: "1px solid var(--j-sidebar-border)" }}>
        <button
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-150"
          style={{
            color: "var(--j-sidebar-muted)",
            border: "1px solid transparent",
            background: "transparent",
          }}
          title="Collapse"
        >
          <span>◁</span>
          <span>Collapse</span>
        </button>
      </div>
    </nav>
  );
}
