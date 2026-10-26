import { useEffect, useState } from "react";
import Landing from "./pages/Landing.jsx";
import Upload from "./pages/Upload.jsx";
import Processing from "./pages/Processing.jsx";
import Report from "./pages/Report.jsx";
import { loadSample } from "./data.js";

const route = () => (location.hash.replace(/^#\/?/, "").split("?")[0] || "home");

export function go(path) { location.hash = "/" + path; window.scrollTo(0, 0); }

function Nav({ page }) {
  const items = [["home", "Overview"], ["analyze", "Analyze"], ["report", "Report"]];
  return (
    <header className="nav">
      <a className="brand" href="#/" aria-label="ShuttleCoach home">
        <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 48 C 22 8, 42 8, 54 30" /><circle cx="54" cy="30" r="5" /></svg>
        <span>ShuttleCoach</span>
      </a>
      <nav>
        {items.map(([k, label]) => (
          <a key={k} href={`#/${k === "home" ? "" : k}`} aria-current={page === k ? "page" : undefined}>{label}</a>
        ))}
      </nav>
      <span className="nav-badge" title="Every model in this prototype runs in your browser or on this machine">
        <i /> On-device
      </span>
    </header>
  );
}

export default function App() {
  const [page, setPage] = useState(route());
  const [video, setVideo] = useState(null); // { url, name, size, duration, width, height }
  const [data, setData] = useState(null);

  useEffect(() => {
    const on = () => setPage(route());
    addEventListener("hashchange", on);
    loadSample().then(setData);
    return () => removeEventListener("hashchange", on);
  }, []);

  return (
    <>
      <Nav page={page} />
      <main>
        {page === "home" && <Landing data={data} />}
        {page === "analyze" && <Upload onVideo={(v) => { setVideo(v); go("processing"); }} />}
        {page === "processing" && <Processing video={video} onDone={() => go("report")} />}
        {page === "report" && <Report data={data} video={video} />}
      </main>
    </>
  );
}
