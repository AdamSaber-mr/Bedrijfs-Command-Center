// Zachte fade + lift bij elke paginawissel (remount per route-segment).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in flex min-h-full flex-1 flex-col">{children}</div>;
}
