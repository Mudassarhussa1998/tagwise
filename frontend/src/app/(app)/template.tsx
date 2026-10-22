// A template remounts on every navigation, so each dashboard page gently fades in.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
