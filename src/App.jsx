import React, { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const WHITE_TABLE = {
  "24-35": [1.80, 2.78, 3.64, 4.55, 5.47, 6.39, 7.30, 8.22, 9.17, 10.11, 11.05, 11.71],
  "36-71": [1.60, 2.33, 2.98, 3.69, 4.39, 5.13, 5.83, 6.54, 7.25, 7.96, 8.66, 9.09],
  "72-143": [1.16, 1.48, 1.77, 2.12, 2.50, 2.86, 3.24, 3.60, 4.06, 4.53, 4.99, 5.46],
  "144-287": [0.85, 1.05, 1.21, 1.41, 1.58, 1.74, 2.00, 2.22, 2.42, 2.64, 2.90, 3.15],
  "250+": [0.74, 0.87, 0.97, 1.12, 1.29, 1.44, 1.62, 1.79, 1.97, 2.17, 2.40, 2.65],
};

const DARK_TABLE = {
  "24-35": [2.82, 3.71, 4.70, 5.53, 6.46, 7.30, 8.29, 9.23, 10.17, 10.96, 11.46, 12.46],
  "36-71": [2.40, 3.05, 3.76, 4.46, 5.22, 5.93, 6.63, 7.34, 8.04, 8.74, 9.16, 9.59],
  "72-143": [1.55, 1.84, 2.20, 2.58, 2.93, 3.31, 3.73, 4.14, 4.55, 4.96, 5.38, 5.63],
  "144-287": [1.12, 1.29, 1.48, 1.65, 1.82, 2.07, 2.29, 2.49, 2.71, 2.97, 3.31, 3.35],
  "250+": [0.94, 1.04, 1.20, 1.36, 1.51, 1.69, 1.87, 2.04, 2.25, 2.48, 2.71, 2.78],
};

const ADDL = {
  pocket: 0.30,
  sleeveShort: 0.22,
  sleeveLong: 0.25,
  colorChangePerColorPerLoc: 10.0,
  specialtyInkFlatIfUnder100: 25.0,
  specialtyInkPerImprint: 0.30,
  numberingPerDigit: 2.0,
  personalizationPerName: 5.0,
  sweatshirts: 0.30,
  sweatpants_ziphoodies: 0.30,
  tanks_polos_shorts: 0.22,
  polyester: 0.22,
  uncommonPlacement: 0.22,
  aprons: 0.22,
  towels_bandanas: 0.22,
  toteBags: 0.22,
  unbagging: 0.17,
  polybagging: 0.45,
  barcodes: 0.25,
  tearAwayRemoval: 0.50,
  cutOutRemoval: 0.60,
};

const SCREEN_CHARGE_STANDARD = 25.0;
const SCREEN_CHARGE_REORDER = 10.0;

function tierFromQty(qty){ if(qty<=35) return "24-35"; if(qty<=71) return "36-71"; if(qty<=143) return "72-143"; if(qty<=287) return "144-287"; return "250+"; }
function pickPrice(colorCount,isDark,qty){ const table=isDark?DARK_TABLE:WHITE_TABLE; const tier=tierFromQty(qty); const idx=Math.min(Math.max(colorCount,1),12)-1; return table[tier][idx]; }

export default function App(){
  const [customer,setCustomer]=useState("Iconic Brand");
  const [jobName,setJobName]=useState("");
  const [qty,setQty]=useState(48);
  const [garmentColor,setGarmentColor]=useState("white");
  const [garmentType,setGarmentType]=useState({sweatshirts:false,sweatpants_ziphoodies:false,tanks_polos_shorts:false,polyester:false,aprons:false,towels_bandanas:false,toteBags:false});
  const [packaging,setPackaging]=useState({unbagging:0,polybagging:0,barcodes:0,tearAwayRemoval:0,cutOutRemoval:0});
  const [personalization,setPersonalization]=useState({numberingItems:0,numberingDigitsEach:2,namesCount:0});
  const [locations,setLocations]=useState([{id:crypto.randomUUID(),name:"Front",colors:2,isSleeve:"none",abovePocket:false,uncommonPlacement:false,specialtyInk:false,colorChanges:0,screensOverride:null,reorderScreens:false}]);

  const pdfRef = useRef(null);
  const isDark = garmentColor==="dark";

  const addLocation=()=>setLocations(prev=>[...prev,{id:crypto.randomUUID(),name:`Loc ${prev.length+1}`,colors:1,isSleeve:"none",abovePocket:false,uncommonPlacement:false,specialtyInk:false,colorChanges:0,screensOverride:null,reorderScreens:false}]);
  const removeLocation=(id)=>setLocations(prev=>prev.filter(l=>l.id!==id));

  // Export current quote view to a multi-page PDF
  const exportPDF = async () => {
    const node = pdfRef.current;
    if (!node) return;
    // Ensure white background for clean PDF
    const prev = node.style.backgroundColor;
    node.style.backgroundColor = "#ffffff";
    const canvas = await html2canvas(node, {
      scale: 2,            // sharper text
      backgroundColor: "#ffffff",
      useCORS: true
    });
    node.style.backgroundColor = prev;

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = canvas.height * imgWidth / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const fileName = `Iconic-Pricing-${(customer || "Quote").replace(/[^a-z0-9-_ ]/gi,"")}.pdf`;
    pdf.save(fileName);
  };

  const computed = useMemo(()=>{
    const tier=tierFromQty(qty);
    const perItemPrintCosts=locations.map(loc=>pickPrice(loc.colors,isDark,qty));
    const basePrintPerItem=perItemPrintCosts.reduce((a,b)=>a+b,0);
    const sleevePerItem=locations.reduce((s,loc)=>s+(loc.isSleeve==="short"?ADDL.sleeveShort:loc.isSleeve==="long"?ADDL.sleeveLong:0),0);
    const pocketPerItem=locations.reduce((s,loc)=>s+(loc.abovePocket?ADDL.pocket:0),0);
    const uncommonPerItem=locations.reduce((s,loc)=>s+(loc.uncommonPlacement?ADDL.uncommonPlacement:0),0);
    const specialtyPerItem=locations.reduce((s,loc)=>s+(loc.specialtyInk?ADDL.specialtyInkPerImprint:0),0);
    const totalImprints=qty*locations.length;
    const specialtyFlat=locations.some(l=>l.specialtyInk)&&totalImprints<100?ADDL.specialtyInkFlatIfUnder100:0;
    const garmentPerItem=(garmentType.sweatshirts?ADDL.sweatshirts:0)+(garmentType.sweatpants_ziphoodies?ADDL.sweatpants_ziphoodies:0)+(garmentType.tanks_polos_shorts?ADDL.tanks_polos_shorts:0)+(garmentType.polyester?ADDL.polyester:0)+(garmentType.aprons?ADDL.aprons:0)+(garmentType.towels_bandanas?ADDL.towels_bandanas:0)+(garmentType.toteBags?ADDL.toteBags:0);
    const perItemSubtotal=basePrintPerItem+sleevePerItem+pocketPerItem+uncommonPerItem+specialtyPerItem+garmentPerItem;
    const screensDetail=locations.map(loc=>{ const screenCount=loc.screensOverride!=null?(loc.screensOverride||0):loc.colors; const perScreen=loc.reorderScreens?SCREEN_CHARGE_REORDER:SCREEN_CHARGE_STANDARD; const total=screenCount*perScreen; return {name: loc.name, screenCount, perScreen, total}; });
    const screensFlat=screensDetail.reduce((a,b)=>a+b.total,0);
    const colorChangesFlat=locations.reduce((s,loc)=>s+loc.colorChanges*loc.colors*ADDL.colorChangePerColorPerLoc,0);
    const numberingFlat=personalization.numberingItems*personalization.numberingDigitsEach*ADDL.numberingPerDigit;
    const namesFlat=personalization.namesCount*ADDL.personalizationPerName;
    const packagingFlat=(packaging.unbagging*ADDL.unbagging)+(packaging.polybagging*ADDL.polybagging)+(packaging.barcodes*ADDL.barcodes)+(packaging.tearAwayRemoval*ADDL.tearAwayRemoval)+(packaging.cutOutRemoval*ADDL.cutOutRemoval);
    const itemsSubtotal=perItemSubtotal*qty;
    const flatSubtotal=screensFlat+colorChangesFlat+numberingFlat+namesFlat+packagingFlat+specialtyFlat;
    const grandTotal=itemsSubtotal+flatSubtotal;
    const unitPrice=grandTotal/Math.max(qty, 1);
    return {tier,perItem:{basePrintPerItem,sleevePerItem,pocketPerItem,uncommonPerItem,specialtyPerItem,garmentPerItem,perItemSubtotal},flat:{screensDetail,screensFlat,colorChangesFlat,numberingFlat,namesFlat,packagingFlat,specialtyFlat,flatSubtotal},itemsSubtotal,flatSubtotal,grandTotal,unitPrice};
  },[qty,locations,isDark,garmentType,packaging,personalization]);

  const reset=()=>{
    setCustomer("Iconic Brand"); setJobName(""); setQty(48); setGarmentColor("white");
    setGarmentType({sweatshirts:false,sweatpants_ziphoodies:false,tanks_polos_shorts:false,polyester:false,aprons:false,towels_bandanas:false,toteBags:false});
    setPackaging({unbagging:0,polybagging:0,barcodes:0,tearAwayRemoval:0,cutOutRemoval:0});
    setPersonalization({numberingItems:0,numberingDigitsEach:2,namesCount:0});
    setLocations([{id:crypto.randomUUID(),name:"Front",colors:2,isSleeve:"none",abovePocket:false,uncommonPlacement:false,specialtyInk:false,colorChanges:0,screensOverride:null,reorderScreens:false}]);
  };

  return (
    <div style={{background:"#f7f7f8"}}>
      {/* Controls */}
      <div className="no-print" style={{maxWidth:1100,margin:"16px auto",padding:"0 16px",display:"flex",justifyContent:"flex-end",gap:8}}>
        <button onClick={reset}>Reset</button>
        <button onClick={()=>window.print()}>Print</button>
        <button onClick={exportPDF}><strong>Export PDF</strong></button>
      </div>

      {/* Export area */}
      <div ref={pdfRef} style={{maxWidth:1100,margin:"0 auto",padding:"16px",background:"#ffffff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><h1 style={{marginBottom:6}}>Screen Printing Pricing — Iconic Brand</h1><div style={{color:"#666",fontSize:13}}>Vercel + Vite (React)</div></div>
          <div style={{fontSize:12,color:"#666"}}>{new Date().toLocaleString()}</div>
        </div>

        <div style={{border:"1px solid #e9eaeb",borderRadius:12,padding:16,marginTop:12,display:"grid",gap:12,gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
          <div><div>Customer</div><input value={customer} onChange={e=>setCustomer(e.target.value)}/></div>
          <div><div>Job / PO</div><input value={jobName} onChange={e=>setJobName(e.target.value)} placeholder="PO12345 – Iconic Spring Tee"/></div>
          <div><div>Quantity</div><input type="number" min={1} value={qty} onChange={e=>setQty(parseInt(e.target.value||"0",10))}/><div style={{fontSize:12,color:"#666"}}>Tier: {computed.tier}</div></div>
        </div>

        <div style={{border:"1px solid #e9eaeb",borderRadius:12,padding:16,marginTop:12}}>
          <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
            <div><div>Garment Color</div><select value={garmentColor} onChange={e=>setGarmentColor(e.target.value)}><option value="white">White / Light</option><option value="dark">Dark</option></select></div>
            <div style={{gridColumn:"span 2"}}>
              <div style={{display:"grid",gap:8,gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
                {[["sweatshirts","Sweatshirts +$0.30"],["sweatpants_ziphoodies","Sweatpants/Zip Hoodies +$0.30"],["tanks_polos_shorts","Tanks/Polos/Shorts +$0.22"],["polyester","Polyester +$0.22"],["aprons","Aprons +$0.22"],["towels_bandanas","Small Towels/Bandanas +$0.22"],["toteBags","Tote Bags +$0.22"]].map(([k,l])=>(
                <label key={k} style={{display:"flex",alignItems:"center",gap:6}}>
                  <input type="checkbox" checked={garmentType[k]} onChange={e=>setGarmentType(g=>({...g,[k]:e.target.checked}))}/> {l}
                </label>
              ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{border:"1px solid #e9eaeb",borderRadius:12,padding:16,marginTop:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{margin:0}}>Print Locations</h3><button className="no-print" onClick={addLocation}>+ Add Location</button></div>
          {locations.map(loc=>(
            <div key={loc.id} style={{display:"grid",gap:12,gridTemplateColumns:"repeat(12,minmax(0,1fr))",alignItems:"end",border:"1px dashed #e5e7eb",padding:12,borderRadius:12,marginTop:10}}>
              <div style={{gridColumn:"span 3"}}>
                <div>Location Name</div>
                <input value={loc.name} onChange={e=>setLocations(a=>a.map(l=>l.id===loc.id?{...l,name:e.target.value}:l))}/>
                <div style={{fontSize:12,color:"#666"}}>Base ${pickPrice(loc.colors,isDark,qty).toFixed(2)} / item</div>
              </div>
              <div style={{gridColumn:"span 2"}}>
                <div>Colors</div>
                <input type="number" min={1} max={12} value={loc.colors} onChange={e=>setLocations(a=>a.map(l=>l.id===loc.id?{...l,colors:Math.max(1,Math.min(12,parseInt(e.target.value||"0",10)))}:l))}/>
              </div>
              <div style={{gridColumn:"span 2"}}>
                <div>Sleeve?</div>
                <select value={loc.isSleeve} onChange={e=>setLocations(a=>a.map(l=>l.id===loc.id?{...l,isSleeve:e.target.value}:l))}>
                  <option value="none">No</option>
                  <option value="short">Short (+$0.22)</option>
                  <option value="long">Long (+$0.25)</option>
                </select>
              </div>
              <div style={{gridColumn:"span 2"}}>
                <div>Screens (optional)</div>
                <input type="number" min={0} placeholder={String(loc.colors)} value={loc.screensOverride ?? ""} onChange={e=>setLocations(a=>a.map(l=>l.id===loc.id?{...l,screensOverride:e.target.value===""?null:parseInt(e.target.value||"0",10)}:l))}/>
                <label style={{fontSize:12,color:"#666",display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                  <input type="checkbox" checked={!!loc.reorderScreens} onChange={e=>setLocations(a=>a.map(l=>l.id===loc.id?{...l,reorderScreens:e.target.checked}:l))}/> Reorder screens ($10/screen)
                </label>
              </div>
              <div style={{gridColumn:"span 3"}}>
                <label style={{display:"flex",alignItems:"center",gap:6}}><input type="checkbox" checked={loc.abovePocket} onChange={e=>setLocations(a=>a.map(l=>l.id===loc.id?{...l,abovePocket:e.target.checked}:l))}/> Above/On Pocket +$0.30</label>
                <label style={{display:"flex",alignItems:"center",gap:6}}><input type="checkbox" checked={loc.uncommonPlacement} onChange={e=>setLocations(a=>a.map(l=>l.id===loc.id?{...l,uncommonPlacement:e.target.checked}:l))}/> Uncommon Placement +$0.22</label>
                <label style={{display:"flex",alignItems:"center",gap:6}}><input type="checkbox" checked={loc.specialtyInk} onChange={e=>setLocations(a=>a.map(l=>l.id===loc.id?{...l,specialtyInk:e.target.checked}:l))}/> Specialty Ink +$0.30/imprint</label>
                <div>
                  <div>Color Changes (count)</div>
                  <input type="number" min={0} value={loc.colorChanges} onChange={e=>setLocations(a=>a.map(l=>l.id===loc.id?{...l,colorChanges:Math.max(0,parseInt(e.target.value||"0",10))}:l))}/>
                  <div style={{fontSize:12,color:"#666"}}>$10 × colors × changes</div>
                </div>
              </div>
              {locations.length>1 && <div style={{gridColumn:"span 12",display:"flex",justifyContent:"flex-end"}}><button className="no-print" onClick={()=>removeLocation(loc.id)} style={{color:"#c1121f"}}>Remove Location</button></div>}
            </div>
          ))}
        </div>

        <div style={{border:"1px solid #e9eaeb",borderRadius:12,padding:16,marginTop:12,display:"grid",gap:12,gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}>
          <div>
            <h3>Personalization</h3>
            <div style={{display:"grid",gap:10,gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
              <div><div># Items Numbered</div><input type="number" min={0} value={personalization.numberingItems} onChange={e=>setPersonalization(p=>({...p,numberingItems:Math.max(0,parseInt(e.target.value||"0",10))}))}/></div>
              <div><div>Digits / Item</div><input type="number" min={1} value={personalization.numberingDigitsEach} onChange={e=>setPersonalization(p=>({...p,numberingDigitsEach:Math.max(1,parseInt(e.target.value||"1",10))}))}/></div>
              <div><div># Names</div><input type="number" min={0} value={personalization.namesCount} onChange={e=>setPersonalization(p=>({...p,namesCount:Math.max(0,parseInt(e.target.value||"0",10))}))}/></div>
            </div>
            <div style={{fontSize:12,color:"#666"}}>Numbering $2/digit, Names $5/name.</div>
          </div>

          <div>
            <h3>Packaging & Handling</h3>
            <div style={{display:"grid",gap:10,gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
              <div><div>Unbagging qty (+$0.17 ea)</div><input type="number" min={0} value={packaging.unbagging} onChange={e=>setPackaging(x=>({...x,unbagging:Math.max(0,parseInt(e.target.value||"0",10))}))}/></div>
              <div><div>Polybagging qty (+$0.45 ea)</div><input type="number" min={0} value={packaging.polybagging} onChange={e=>setPackaging(x=>({...x,polybagging:Math.max(0,parseInt(e.target.value||"0",10))}))}/></div>
              <div><div>Barcodes qty (+$0.25 ea)</div><input type="number" min={0} value={packaging.barcodes} onChange={e=>setPackaging(x=>({...x,barcodes:Math.max(0,parseInt(e.target.value||"0",10))}))}/></div>
              <div><div>Tear-Away Tags qty (+$0.50 ea)</div><input type="number" min={0} value={packaging.tearAwayRemoval} onChange={e=>setPackaging(x=>({...x,tearAwayRemoval:Math.max(0,parseInt(e.target.value||"0",10))}))}/></div>
              <div><div>Cut-Out Tags qty (+$0.60 ea)</div><input type="number" min={0} value={packaging.cutOutRemoval} onChange={e=>setPackaging(x=>({...x,cutOutRemoval:Math.max(0,parseInt(e.target.value||"0",10))}))}/></div>
            </div>
            <div style={{fontSize:12,color:"#666"}}>If Specialty Ink selected and total imprints &lt; 100, a flat $25 is added.</div>
          </div>
        </div>

        <div style={{border:"1px solid #e9eaeb",borderRadius:12,padding:16,marginTop:12}}>
          <h3>Quote Summary</h3>
          <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
            <div style={{border:"1px solid #e9eaeb",borderRadius:12,padding:12}}>
              <div style={{color:"#666",fontSize:12}}>Per-Item Subtotal</div>
              <div style={{fontSize:28,fontWeight:700}}>${computed.perItem.perItemSubtotal.toFixed(2)}</div>
              <ul style={{fontSize:12,color:"#666"}}>
                <li>Base print: ${computed.perItem.basePrintPerItem.toFixed(2)}</li>
                {computed.perItem.sleevePerItem > 0 && <li>Sleeve add: ${computed.perItem.sleevePerItem.toFixed(2)}</li>}
                {computed.perItem.pocketPerItem > 0 && <li>Pocket add: ${computed.perItem.pocketPerItem.toFixed(2)}</li>}
                {computed.perItem.uncommonPerItem > 0 && <li>Uncommon: ${computed.perItem.uncommonPerItem.toFixed(2)}</li>}
                {computed.perItem.specialtyPerItem > 0 && <li>Specialty ink: ${computed.perItem.specialtyPerItem.toFixed(2)}/imprint</li>}
                {computed.perItem.garmentPerItem > 0 && <li>Garment adds: ${computed.perItem.garmentPerItem.toFixed(2)}</li>}
              </ul>
            </div>
            <div style={{border:"1px solid #e9eaeb",borderRadius:12,padding:12}}>
              <div style={{color:"#666",fontSize:12}}>Flat Adds</div>
              <div style={{fontSize:28,fontWeight:700}}>${computed.flat.flatSubtotal.toFixed(2)}</div>
              <ul style={{fontSize:12,color:"#666"}}>
                <li>Screens: ${computed.flat.screensFlat.toFixed(2)}</li>
                {computed.flat.colorChangesFlat > 0 && <li>Color changes: ${computed.flat.colorChangesFlat.toFixed(2)}</li>}
                {computed.flat.numberingFlat > 0 && <li>Numbering: ${computed.flat.numberingFlat.toFixed(2)}</li>}
                {computed.flat.namesFlat > 0 && <li>Names: ${computed.flat.namesFlat.toFixed(2)}</li>}
                {computed.flat.packagingFlat > 0 && <li>Packaging: ${computed.flat.packagingFlat.toFixed(2)}</li>}
                {computed.flat.specialtyFlat > 0 && <li>Specialty flat: ${computed.flat.specialtyFlat.toFixed(2)}</li>}
              </ul>
            </div>
            <div style={{border:"1px solid #e9eaeb",borderRadius:12,padding:12}}>
              <div style={{color:"#666",fontSize:12}}>Totals</div>
              <div style={{fontSize:28,fontWeight:700}}>${computed.grandTotal.toFixed(2)}</div>
              <div style={{color:"#666"}}>= ${computed.itemsSubtotal.toFixed(2)} (items) + ${computed.flat.flatSubtotal.toFixed(2)} (flat)</div>
              <div style={{marginTop:8,fontSize:18}}>Unit Price: <strong>${computed.unitPrice.toFixed(2)}</strong></div>
            </div>
          </div>

          <div style={{marginTop:14}}>
            <h4>Screens Breakdown</h4>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr><th>Location</th><th>Screens</th><th>Rate</th><th>Total</th></tr></thead>
                <tbody>
                  {computed.flat.screensDetail.map((row,i)=>(
                    <tr key={i}>
                      <td>{row.name}</td>
                      <td>{row.screenCount}</td>
                      <td>${row.perScreen.toFixed(2)}/screen</td>
                      <td>${row.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{color:"#666",fontSize:12,marginTop:8}}>© {new Date().getFullYear()} Promos Ink — Internal estimator for Iconic Brand pricing.</div>
      </div>
    </div>
  );
}
