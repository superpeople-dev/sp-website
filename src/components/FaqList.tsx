import { Answer } from "./FaqAnswer";

// The FAQ page (app/[lang]/faq): every question, each opening on its own like the home page's. The
// answers are in the page (a <details>, no script), for search engines and AI assistants too. Each
// question has an address (/faq#q3), which opens it (FaqHash).
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="faq faq--page">
      {items.map((item, i) => (
        <details key={i} id={`q${i + 1}`} className="faq__item">
          <summary className="faq__q">
            <h2>{item.q}</h2>
            <span className="faq__icon" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="faq__a">
            <div className="faq__text">
              <Answer text={item.a} />
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
