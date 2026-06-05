// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

let suggestedMass = 0;
let reportData = {};
let alpha_1p = null;
let alpha2p = {};
let det2p = null;

// Complex Math
const toRad = d => d * Math.PI / 180;
const toDeg = r => (r * 180 / Math.PI + 360) % 360;
const toComplex = (amp, phase) => ({ r: amp * Math.cos(toRad(phase)), i: amp * Math.sin(toRad(phase)) });
const toPolar = c => ({ amp: Math.sqrt(c.r*c.r + c.i*c.i), phase: toDeg(Math.atan2(c.i, c.r)) });
const subC = (a, b) => ({ r: a.r-b.r, i: a.i-b.i });
const mulC = (a, b) => ({ r: a.r*b.r - a.i*b.i, i: a.r*b.i + a.i*b.r });
const divC = (a, b) => { let d = b.r*b.r+b.i*b.i; return { r:(a.r*b.r+a.i*b.i)/d, i:(a.i*b.r-a.r*b.i)/d }; };
const divSc = (c, s) => ({ r: c.r/s, i: c.i/s });
const negC = c => ({ r: -c.r, i: -c.i });

function calcTrialMass() {
    let M = parseFloat(document.getElementById('m_rotor').value);
    let n = parseFloat(document.getElementById('n_rpm').value);
    let r = parseFloat(document.getElementById('r_corr').value);
    let G = parseFloat(document.getElementById('g_iso').value);
    if (!M||!n||!r||!G) return alert("Preencha todos os campos!");
    let w = 2*Math.PI*n/60;
    let m_res = (G/w*1000*M)/r;
    let fator = n<=600 ? 10 : (n<1750 ? 10-5*(n-600)/1150 : 5);
    suggestedMass = m_res * fator;
    document.getElementById('out_m_res').innerText = m_res.toFixed(2);
    document.getElementById('out_m_sug').innerText = suggestedMass.toFixed(2) + " g";
    document.getElementById('res-teste').classList.remove('hidden');
}

function useCalcMass(id) {
    if (suggestedMass > 0) document.getElementById(id).value = suggestedMass.toFixed(2);
    else alert("Calcule a massa de teste primeiro!");
}

function showRefino(containerId) {
    document.getElementById(containerId).classList.remove('hidden');
    // Button ID pattern: btn-show-{containerId}
    const btn = document.getElementById('btn-show-' + containerId);
    if (btn) btn.style.display = 'none';
}

// ---- CANVAS POLAR CHART ----
function renderCanvasPolar(canvasId, title, v0, vr, vt, corr, refinos=[], trialMassG=0) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const size = 420;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2;
    const R = 155, PAD = 36;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    let allAmps = [v0.amp, vr.amp];
    if (corr) allAmps.push(corr.amp);
    refinos.forEach(r => allAmps.push(r.amp));
    const maxA = Math.max(...allAmps) * 1.2 || 1;

    // 0°=RIGHT, 90°=TOP (canvas Y inverted)
    const ptXY = (amp, deg) => ({
        x: cx + (amp / maxA) * R * Math.cos(toRad(deg)),
        y: cy - (amp / maxA) * R * Math.sin(toRad(deg))
    });

    // Dashed concentric circles
    const rings = 4;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = '#c8d0dc'; ctx.lineWidth = 1;
    for (let i = 1; i <= rings; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, R * i / rings, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Axis lines
    ctx.strokeStyle = '#c8d0dc'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - R - PAD * 0.6, cy); ctx.lineTo(cx + R + PAD * 0.6, cy);
    ctx.moveTo(cx, cy - R - PAD * 0.6); ctx.lineTo(cx, cy + R + PAD * 0.6);
    ctx.stroke();

    // Cardinal labels
    ctx.fillStyle = '#555'; ctx.font = '13px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';   ctx.textBaseline = 'middle'; ctx.fillText('0°',   cx + R + PAD*0.6 + 3, cy);
    ctx.textAlign = 'right';  ctx.textBaseline = 'middle'; ctx.fillText('180°', cx - R - PAD*0.6 - 3, cy);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('90°',  cx, cy - R - PAD*0.6 - 4);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';    ctx.fillText('270°', cx, cy + R + PAD*0.6 + 4);

    // Scale labels on 0° axis
    ctx.fillStyle = '#aaa'; ctx.font = '10px Inter, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 1; i <= rings; i++)
        ctx.fillText((maxA * i / rings).toFixed(1), cx + R * i / rings, cy + 3);

    // Title
    ctx.fillStyle = '#222'; ctx.font = 'bold 13px Inter, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(title, cx, 6);

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function drawVector(amp, deg, color, label) {
        const pt = ptXY(amp, deg);
        const angle = Math.atan2(pt.y - cy, pt.x - cx);
        ctx.save();
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pt.x, pt.y); ctx.stroke();
        const h = 11;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - h*Math.cos(angle-0.38), pt.y - h*Math.sin(angle-0.38));
        ctx.lineTo(pt.x - h*Math.cos(angle+0.38), pt.y - h*Math.sin(angle+0.38));
        ctx.closePath(); ctx.fill();
        if (label) {
            const lx = clamp(pt.x + 15*Math.cos(angle), 36, size-36);
            const ly = clamp(pt.y + 12*Math.sin(angle), 14, size-14);
            ctx.font = 'bold 10px Inter, Arial, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(lx-tw/2-3, ly-7, tw+6, 14);
            ctx.fillStyle = color; ctx.fillText(label, lx, ly);
        }
        ctx.restore();
        return pt;
    }

    // Red dashed construction line: V0 tip → Vr tip
    const p0 = ptXY(v0.amp, v0.phase), pr2 = ptXY(vr.amp, vr.phase);
    ctx.save();
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(pr2.x, pr2.y); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();

    // Blue=V0, Green=Vr
    drawVector(v0.amp, v0.phase, '#2563eb', `V₀=${v0.amp.toFixed(1)} ∠${v0.phase.toFixed(0)}°`);
    drawVector(vr.amp,  vr.phase, '#16a34a', `Vr=${vr.amp.toFixed(1)} ∠${vr.phase.toFixed(0)}°`);

    // Residuals
    const rColors = ['#0891b2', '#7c3aed'];
    refinos.forEach((r, i) => drawVector(r.amp, r.phase, rColors[i%2], `Vres${i+1}`));

    // Orange arrow + filled circle = correction mass
    if (corr) {
        const pc = ptXY(corr.amp, corr.phase);
        const angle = Math.atan2(pc.y - cy, pc.x - cx);
        ctx.save();
        ctx.strokeStyle = '#f59e0b'; ctx.fillStyle = '#f59e0b'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pc.x, pc.y); ctx.stroke();
        ctx.beginPath(); ctx.arc(pc.x, pc.y, 8, 0, 2*Math.PI); ctx.fill();
        const lx = clamp(pc.x + 20*Math.cos(angle), 50, size-50);
        const ly = clamp(pc.y + 14*Math.sin(angle), 14, size-14);
        const lt = `Mc=${corr.amp.toFixed(1)}g ∠${corr.phase.toFixed(0)}°`;
        ctx.font = 'bold 10px Inter, Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(lt).width;
        ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(lx-tw/2-3, ly-7, tw+6, 14);
        ctx.fillStyle = '#f59e0b'; ctx.fillText(lt, lx, ly);
        ctx.restore();
    }

    // Gray dot = trial mass reference
    if (trialMassG > 0) {
        const gx = cx + 32, gy = cy - 22;
        ctx.save();
        ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(gx, gy, 5, 0, 2*Math.PI); ctx.fill();
        ctx.fillStyle = '#64748b'; ctx.font = '10px Inter, Arial, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(`Prova (${trialMassG.toFixed(0)}g)`, gx + 8, gy);
        ctx.restore();
    }

    // Legend
    const legend = [
        { color: '#2563eb', label: 'V₀ — Vibração inicial' },
        { color: '#16a34a', label: 'Vr — Com massa de prova' },
        { color: '#ef4444', label: '- - Vetor efeito (construção)' },
        { color: '#f59e0b', label: '● Mc — Massa de correção' },
    ];
    refinos.forEach((r, i) => legend.push({ color: rColors[i%2], label: `Vres${i+1} — Residual` }));
    const legY0 = size - legend.length * 15 - 8;
    legend.forEach((item, idx) => {
        const ly = legY0 + idx * 15;
        ctx.fillStyle = item.color; ctx.fillRect(8, ly-4, 14, 8);
        ctx.fillStyle = '#444'; ctx.font = '9px Inter, Arial, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(item.label, 26, ly);
    });
}



// ---- 1 PLANE ----
function calc1Plane() {
    let mt = parseFloat(document.getElementById('p1_mt').value);
    let v0a = parseFloat(document.getElementById('p1_v0_amp').value);
    let v0ph = parseFloat(document.getElementById('p1_v0_ang').value);
    let vra = parseFloat(document.getElementById('p1_vr_amp').value);
    let vrph = parseFloat(document.getElementById('p1_vr_ang').value);
    if (!mt||isNaN(v0a)||isNaN(v0ph)||isNaN(vra)||isNaN(vrph)) return alert("Preencha todos os campos!");

    let v0 = toComplex(v0a, v0ph);
    let vr = toComplex(vra, vrph);
    let vt = subC(vr, v0);
    let vt_p = toPolar(vt);

    alpha_1p = divSc(vt, mt);

    let dph = Math.abs((vrph-v0ph+180)%360-180);
    const alertBox = document.getElementById('alert-1p');
    if (vt_p.amp < 0.3*v0a && dph < 30) alertBox.classList.remove('hidden');
    else alertBox.classList.add('hidden');

    let mc = negC(divC(v0, alpha_1p));
    let mc_p = toPolar(mc);

    document.getElementById('out_p1_mc').innerText = mc_p.amp.toFixed(2) + " g";
    document.getElementById('out_p1_ang').innerText = mc_p.phase.toFixed(1) + "°";
    document.getElementById('res-1p').classList.remove('hidden');

    reportData = { type:1, mt, v0:toPolar(v0), vr:toPolar(vr), vt:vt_p, mc:mc_p, refinos:[] };
    renderCanvasPolar('chart-1p', 'Plano Único', toPolar(v0), toPolar(vr), vt_p, mc_p, [], mt);
}

function calcRefino1Plane(num) {
    if (!alpha_1p) return alert("Calcule a correção principal primeiro!");
    let vra = parseFloat(document.getElementById(`p1_vres${num}_amp`).value);
    let vrph = parseFloat(document.getElementById(`p1_vres${num}_ang`).value);
    if (isNaN(vra)||isNaN(vrph)) return alert("Preencha a vibração residual!");

    let vres = toComplex(vra, vrph);
    let trim = negC(divC(vres, alpha_1p));
    let trim_p = toPolar(trim);

    document.getElementById(`out_p1_trim${num}`).innerText = trim_p.amp.toFixed(2) + " g";
    document.getElementById(`out_p1_ang_trim${num}`).innerText = trim_p.phase.toFixed(1) + "°";
    document.getElementById(`res-ref${num}-1p`).classList.remove('hidden');

    reportData.refinos[num-1] = { vres: toPolar(vres), trim: trim_p };
    let refinosPolars = reportData.refinos.filter(Boolean).map(r => r.vres);
    renderCanvasPolar('chart-1p','Plano Único', reportData.v0, reportData.vr, reportData.vt, reportData.mc, refinosPolars, reportData.mt);
}

// ---- 2 PLANES ----
function calc2Planes() {
    let mt1 = parseFloat(document.getElementById('p2_mt1').value);
    let mt2 = parseFloat(document.getElementById('p2_mt2').value);
    const g = id => parseFloat(document.getElementById(id).value);
    let v10=toComplex(g('p2_v10_amp'),g('p2_v10_ang')), v20=toComplex(g('p2_v20_amp'),g('p2_v20_ang'));
    let v11=toComplex(g('p2_v11_amp'),g('p2_v11_ang')), v21=toComplex(g('p2_v21_amp'),g('p2_v21_ang'));
    let v12=toComplex(g('p2_v12_amp'),g('p2_v12_ang')), v22=toComplex(g('p2_v22_amp'),g('p2_v22_ang'));
    if (!mt1||!mt2||isNaN(v10.r)||isNaN(v22.r)) return alert("Preencha todos os campos!");

    let vt11=subC(v11,v10), vt22=subC(v22,v20);
    alpha2p.a11=divSc(vt11,mt1); alpha2p.a21=divSc(subC(v21,v20),mt1);
    alpha2p.a12=divSc(subC(v12,v10),mt2); alpha2p.a22=divSc(vt22,mt2);
    det2p=subC(mulC(alpha2p.a11,alpha2p.a22),mulC(alpha2p.a12,alpha2p.a21));
    if (Math.abs(det2p.r)<1e-12 && Math.abs(det2p.i)<1e-12) return alert("Matriz singular!");

    let mc1=divC(subC(mulC(v20,alpha2p.a12),mulC(v10,alpha2p.a22)),det2p);
    let mc2=divC(subC(mulC(v10,alpha2p.a21),mulC(v20,alpha2p.a11)),det2p);
    let p1=toPolar(mc1), p2=toPolar(mc2);

    document.getElementById('out_p2_mc1').innerText = p1.amp.toFixed(2)+" g";
    document.getElementById('out_p2_ang1').innerText = p1.phase.toFixed(1)+"°";
    document.getElementById('out_p2_mc2').innerText = p2.amp.toFixed(2)+" g";
    document.getElementById('out_p2_ang2').innerText = p2.phase.toFixed(1)+"°";
    document.getElementById('res-2p').classList.remove('hidden');

    reportData={ type:2,mt1,mt2, v10:toPolar(v10),v20:toPolar(v20), v11:toPolar(v11),v21:toPolar(v21), v12:toPolar(v12),v22:toPolar(v22), vt11:toPolar(vt11),vt22:toPolar(vt22), mc1:p1,mc2:p2,refinos:[] };
    renderCanvasPolar('chart-2p-1','Plano 1',toPolar(v10),toPolar(v11),toPolar(vt11),p1,[],mt1);
    renderCanvasPolar('chart-2p-2','Plano 2',toPolar(v20),toPolar(v22),toPolar(vt22),p2,[],mt2);
}

function calcRefino2Planes(num) {
    if (!det2p) return alert("Calcule a correção principal primeiro!");
    const g = id => parseFloat(document.getElementById(id).value);
    let vr1=toComplex(g(`p2_vres${num}_1_amp`),g(`p2_vres${num}_1_ang`));
    let vr2=toComplex(g(`p2_vres${num}_2_amp`),g(`p2_vres${num}_2_ang`));
    if (isNaN(vr1.r)||isNaN(vr2.r)) return alert("Preencha as vibrações residuais!");

    let t1=toPolar(divC(subC(mulC(vr2,alpha2p.a12),mulC(vr1,alpha2p.a22)),det2p));
    let t2=toPolar(divC(subC(mulC(vr1,alpha2p.a21),mulC(vr2,alpha2p.a11)),det2p));

    document.getElementById(`out_p2_trim${num}_1`).innerText = t1.amp.toFixed(2)+" g";
    document.getElementById(`out_p2_ang_trim${num}_1`).innerText = t1.phase.toFixed(1)+"°";
    document.getElementById(`out_p2_trim${num}_2`).innerText = t2.amp.toFixed(2)+" g";
    document.getElementById(`out_p2_ang_trim${num}_2`).innerText = t2.phase.toFixed(1)+"°";
    document.getElementById(`res-ref${num}-2p`).classList.remove('hidden');

    reportData.refinos[num-1]={ vres1:toPolar(vr1),vres2:toPolar(vr2),trim1:t1,trim2:t2 };
    let r1=reportData.refinos.filter(Boolean).map(r=>r.vres1);
    let r2=reportData.refinos.filter(Boolean).map(r=>r.vres2);
    renderCanvasPolar('chart-2p-1','Plano 1',reportData.v10,reportData.v11,reportData.vt11,reportData.mc1,r1);
    renderCanvasPolar('chart-2p-2','Plano 2',reportData.v20,reportData.v22,reportData.vt22,reportData.mc2,r2);
}

// ---- REPORT via jsPDF (works on Android/iOS PWA) ----
function generateReport(type) {
    if (!reportData.type || reportData.type !== type) return alert("Calcule os resultados primeiro!");

    const { jsPDF } = window.jspdf;
    if (!jsPDF) return alert("Biblioteca jsPDF não carregada. Verifique sua conexão.");

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(26, 35, 126);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont(undefined, 'bold');
    doc.text('Relatório de Balanceamento Dinâmico', pageW/2, 10, {align:'center'});
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text((type===1 ? '1 Plano' : '2 Planos') + '  |  ' + dateStr, pageW/2, 18, {align:'center'});

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12); doc.setFont(undefined, 'bold');
    doc.text('Dados do Balanceamento', 14, 30);
    doc.setFont(undefined, 'normal');

    // Table data
    let head, body;
    if (type === 1) {
        head = [['Parâmetro', 'Amplitude / Massa', 'Fase / Ângulo']];
        body = [
            ['Massa de Teste (mt)', reportData.mt.toFixed(2)+' g', '—'],
            ['Vibração Inicial (V0)', reportData.v0.amp.toFixed(2), reportData.v0.phase.toFixed(1)+'°'],
            ['Vibração c/ Massa (Vr)', reportData.vr.amp.toFixed(2), reportData.vr.phase.toFixed(1)+'°'],
            ['Vetor Efeito (Vt)', reportData.vt.amp.toFixed(2), reportData.vt.phase.toFixed(1)+'°'],
            ['CORREÇÃO FINAL', reportData.mc.amp.toFixed(2)+' g', reportData.mc.phase.toFixed(1)+'°'],
        ];
        reportData.refinos.forEach((r,i) => {
            if(r){
                body.push([`Vibração Residual ${i+1}`, r.vres.amp.toFixed(2), r.vres.phase.toFixed(1)+'°']);
                body.push([`Massa Refino ${i+1}`, r.trim.amp.toFixed(2)+' g', r.trim.phase.toFixed(1)+'°']);
            }
        });
    } else {
        head = [['Parâmetro', 'Plano 1', 'Plano 2']];
        body = [
            ['Massa de Teste', reportData.mt1.toFixed(2)+' g', reportData.mt2.toFixed(2)+' g'],
            ['Vibração Inicial V0', `${reportData.v10.amp.toFixed(2)} | ${reportData.v10.phase.toFixed(1)}°`, `${reportData.v20.amp.toFixed(2)} | ${reportData.v20.phase.toFixed(1)}°`],
            ['Ensaio 1 (Massa P1)', `${reportData.v11.amp.toFixed(2)} | ${reportData.v11.phase.toFixed(1)}°`, `${reportData.v21.amp.toFixed(2)} | ${reportData.v21.phase.toFixed(1)}°`],
            ['Ensaio 2 (Massa P2)', `${reportData.v12.amp.toFixed(2)} | ${reportData.v12.phase.toFixed(1)}°`, `${reportData.v22.amp.toFixed(2)} | ${reportData.v22.phase.toFixed(1)}°`],
            ['CORREÇÃO FINAL', `${reportData.mc1.amp.toFixed(2)} g | ${reportData.mc1.phase.toFixed(1)}°`, `${reportData.mc2.amp.toFixed(2)} g | ${reportData.mc2.phase.toFixed(1)}°`],
        ];
        reportData.refinos.forEach((r,i) => {
            if(r){
                body.push([`Vib. Residual ${i+1}`, `${r.vres1.amp.toFixed(2)} | ${r.vres1.phase.toFixed(1)}°`, `${r.vres2.amp.toFixed(2)} | ${r.vres2.phase.toFixed(1)}°`]);
                body.push([`Massa Refino ${i+1}`, `${r.trim1.amp.toFixed(2)} g | ${r.trim1.phase.toFixed(1)}°`, `${r.trim2.amp.toFixed(2)} g | ${r.trim2.phase.toFixed(1)}°`]);
            }
        });
    }

    doc.autoTable({
        head: head, body: body,
        startY: 34,
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [26,35,126], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240,242,255] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    });

    // Charts
    const canvasIds = type === 1 ? ['chart-1p'] : ['chart-2p-1','chart-2p-2'];
    let yPos = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(12); doc.setFont(undefined,'bold');
    doc.text('Gráficos Vetoriais Polares', 14, yPos);
    yPos += 6;

    canvasIds.forEach((id, idx) => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const imgData = canvas.toDataURL('image/png');
        const imgW = type === 1 ? 160 : 85;
        const imgH = imgW;
        const xPos = type === 1 ? (pageW - imgW)/2 : 14 + idx*(imgW + 6);
        if (yPos + imgH > 280) { doc.addPage(); yPos = 20; }
        doc.addImage(imgData, 'PNG', xPos, yPos, imgW, imgH);
    });

    doc.save('Relatorio_Balanceamento.pdf');
}
