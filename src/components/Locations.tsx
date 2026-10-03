import Image from "next/image";
import { guns, locations } from "@/lib/art";

// OrbIsland's locations as a slow strip under the gallery, the way the game's map guide shows them,
// and the game's weapon skins under it running the other way. Each row is drawn twice so the loop
// has no seam; decorative, so screen readers skip it.
export function Locations() {
  return (
    <div className="locations" aria-hidden="true">
      <div className="locations__track">
        {[...locations, ...locations].map((src, i) => (
          <div key={i} className="locations__tile">
            <Image src={src} alt="" fill sizes="320px" />
          </div>
        ))}
      </div>
      <div className="locations__track locations__track--guns">
        {[...guns, ...guns].map((src, i) => (
          <Image key={i} className="locations__gun" src={src} alt="" sizes="240px" />
        ))}
      </div>
    </div>
  );
}
