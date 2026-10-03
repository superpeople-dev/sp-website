import Image from "next/image";
import { locations } from "@/lib/art";

// OrbIsland's locations as a slow strip under the gallery, the way the game's map guide shows them.
// The row is drawn twice so the loop has no seam; decorative, so screen readers skip it.
export function Locations() {
  return (
    <div className="locations" aria-hidden="true">
      <div className="locations__track">
        {[...locations, ...locations].map((src, i) => (
          <div key={i} className="locations__tile">
            <Image src={src} alt="" fill sizes="380px" quality={90} />
          </div>
        ))}
      </div>
    </div>
  );
}
