import { useEffect, useRef, useState } from "react";
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
import Icon from "./components/Icon.jsx";

const route = () => (location.hash.replace(/^#\/?/, "").split("?")[0] || "home");
const base = (p) => p.split("/")[0];

export function go(path) { location.hash = "/" + path; window.scrollTo(0, 0); }

// Five destinations everywhere (a bottom tab bar on phones); the rest sits under More / Menu.
const MAIN = [
  { k: "home", label: "Overview", icon: "home", on: ["home"] },
  { k: "match", label: "Match", icon: "match", on: ["match", "report", "scout"] },
  { k: "coaches", label: "Coaches", icon: "coaches", on: ["coaches", "coach"] },
  { k: "roundtable", label: "Round table", icon: "table", on: ["roundtable"] },
  { k: "live", label: "Live", icon: "live", on: ["live"] },
];
const MORE = [
  { k: "analyze", label: "Analyze a video", note: "Add a match from this device", icon: "plus" },
  { k: "messages", label: "Messages", note: "Coaches on Telegram", icon: "chat" },
  { k: "memory", label: "Player memory", note: "What the coaches remember", icon: "memory" },
];
const href = (k) => `#/${k === "home" ? "" : k}`;

// a menu that closes on Escape, on a click outside it and on navigation
function useMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const key = (e) => e.key === "Escape" && setOpen(false);
    const click = (e) => !box.current?.contains(e.target) && setOpen(false);
    const nav = () => setOpen(false);
    addEventListener("keydown", key); addEventListener("pointerdown", click); addEventListener("hashchange", nav);
    return () => { removeEventListener("keydown", key); removeEventListener("pointerdown", click); removeEventListener("hashchange", nav); };
  }, [open]);
  return [open, setOpen, box];
}

function Nav({ page, data }) {
  const cur = (it) => (it.on ?? [it.k]).includes(base(page)) ? "page" : undefined;
  const [more, setMore, moreBox] = useMenu();
  const [menu, setMenu, menuBox] = useMenu();
  return (
    <>
      <header className="nav">
        <a className="brand" href="#/" aria-label="ShuttleCoach home">
          <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 48 C 22 8, 42 8, 54 30" /><circle cx="54" cy="30" r="5" /></svg>
          <span>ShuttleCoach</span>
        </a>
        <span className="nav-badge" title="Every model in this prototype runs in your browser or on this machine">
          <i aria-hidden="true" /><span>On-device</span>
        </span>
        <nav className="nav-links" aria-label="Main">
          {MAIN.map((it) => <a key={it.k} href={href(it.k)} aria-current={cur(it)}>{it.label}</a>)}
          <div className="nav-more" ref={moreBox}>
            <button className="nav-more-btn" aria-expanded={more} aria-haspopup="true" aria-current={MORE.some((it) => cur(it)) ? "page" : undefined}
              onClick={() => setMore(!more)}>More <Icon name="down" size={14} /></button>
            {more && (
              <div className="menu-pop" role="menu">
                {MORE.slice(1).map((it) => (
                  <a key={it.k} role="menuitem" href={href(it.k)} aria-current={cur(it)}><Icon name={it.icon} /><span><b>{it.label}</b><em>{it.note}</em></span></a>
                ))}
              </div>
            )}
          </div>
        </nav>
        <div className="nav-tools">
          <a className="btn primary sm nav-analyze" href="#/analyze"><Icon name="plus" size={16} />Analyze video</a>
          <VoiceCoach data={data} />
          <div className="nav-menu" ref={menuBox}>
            <button className="icon-btn" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name={menu ? "close" : "menu"} /></button>
            {menu && (
              <div className="menu-sheet" role="menu">
                <div className="menu-main">
                  {MAIN.map((it) => <a key={it.k} role="menuitem" href={href(it.k)} aria-current={cur(it)}><Icon name={it.icon} />{it.label}</a>)}
                </div>
                {MORE.map((it) => (
                  <a key={it.k} role="menuitem" href={href(it.k)} aria-current={cur(it)}><Icon name={it.icon} /><span><b>{it.label}</b><em>{it.note}</em></span></a>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <nav className="tabbar" aria-label="Main">
        {MAIN.map((it) => <a key={it.k} href={href(it.k)} aria-current={cur(it)}><Icon name={it.icon} size={22} /><span>{it.label}</span></a>)}
      </nav>
    </>
  );
}

// Rally 3D and the scouting report belong to the match: one strip of sub-pages on all three.
export function MatchNav({ page }) {
  return (
    <nav className="subnav noprint" aria-label="Match views">
      {[["match", "Analysis"], ["report", "Rally 3D"], ["scout", "Scouting report"]].map(([k, l]) => (
        <a key={k} href={`#/${k}`} aria-current={page === k ? "page" : undefined}>{l}</a>
      ))}
    </nav>
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

  // Live is a broadcast view of its own: no app chrome, its own exit
  const bare = page === "live";
  return (
    <>
      {!bare && <Nav page={page} data={data} />}
      <main className={bare ? "bare" : ""}>
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
        {page === "live" && <Live data={data} />}
        {page === "roundtable" && <RoundTable data={data} />}
        {page === "messages" && <Messages />}
      </main>
    </>
  );
}
