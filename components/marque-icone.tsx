/** Marque dessinée pour les icônes générées (écran d’accueil, onglet). */
export function Marque({ taille }: { taille: number }) {
  const p = taille / 512;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #2f7a60, #173b30)" }}>
      <div style={{ position: "relative", width: 220 * p, height: 220 * p, display: "flex" }}>
        {[-45, 0, 45].map((r) => (
          <div
            key={r}
            style={{
              position: "absolute",
              left: 70 * p,
              top: 20 * p,
              width: 80 * p,
              height: 140 * p,
              borderRadius: "50%",
              border: `${10 * p}px solid #a9d99e`,
              transform: `rotate(${r}deg)`,
              transformOrigin: "50% 100%",
            }}
          />
        ))}
      </div>
    </div>
  );
}
