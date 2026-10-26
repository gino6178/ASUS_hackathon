import { useEffect, useState } from "react";
import Landing from "./pages/Landing.jsx";
import Upload from "./pages/Upload.jsx";
import Processing from "./pages/Processing.jsx";
import Report from "./pages/Report.jsx";
import Coaches from "./pages/Coaches.jsx";
import Coach from "./pages/Coach.jsx";
import Memory from "./pages/Memory.jsx";
import Match from "./pages/Match.jsx";
import Scout from "./pages/Scout.jsx";
import Live from "./pages/Live.jsx";
import RoundTable from "./pages/RoundTable.jsx";
import Messages from "./pages/Messages.jsx";
import { memory } from "./memory.js";
import VoiceCoach from "./voice/VoiceCoach.jsx";
import { loadSample } from "./data.js";

const route = () => (location.hash.replace(/^#\/?/, "").split("?")[0] || "home");
const base = (p) => p.split("/")[0];

export function go(path) { location.hash = "/" + path; window.scrollTo(0, 0); }

function Nav({ page, data }) {
  const items = [["home", "Overview"], ["analyze", "Analyze"], ["coaches", "Coaches"], ["roundtable", "Round table"], ["match", "Match"], ["report", "Rally 3D"], ["live", "Live"], ["scout", "Scout"], ["messages", "Messages"], ["memory", "Memory"]];
  return (
    <header className="nav">
      <a className="brand" href="#/" aria-label="ShuttleCoach home">
        <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 48 C 22 8, 42 8, 54 30" /><circle cx="54" cy="30" r="5" /></svg>
        <span>ShuttleCoach</span>
      </a>
      <nav>
        {items.map(([k, label]) => (
          <a key={k} href={`#/${k === "home" ? "" : k}`} aria-current={base(page) === k || (k === "coaches" && base(page) === "coach") ? "page" : undefined}>{label}</a>
        ))}
      </nav>
      <VoiceCoach data={data} />
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
      <Nav page={page} data={data} />
      <main>
        {page === "home" && <Landing data={data} />}
        {page === "analyze" && <Upload onVideo={(v) => { setVideo(v); go("processing"); }} />}
        {page === "processing" && <Processing video={video} onDone={() => {
          // remember this analysis so later sessions can refer back to it
          const ins = data?.insights, oc = data?.outcomes?.A;
          if (ins && oc) memory.saveSession(data.event, `Match analysed (${data.event}): most-targeted zone ${ins.topZone.key.replace("-", " ")}, ${oc.winners.length} winners vs ${oc.beaten.length} conceded, ${oc.errors.length} own errors.`);
          go("coaches");
        }} />}
        {page === "report" && <Report data={data} video={video} />}
        {page === "coaches" && <Coaches data={data} video={video} />}
        {base(page) === "coach" && <Coach id={page.split("/")[1]} data={data} />}
        {page === "memory" && <Memory />}
        {base(page) === "match" && <Match />}
        {page === "scout" && <Scout />}
        {page === "live" && <Live />}
        {page === "roundtable" && <RoundTable data={data} />}
        {page === "messages" && <Messages />}
      </main>
    </>
  );
}
