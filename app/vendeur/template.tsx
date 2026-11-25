/** Rejoue une entrée douce à chaque navigation (fondu et léger glissement). */
export default function Transition({ children }: { children: React.ReactNode }) {
  return <div className="crm-page">{children}</div>;
}
