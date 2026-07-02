"use client";

// ===================================================================
//  components/dream/DreamSelectPanel.tsx — 圆梦球星选择页
//  15位无冠球星，从本地 /players/ 加载头像
// ===================================================================
import { useState, useEffect } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import type { DreamPlayer } from "@/lib/frontend/types";

const IMG = (filename: string) => `/players/${filename}`;

const PLAYERS: DreamPlayer[] = [
  { name:"James Harden",cname:"詹姆斯-哈登",icon:IMG("A5E591EA45081CE07FEBE249B9277DC0_1773109653607.png"),pos:"PG",positions:["PG","SG"],team:"BKN",pts:21.86,reb:5.73,ast:8.01,stl:1.27,blk:0.58,diff:0.97,decade:"2020s"},
  { name:"Russell Westbrook",cname:"拉塞尔-威斯布鲁克",icon:IMG("D37B2884BBBDA8D062DB9D86FFC0D5F8_1761126279658.png"),pos:"PG",positions:["PG"],team:"WAS",pts:17.40,reb:6.68,ast:7.38,stl:1.33,blk:0.33,diff:0.99,decade:"2020s"},
  { name:"Joel Embiid",cname:"乔尔-恩比德",icon:IMG("CF2E70A9339F300322586297BB158F25_1734147088519.webp"),pos:"C",positions:["C"],team:"PHI",pts:26.92,reb:10.67,ast:3.70,stl:0.80,blk:1.69,diff:0.99,decade:"2020s"},
  { name:"Yao Ming",cname:"姚明",icon:IMG("1603078667489362863.png"),pos:"C",positions:["C"],team:"HOU",pts:19.14,reb:9.3,ast:1.61,stl:0.41,blk:1.89,diff:1.00,decade:"2000s"},
  { name:"Carmelo Anthony",cname:"卡梅罗-安东尼",icon:IMG("90EC3BFDB7D6D3D05527AA7506BE8FFF_1633068276839.png"),pos:"SF",positions:["PF","SF"],team:"DEN",pts:19.79,reb:5.54,ast:2.19,stl:0.87,blk:0.58,diff:0.99,decade:"2010s"},
  { name:"Chris Paul",cname:"克里斯-保罗",icon:IMG("C1BAC271420E319E446A95130526A14B_1759998126928.png"),pos:"PG",positions:["PG"],team:"NOP",pts:13.51,reb:3.98,ast:8.11,stl:1.70,blk:0.16,diff:0.99,decade:"2000s"},
  { name:"Damian Lillard",cname:"达米安-利拉德",icon:IMG("BB0AFC9AD870BF5C61613D33F28229E5_1759996808415.webp"),pos:"PG",positions:["PG","SG"],team:"POR",pts:25.47,reb:4.39,ast:6.92,stl:0.96,blk:0.28,diff:0.99,decade:"2020s"},
  { name:"Luka Dončić",cname:"卢卡-东契奇",icon:IMG("8DBAB40D30CF515F6B6039AB3CDB5800_1759996239910.png"),pos:"PG",positions:["PG","SG","SF"],team:"DAL",pts:27.57,reb:8.13,ast:7.60,stl:1.33,blk:0.43,diff:0.99,decade:"2020s"},
  { name:"Paul George",cname:"保罗-乔治",icon:IMG("2294F91F0D4079FFBEA2B9EC4B94BC65_1733561596471.webp"),pos:"SF",positions:["PF","SF","SG"],team:"OKC",pts:20.82,reb:6.18,ast:3.94,stl:1.79,blk:0.45,diff:0.99,decade:"2010s"},
  { name:"Jimmy Butler",cname:"吉米-巴特勒",icon:IMG("B27038CF447882AF69A38BA316BABD09_1759999262986.png"),pos:"SF",positions:["SG","SF","PF"],team:"MIA",pts:19.25,reb:5.38,ast:4.57,stl:1.69,blk:0.39,diff:0.99,decade:"2020s"},
  { name:"Derrick Rose",cname:"德里克-罗斯",icon:IMG("E6552E310B4FA687FC0F4AD369A2577C_1698218908417.png"),pos:"PG",positions:["PG"],team:"CHI",pts:15.04,reb:3.01,ast:4.55,stl:0.64,blk:0.26,diff:0.99,decade:"2010s"},
  { name:"Tracy McGrady",cname:"特雷西-麦克格雷迪",icon:IMG("1192_243_big.jpg"),pos:"SG",positions:["SF","SG"],team:"ORL",pts:13.91,reb:4.85,ast:3.65,stl:0.96,blk:0.85,diff:1.00,decade:"2000s"},
  { name:"Blake Griffin",cname:"布雷克-格里芬",icon:IMG("FC4FA928B590F43C112ECEFC5ED5BB8C_1666145558968.png"),pos:"PF",positions:["C","PF"],team:"LAC",pts:21.55,reb:9.31,ast:4.24,stl:0.96,blk:0.53,diff:0.99,decade:"2010s"},
  { name:"Steve Nash",cname:"史蒂夫-纳什",icon:IMG("514_437_big.jpg"),pos:"PG",positions:["PG"],team:"PHX",pts:17.12,reb:3.51,ast:10.88,stl:0.80,blk:0.12,diff:0.99,decade:"2000s"},
  { name:"Allen Iverson",cname:"阿伦-艾弗森",icon:IMG("2b8c606b694a7db21ea0a5a510fde1ba.jpg"),pos:"PG",positions:["PG","SG"],team:"PHI",pts:29.93,reb:3.85,ast:6.08,stl:2.39,blk:0.16,diff:1.00,decade:"2000s"},
];

interface Props { onConfirm: (dp: DreamPlayer) => void; onBack: () => void; }

export function DreamSelectPanel({ onConfirm, onBack }: Props) {
  const [selected, setSelected] = useState(-1);
  // 服务端渲染用原始顺序，客户端 hydrate 后随机排列
  const [shuffled, setShuffled] = useState<DreamPlayer[]>([...PLAYERS]);

  useEffect(() => {
    // 客户端激活后随机排列
    setShuffled([...PLAYERS].sort(() => Math.random() - 0.5));
  }, []);

  // 将15位球员分成多行，每行最多4个
  const rows: DreamPlayer[][] = [];
  for (let i = 0; i < shuffled.length; i += 4) {
    rows.push(shuffled.slice(i, i + 4));
  }

  return (
    <div id="screen-dream-select" className="screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 12px", overflowY: "auto" }}>
      <button className="back-nav" onClick={onBack} style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }} title="返回主菜单">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Oswald',sans-serif", color: "var(--gold-light)", fontSize: "1.4rem", margin: 0 }}>🌟 圆梦模式</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 4 }}>从以下未曾夺冠的球星中选择一位，带他夺冠圆梦！</p>
      </div>
      <div className="dream-select-grid" style={{ maxWidth: 480, width: "100%" }}>
        {rows.map((row, ri) => (
          <div className="dream-select-row" key={ri} style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            {row.map((p) => {
              const idx = shuffled.indexOf(p);
              const sel = selected === idx;
              return (
                <div key={p.name} className={`dream-player-card${sel ? " selected" : ""}`}
                  style={{ cursor: "pointer", padding: "8px 6px", borderRadius: 12, textAlign: "center", width: 90, background: sel ? "rgba(243,156,18,0.15)" : "rgba(255,255,255,0.04)", border: sel ? "2px solid var(--gold-light)" : "1px solid rgba(255,255,255,0.1)", transition: "all 0.2s" }}
                  onClick={() => setSelected(idx)}>
                  <SafeImage className="dp-img" src={p.icon} alt={p.cname} width={48} height={48} style={{ marginBottom: 2, objectFit: "contain" }} />
                  <div style={{ fontSize: "0.68rem", color: "#fff", fontWeight: 600, lineHeight: 1.1 }}>{p.cname.includes("-") ? p.cname.split("-")[1] : p.cname}</div>
                  <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{p.cname.includes("-") ? p.cname.split("-")[0] : ""}</div>
                  <div style={{ marginTop: 1 }}>
                    {p.positions.map((pos) => (
                      <span key={pos} className="dp-pos" style={{ display: "inline-block", padding: "0px 4px", margin: "1px", fontSize: "0.55rem", background: "rgba(255,255,255,0.1)", borderRadius: "3px" }}>{pos}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {selected >= 0 && (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 8 }}>已选择：{shuffled[selected]?.cname}</p>
          <button className="btn btn-gold" onClick={() => onConfirm(shuffled[selected])} style={{ width: 220, justifyContent: "center" }}>✅ 确认我的圆梦对象</button>
        </div>
      )}
      <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: 12, width: 220, justifyContent: "center" }}>🏠 返回主页</button>
    </div>
  );
}
