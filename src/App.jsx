import { useState, useMemo } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

const NAVY = "#1e3a5f";
const SKY = "#bcddea";
const ORANGE = "#ea6827";
const COLORS = [NAVY, "#2a7a9b", ORANGE];
const LABELS = ["Cautious","Balanced","Growth"];

const fmt = n => new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format(n);
const fmtShort = n => n>=1000000?`£${(n/1000000).toFixed(1)}m`:n>=1000?`£${(n/1000).toFixed(0)}k`:fmt(n);
const pct = v => `${parseFloat(v).toFixed(1)}%`;
const realRate = (nom,inf) => ((1+nom/100)/(1+inf/100)-1)*100;

function pmtCalc(pv,fvTarget,rReal,years){
  if(years<=0)return 0;
  if(Math.abs(rReal)<0.0001)return Math.max(0,(fvTarget-pv)/(years*12));
  const mr=rReal/100/12,m=years*12,f=Math.pow(1+mr,m);
  return Math.max(0,(fvTarget-pv*f)/((f-1)/mr));
}

function buildDrawdown(startPot,annualWithdrawal,rReal,additionalIncomes,maxYears=80){
  const pts=[{year:0,balance:Math.round(startPot)}];
  let bal=startPot;
  const r=rReal/100;
  for(let y=1;y<=maxYears;y++){
    const extra=additionalIncomes.reduce((s,inc)=>s+(y>(+inc.startsAfter||0)&&+inc.amount>0?+inc.amount:0),0);
    const net=Math.max(0,annualWithdrawal-extra);
    bal=bal*(1+r)-net;
    if(bal<=0){pts.push({year:y,balance:0});break;}
    pts.push({year:y,balance:Math.round(bal)});
  }
  return pts;
}

function depletionYear(startPot,annualWithdrawal,rReal,additionalIncomes,maxYears=80){
  let bal=startPot;
  const r=rReal/100;
  for(let y=1;y<=maxYears;y++){
    const extra=additionalIncomes.reduce((s,inc)=>s+(y>(+inc.startsAfter||0)&&+inc.amount>0?+inc.amount:0),0);
    bal=bal*(1+r)-Math.max(0,annualWithdrawal-extra);
    if(bal<=0)return y;
  }
  return null;
}

const inputCls="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;font-size:14px;outline:none;background:white;font-family:'Nunito',sans-serif;";
const iCls="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white transition-all outline-none";
const lCls="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide";

function Card({children,className=""}){return <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`} style={{borderRadius:16,background:"white",boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:24,marginBottom:0}}>{children}</div>;}

function PrimaryBtn({onClick,disabled,children}){
  return <button disabled={disabled} onClick={onClick} style={{background:disabled?"#ccc":ORANGE,color:"white",width:"100%",border:"none",borderRadius:8,padding:"10px 0",fontSize:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:"'Nunito',sans-serif",opacity:disabled?0.6:1}}>{children}</button>;
}
function BackBtn({onClick}){
  return <button onClick={onClick} style={{flex:1,border:"1px solid #e5e7eb",background:"white",color:"#4b5563",borderRadius:8,padding:"10px 0",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>← Back</button>;
}
const emptyIncome=()=>({name:"",amount:"",startsAfter:""});

function Tab({active,onClick,children}){
  return(
    <button onClick={onClick} style={{background:active?ORANGE:"transparent",color:active?"white":"#6b7280",border:active?"none":"1px solid #e5e7eb",borderRadius:8,padding:"8px 16px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>
      {children}
    </button>
  );
}

function StepDot({n,current}){
  return <div style={{width:28,height:28,borderRadius:"50%",background:current>=n?ORANGE:"#e5e7eb",color:current>=n?"white":"#9ca3af",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>{n}</div>;
}

export default function App(){
  const [step,setStep]=useState(1);
  const [mode,setMode]=useState("plan");
  const [goalName,setGoalName]=useState("");
  const [lumpSum,setLumpSum]=useState("");
  const [annualIncome,setAnnualIncome]=useState("");
  const [withdrawalRate,setWithdrawalRate]=useState("4");
  const [inflation,setInflation]=useState("2.5");
  const [current,setCurrent]=useState("");
  const [years,setYears]=useState("");
  const [rates,setRates]=useState({r1:"4",r2:"6",r3:"8"});
  const [additionalIncomes,setAdditionalIncomes]=useState([emptyIncome(),emptyIncome()]);
  const [nowPot,setNowPot]=useState("");
  const [nowIncome,setNowIncome]=useState("");
  const [nowWithdrawalRate,setNowWithdrawalRate]=useState("4");
  const [nowGoalName,setNowGoalName]=useState("");
  const [nowAdditionalIncomes,setNowAdditionalIncomes]=useState([emptyIncome(),emptyIncome()]);

  const updateIncome=(idx,field,val)=>{const u=[...additionalIncomes];u[idx]={...u[idx],[field]:val};setAdditionalIncomes(u);};
  const updateNowIncome=(idx,field,val)=>{const u=[...nowAdditionalIncomes];u[idx]={...u[idx],[field]:val};setNowAdditionalIncomes(u);};

  const activeIncomes=additionalIncomes.filter(inc=>inc.amount&&+inc.amount>0&&inc.name);
  const activeNowIncomes=nowAdditionalIncomes.filter(inc=>inc.amount&&+inc.amount>0&&inc.name);
  const incomeTarget=annualIncome&&withdrawalRate?(+annualIncome/(+withdrawalRate/100)):0;
  const lumpTarget=+lumpSum||0;
  const totalTarget=lumpTarget+incomeTarget;
  const rateArr=[+rates.r1,+rates.r2,+rates.r3];
  const inf=+inflation;
  const realRates=rateArr.map(r=>realRate(r,inf));
  const pv=+current,yrs=+years;

  const pmts=useMemo(()=>realRates.map(r=>pmtCalc(pv,totalTarget,r,yrs)),[pv,totalTarget,yrs,rates.r1,rates.r2,rates.r3,inflation]);

  const projections=useMemo(()=>{
    if(!totalTarget||!yrs)return null;
    return realRates.map((r,i)=>{
      const pts=[];
      for(let y=0;y<=yrs;y++){
        const m=y*12,mr=r/100/12;
        const existing=Math.abs(r)<0.0001?pv:pv*Math.pow(1+mr,m);
        const contributions=Math.abs(r)<0.0001?pmts[i]*m:pmts[i]*(Math.pow(1+mr,m)-1)/mr;
        pts.push({year:y,existing:Math.round(existing),contributions:Math.round(contributions),total:Math.round(existing+contributions)});
      }
      return pts;
    });
  },[pv,totalTarget,yrs,pmts,...realRates]);

  const drawdownRows=useMemo(()=>{
    if(!incomeTarget||!annualIncome)return null;
    const all=realRates.map(r=>buildDrawdown(incomeTarget,+annualIncome,r,activeIncomes));
    const maxLen=Math.max(...all.map(a=>a.length));
    return Array.from({length:maxLen},(_,i)=>{const row={year:i};all.forEach((pts,si)=>{row[LABELS[si]]=pts[i]?pts[i].balance:0;});return row;});
  },[incomeTarget,annualIncome,activeIncomes,...realRates]);

  const depletionYears=useMemo(()=>{
    if(!incomeTarget||!annualIncome)return null;
    return realRates.map(r=>depletionYear(incomeTarget,+annualIncome,r,activeIncomes));
  },[incomeTarget,annualIncome,activeIncomes,...realRates]);

  const depletionYearsBase=useMemo(()=>{
    if(!incomeTarget||!annualIncome)return null;
    return realRates.map(r=>depletionYear(incomeTarget,+annualIncome,r,[]));
  },[incomeTarget,annualIncome,...realRates]);

  const nowPotVal=+nowPot||0;
  const nowIncomeVal=+nowIncome||0;
  const nowAnnualWithdrawal=nowIncomeVal>0?nowIncomeVal:(nowWithdrawalRate&&nowPotVal?nowPotVal*(+nowWithdrawalRate/100):0);
  const impliedWithdrawalPct=nowPotVal>0&&nowAnnualWithdrawal>0?((nowAnnualWithdrawal/nowPotVal)*100):0;

  const nowDrawdownRows=useMemo(()=>{
    if(!nowPotVal||!nowAnnualWithdrawal)return null;
    const all=realRates.map(r=>buildDrawdown(nowPotVal,nowAnnualWithdrawal,r,activeNowIncomes));
    const maxLen=Math.max(...all.map(a=>a.length));
    return Array.from({length:maxLen},(_,i)=>{const row={year:i};all.forEach((pts,si)=>{row[LABELS[si]]=pts[i]?pts[i].balance:0;});return row;});
  },[nowPotVal,nowAnnualWithdrawal,activeNowIncomes,...realRates]);

  const nowDepletionYears=useMemo(()=>{
    if(!nowPotVal||!nowAnnualWithdrawal)return null;
    return realRates.map(r=>depletionYear(nowPotVal,nowAnnualWithdrawal,r,activeNowIncomes));
  },[nowPotVal,nowAnnualWithdrawal,activeNowIncomes,...realRates]);

  const nowDepletionBase=useMemo(()=>{
    if(!nowPotVal||!nowAnnualWithdrawal)return null;
    return realRates.map(r=>depletionYear(nowPotVal,nowAnnualWithdrawal,r,[]));
  },[nowPotVal,nowAnnualWithdrawal,...realRates]);

  const progress=totalTarget>0?Math.min(100,(pv/totalTarget)*100):0;
  const valid1=goalName&&(lumpSum||annualIncome)&&inflation;
  const valid2=current!==""&&years&&+years>0;
  const valid3=rates.r1&&rates.r2&&rates.r3;
  const validNow=nowPotVal>0&&nowAnnualWithdrawal>0&&rates.r1&&rates.r2&&rates.r3;
  const stepLabels=["Target","Savings","Returns","Results"];

  const Input=({label,value,onChange,type="text",placeholder,hint})=>(
    <div>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
      <input type={type} placeholder={placeholder} value={value} onChange={onChange}
        style={{width:"100%",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:14,outline:"none",background:"white",fontFamily:"'Nunito',sans-serif"}}
        onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
      {hint&&<p style={{fontSize:11,color:"#9ca3af",marginTop:4}}>{hint}</p>}
    </div>
  );

  const SectionTitle=({children,color=NAVY})=>(
    <p style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em",color,marginBottom:12}}>{children}</p>
  );

  const AdditionalIncomeInputs=({incomes,update})=>(
    <div>
      <SectionTitle color={NAVY}>Additional Income Sources <span style={{color:"#9ca3af",fontWeight:400,textTransform:"none"}}>(optional)</span></SectionTitle>
      <p style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>E.g. State Pension, DB pension — reduces the withdrawal from your fund once they start.</p>
      {[0,1].map(idx=>(
        <div key={idx} style={{background:"#f8fafc",borderRadius:12,padding:16,border:"1px solid #f1f5f9",marginBottom:12}}>
          <p style={{fontSize:11,fontWeight:700,color:NAVY,marginBottom:10}}>Income source {idx+1}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <Input label="Name" placeholder="e.g. State Pension" value={incomes[idx].name} onChange={e=>update(idx,"name",e.target.value)}/>
            <Input label="Annual amount (£)" type="number" placeholder="e.g. 11500" value={incomes[idx].amount} onChange={e=>update(idx,"amount",e.target.value)}/>
            <Input label="Starts after (yrs)" type="number" placeholder="e.g. 2" value={incomes[idx].startsAfter} onChange={e=>update(idx,"startsAfter",e.target.value)} hint="0 = immediately"/>
          </div>
        </div>
      ))}
    </div>
  );

  const ReturnRateInputs=()=>(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
      {[["r1","Cautious"],["r2","Balanced"],["r3","Growth"]].map(([key,label],i)=>(
        <div key={key}>
          <Input label={`${label} (%)`} type="number" placeholder={["4","6","8"][i]} value={rates[key]} onChange={e=>setRates({...rates,[key]:e.target.value})}/>
          {rates[key]&&<p style={{fontSize:11,fontWeight:700,color:ORANGE,marginTop:4}}>Real: {pct(realRate(+rates[key],+inflation))}</p>}
        </div>
      ))}
    </div>
  );

  const DrawdownSection=({drawdownData,depYears,depYearsBase,annWithdrawal,addIncomes,title,subtitle})=>{
    if(!drawdownData||!annWithdrawal)return null;
    return(
      <div style={{background:"white",borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:24}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:16}}>
          <div style={{width:32,height:32,borderRadius:8,background:"#fff4ee",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{color:ORANGE,fontWeight:800,fontSize:16}}>!</span>
          </div>
          <div>
            <h3 style={{fontSize:14,fontWeight:800,color:NAVY,margin:0}}>{title}</h3>
            <p style={{fontSize:12,color:"#9ca3af",margin:0}}>{subtitle}</p>
          </div>
        </div>

        {addIncomes.length>0&&(
          <div style={{background:"#f7fbfd",borderRadius:12,padding:16,border:`1px dashed ${SKY}`,marginBottom:20}}>
            <p style={{fontSize:11,fontWeight:800,color:NAVY,marginBottom:8}}>Additional income reducing fund withdrawals:</p>
            {addIncomes.map((inc,i)=>(
              <div key={i} style={{display:"flex",flexWrap:"wrap",gap:"8px 16px",fontSize:12,marginBottom:4}}>
                <span style={{fontWeight:700,color:"#374151"}}>{inc.name}</span>
                <span style={{fontWeight:700,color:ORANGE}}>{fmt(+inc.amount)}/yr</span>
                <span style={{color:"#9ca3af"}}>{+inc.startsAfter>0?`starts year ${inc.startsAfter}`:"from retirement"}</span>
                <span style={{color:"#9ca3af"}}>Net withdrawal: <strong style={{color:"#374151"}}>{fmt(Math.max(0,annWithdrawal-+inc.amount))}/yr</strong></span>
              </div>
            ))}
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
          {rateArr.map((r,i)=>{
            const dy=depYears[i];
            const dyBase=depYearsBase[i];
            const extra=addIncomes.length>0&&dy&&dyBase?(dy-dyBase):null;
            return(
              <div key={i} style={{background:dy?"#fff5f5":"#f0faf4",border:`1px solid ${dy?"#fecaca":"#bbf7d0"}`,borderRadius:12,padding:16,textAlign:"center"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:COLORS[i]}}/>
                  <span style={{fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em"}}>{LABELS[i]}</span>
                </div>
                {dy?(
                  <>
                    <p style={{fontSize:28,fontWeight:900,color:"#c0392b",margin:0}}>{dy} yrs</p>
                    <p style={{fontSize:11,color:"#9ca3af",marginTop:4}}>fund depleted</p>
                    {extra!==null&&extra>0&&<p style={{fontSize:11,fontWeight:800,color:"#16a34a",marginTop:8}}>+{extra} yrs longer</p>}
                  </>
                ):(
                  <>
                    <p style={{fontSize:18,fontWeight:900,color:"#16a34a",margin:0}}>Sustainable</p>
                    <p style={{fontSize:11,color:"#9ca3af",marginTop:4}}>fund never runs out</p>
                  </>
                )}
                <p style={{fontSize:11,fontWeight:700,color:NAVY,marginTop:8}}>{pct(realRates[i])} real</p>
              </div>
            );
          })}
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={drawdownData} margin={{top:5,right:10,left:10,bottom:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="year" tickFormatter={v=>`Yr ${v}`} tick={{fontSize:10,fill:"#9ca3af"}} tickLine={false} label={{value:"Years in retirement",position:"insideBottom",offset:-10,fontSize:10,fill:"#9ca3af"}}/>
            <YAxis tickFormatter={fmtShort} tick={{fontSize:10,fill:"#9ca3af"}} tickLine={false} axisLine={false}/>
            <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{borderRadius:8,border:"1px solid #e5e7eb",fontSize:11}} labelFormatter={v=>`Year ${v} in retirement`}/>
            <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11}}/>
            <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5}/>
            {addIncomes.filter(inc=>+inc.startsAfter>0).map((inc,i)=>(
              <ReferenceLine key={i} x={+inc.startsAfter} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1.5} label={{value:inc.name,position:"top",fontSize:9,fill:"#10b981"}}/>
            ))}
            {LABELS.map((l,i)=>(
              <Line key={l} type="monotone" dataKey={l} stroke={COLORS[i]} strokeWidth={2.5} dot={false}/>
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div style={{marginTop:16,background:"#f8f9fa",borderRadius:8,padding:"12px 16px",fontSize:12,color:"#6b7280"}}>
          <strong style={{color:NAVY}}>How to read this:</strong> The chart shows the fund balance year-by-year in retirement. Where additional incomes begin, the rate of decline slows (green dashed lines). All figures in today's money using real returns.
        </div>
      </div>
    );
  };

  const s={gap:8,display:"flex",flexDirection:"column"};

  return(
    <div style={{minHeight:"100vh",background:"#f9fafb",fontFamily:"'Nunito',sans-serif"}}>

      {/* Header */}
      <div style={{background:NAVY,padding:"16px 24px"}}>
        <div style={{maxWidth:860,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:10,background:ORANGE,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:"white"}}>C</div>
            <div>
              <h1 style={{color:"white",fontWeight:800,fontSize:16,margin:0,lineHeight:1.2}}>Cartesian Wealth Limited</h1>
              <p style={{color:SKY,fontSize:12,margin:0,fontWeight:500}}>Guiding you towards your financial goals</p>
            </div>
          </div>
          <p style={{color:"white",fontSize:12,fontWeight:600,opacity:0.6}}>Financial Goal Planner</p>
        </div>
      </div>
      <div style={{background:ORANGE,height:4}}/>

      <div style={{maxWidth:860,margin:"0 auto",padding:"32px 16px"}}>

        {/* Mode tabs */}
        <div style={{display:"flex",gap:8,marginBottom:32,background:"#f0f5fa",padding:4,borderRadius:12,width:"fit-content"}}>
          <Tab active={mode==="plan"} onClick={()=>{setMode("plan");setStep(1);}}>📈 Plan towards a goal</Tab>
          <Tab active={mode==="now"} onClick={()=>setMode("now")}>💰 Draw from existing fund now</Tab>
        </div>

        {/* PLAN MODE */}
        {mode==="plan"&&(
          <>
            {/* Step indicator */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:32}}>
              {[1,2,3,4].map((s,i)=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:8}}>
                  <StepDot n={s} current={step}/>
                  <span style={{fontSize:12,fontWeight:700,color:step===s?"#374151":"#9ca3af",display:"none"}} className="sm-show">{stepLabels[i]}</span>
                  {s<4&&<div style={{width:24,height:1,background:step>s?ORANGE:"#e5e7eb"}}/>}
                </div>
              ))}
            </div>

            {step===1&&(
              <div style={{background:"white",borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:24}}>
                <h2 style={{color:NAVY,fontWeight:800,fontSize:18,marginBottom:4}}>Step 1 — Calculate your target</h2>
                <p style={{color:"#9ca3af",fontSize:14,marginBottom:24}}>All amounts in <strong>today's money</strong>.</p>
                <div style={s}>
                  <Input label="Goal name" placeholder="e.g. Retirement" value={goalName} onChange={e=>setGoalName(e.target.value)}/>
                  <Input label="Assumed inflation rate (%)" type="number" placeholder="2.5" value={inflation} onChange={e=>setInflation(e.target.value)} hint="Used to convert nominal returns to real returns."/>
                  <hr style={{border:"none",borderTop:"1px solid #f3f4f6",margin:"4px 0"}}/>
                  <SectionTitle color={ORANGE}>Lump Sum Goal</SectionTitle>
                  <Input label="Lump sum needed in today's money (£)" type="number" placeholder="e.g. 100000" value={lumpSum} onChange={e=>setLumpSum(e.target.value)}/>
                  <hr style={{border:"none",borderTop:"1px solid #f3f4f6",margin:"4px 0"}}/>
                  <SectionTitle color={ORANGE}>Retirement Income Goal</SectionTitle>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <Input label="Desired annual income (£)" type="number" placeholder="e.g. 30000" value={annualIncome} onChange={e=>setAnnualIncome(e.target.value)}/>
                    <Input label="Safe withdrawal rate (%)" type="number" placeholder="4" value={withdrawalRate} onChange={e=>setWithdrawalRate(e.target.value)}/>
                  </div>
                  {annualIncome&&withdrawalRate&&(
                    <div style={{background:"#fff4ee",border:"1px solid #fcd9c4",borderRadius:8,padding:"12px 16px",fontSize:14,fontWeight:700,color:ORANGE}}>
                      Required pot for income: {fmt(incomeTarget)} <span style={{fontSize:12,fontWeight:400,opacity:0.7}}>({fmt(+annualIncome)} ÷ {pct(withdrawalRate)})</span>
                    </div>
                  )}
                  <hr style={{border:"none",borderTop:"1px solid #f3f4f6",margin:"4px 0"}}/>
                  <AdditionalIncomeInputs incomes={additionalIncomes} update={updateIncome}/>
                  {totalTarget>0&&(
                    <div style={{background:"#f0f5fa",border:`1px solid ${NAVY}`,borderRadius:12,padding:"12px 16px"}}>
                      <p style={{fontSize:11,color:"#6b7280",marginBottom:4}}>Combined target (today's money)</p>
                      <p style={{fontSize:28,fontWeight:900,color:NAVY,margin:0}}>{fmt(totalTarget)}</p>
                      {lumpTarget>0&&incomeTarget>0&&<p style={{fontSize:12,color:"#9ca3af",marginTop:4}}>{fmt(lumpTarget)} lump sum + {fmt(incomeTarget)} income pot</p>}
                    </div>
                  )}
                  <div style={{marginTop:8}}><PrimaryBtn disabled={!valid1} onClick={()=>setStep(2)}>Continue →</PrimaryBtn></div>
                </div>
              </div>
            )}

            {step===2&&(
              <div style={{background:"white",borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:24}}>
                <h2 style={{color:NAVY,fontWeight:800,fontSize:18,marginBottom:4}}>Step 2 — Your current position</h2>
                <p style={{color:"#9ca3af",fontSize:14,marginBottom:24}}>How much have you already saved, and over what timeframe?</p>
                <div style={s}>
                  <Input label="Existing savings / investments (£)" type="number" placeholder="e.g. 25000" value={current} onChange={e=>setCurrent(e.target.value)}/>
                  <Input label="Investment timeframe (years)" type="number" placeholder="e.g. 20" value={years} onChange={e=>setYears(e.target.value)}/>
                  {current&&totalTarget>0&&(
                    <div style={{background:"#f0f5fa",borderRadius:12,padding:"12px 16px"}}>
                      <p style={{fontSize:11,color:"#6b7280",marginBottom:4}}>Already saved towards target</p>
                      <p style={{fontSize:22,fontWeight:900,color:NAVY,margin:0}}>{fmt(+current)} <span style={{fontSize:14,fontWeight:400,color:"#9ca3af"}}>of {fmt(totalTarget)} ({Math.min(100,(+current/totalTarget*100)).toFixed(1)}%)</span></p>
                      <div style={{height:8,background:"#e5e7eb",borderRadius:8,marginTop:8,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(100,+current/totalTarget*100)}%`,background:ORANGE,borderRadius:8}}/>
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",gap:12,marginTop:8}}>
                    <BackBtn onClick={()=>setStep(1)}/>
                    <PrimaryBtn disabled={!valid2} onClick={()=>setStep(3)}>Continue →</PrimaryBtn>
                  </div>
                </div>
              </div>
            )}

            {step===3&&(
              <div style={{background:"white",borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:24}}>
                <h2 style={{color:NAVY,fontWeight:800,fontSize:18,marginBottom:4}}>Step 3 — Return rate scenarios</h2>
                <p style={{color:"#9ca3af",fontSize:14,marginBottom:20}}>Enter nominal annual returns. Real returns shown automatically.</p>
                <ReturnRateInputs/>
                <div style={{display:"flex",gap:12,marginTop:24}}>
                  <BackBtn onClick={()=>setStep(2)}/>
                  <PrimaryBtn disabled={!valid3} onClick={()=>setStep(4)}>View Results →</PrimaryBtn>
                </div>
              </div>
            )}

            {step===4&&projections&&(
              <div style={{display:"flex",flexDirection:"column",gap:24}}>
                {/* Summary */}
                <div style={{background:"white",borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:24}}>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:16}}>
                    <div>
                      <p style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:"0.05em"}}>Goal · Today's Money</p>
                      <h2 style={{fontSize:24,fontWeight:900,color:NAVY,margin:"4px 0"}}>{goalName}</h2>
                      <p style={{fontSize:13,color:"#9ca3af"}}>{yrs}-year plan · Inflation: {pct(inflation)} · Target: {fmt(totalTarget)}</p>
                      {activeIncomes.length>0&&(
                        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                          {activeIncomes.map((inc,i)=>(
                            <span key={i} style={{fontSize:11,background:"#fff4ee",color:ORANGE,borderRadius:20,padding:"2px 10px",fontWeight:700}}>
                              {inc.name}: {fmt(+inc.amount)}/yr {+inc.startsAfter>0?`after yr ${inc.startsAfter}`:"from retirement"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={()=>setStep(1)} style={{fontSize:12,fontWeight:700,border:`1px solid ${ORANGE}`,color:ORANGE,background:"white",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>Edit inputs</button>
                  </div>
                  <div style={{fontSize:12,color:"#9ca3af",display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span>Current savings: {fmt(pv)}</span><span>{progress.toFixed(1)}% of target</span>
                  </div>
                  <div style={{height:12,background:"#e5e7eb",borderRadius:8,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${progress}%`,background:ORANGE,borderRadius:8}}/>
                  </div>
                  <p style={{fontSize:11,color:"#9ca3af",textAlign:"right",marginTop:4}}>Target: {fmt(totalTarget)}</p>
                </div>

                {/* Scenario cards */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                  {rateArr.map((r,i)=>(
                    <div key={i} style={{background:"white",borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:20}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:COLORS[i]}}/>
                        <span style={{fontSize:11,fontWeight:800,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em"}}>{LABELS[i]}</span>
                      </div>
                      <p style={{fontSize:12,color:"#9ca3af",marginBottom:2}}>Nominal: <strong style={{color:"#374151"}}>{pct(r)}</strong></p>
                      <p style={{fontSize:12,color:"#9ca3af",marginBottom:12}}>Real: <strong style={{color:ORANGE}}>{pct(realRates[i])}</strong></p>
                      <p style={{fontSize:26,fontWeight:900,color:NAVY,margin:0}}>{fmt(pmts[i])}</p>
                      <p style={{fontSize:11,color:"#9ca3af",marginTop:4,marginBottom:12}}>per month needed</p>
                      <div style={{borderTop:"1px solid #f3f4f6",paddingTop:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                          <span style={{color:"#9ca3af"}}>Existing pot grows to</span>
                          <span style={{fontWeight:700,color:"#374151"}}>{fmt(projections[i][yrs].existing)}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                          <span style={{color:"#9ca3af"}}>Contributions grow to</span>
                          <span style={{fontWeight:700,color:"#374151"}}>{fmt(projections[i][yrs].contributions)}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,borderTop:"1px solid #f3f4f6",paddingTop:8}}>
                          <span style={{fontWeight:700,color:"#374151"}}>Total projected</span>
                          <span style={{fontWeight:900,color:NAVY}}>{fmt(projections[i][yrs].total)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Growth charts */}
                <div style={{background:"white",borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:24}}>
                  <h3 style={{color:NAVY,fontWeight:800,fontSize:14,marginBottom:4}}>Projected Growth by Scenario</h3>
                  <p style={{fontSize:12,color:"#9ca3af",marginBottom:24}}>Existing savings vs new contributions · Real terms</p>
                  {rateArr.map((r,i)=>(
                    <div key={i} style={{marginBottom:32}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:COLORS[i]}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#374151"}}>{LABELS[i]} · {pct(r)} nominal / {pct(realRates[i])} real</span>
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={projections[i]} margin={{top:5,right:10,left:10,bottom:0}}>
                          <defs>
                            <linearGradient id={`eg${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.35}/><stop offset="95%" stopColor={COLORS[i]} stopOpacity={0.05}/>
                            </linearGradient>
                            <linearGradient id={`cg${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={ORANGE} stopOpacity={0.35}/><stop offset="95%" stopColor={ORANGE} stopOpacity={0.05}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                          <XAxis dataKey="year" tickFormatter={v=>`Yr ${v}`} tick={{fontSize:10,fill:"#9ca3af"}} tickLine={false}/>
                          <YAxis tickFormatter={fmtShort} tick={{fontSize:10,fill:"#9ca3af"}} tickLine={false} axisLine={false}/>
                          <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{borderRadius:8,border:"1px solid #e5e7eb",fontSize:11}} labelFormatter={v=>`Year ${v}`}/>
                          <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:11}}/>
                          <Area type="monotone" dataKey="existing" name="Existing savings" stroke={COLORS[i]} fill={`url(#eg${i})`} strokeWidth={2} stackId="1"/>
                          <Area type="monotone" dataKey="contributions" name="New contributions" stroke={ORANGE} fill={`url(#cg${i})`} strokeWidth={2} stackId="1"/>
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ))}
                </div>

                {drawdownRows&&annualIncome&&(
                  <DrawdownSection
                    drawdownData={drawdownRows} depYears={depletionYears} depYearsBase={depletionYearsBase}
                    annWithdrawal={+annualIncome} addIncomes={activeIncomes}
                    title="Fund Erosion in Drawdown"
                    subtitle={`Starting pot: ${fmt(incomeTarget)} · Gross withdrawal: ${fmt(+annualIncome)}/yr${activeIncomes.length>0?" · reduced by additional income sources":""}`}
                  />
                )}

                {/* Summary table */}
                <div style={{background:"white",borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:24}}>
                  <h3 style={{color:NAVY,fontWeight:800,fontSize:14,marginBottom:16}}>Key Numbers Summary · Today's Money</h3>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                      <thead>
                        <tr style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.05em",color:NAVY,borderBottom:"1px solid #f3f4f6"}}>
                          {["Scenario","Real Return","Monthly","Existing →","Contributions →","Total",...(depletionYears?["Fund lasts"]:[])].map(h=>(
                            <th key={h} style={{padding:"0 0 12px",textAlign:h==="Scenario"?"left":"right",fontWeight:800}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rateArr.map((r,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid #f9fafb"}}>
                            <td style={{padding:"12px 0",fontWeight:700,color:"#374151"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <div style={{width:8,height:8,borderRadius:"50%",background:COLORS[i]}}/>
                                {LABELS[i]}
                              </div>
                            </td>
                            <td style={{padding:"12px 0",textAlign:"right",fontWeight:700,color:ORANGE}}>{pct(realRates[i])}</td>
                            <td style={{padding:"12px 0",textAlign:"right",fontWeight:900,color:NAVY}}>{fmt(pmts[i])}</td>
                            <td style={{padding:"12px 0",textAlign:"right",color:"#6b7280"}}>{fmt(projections[i][yrs].existing)}</td>
                            <td style={{padding:"12px 0",textAlign:"right",color:"#6b7280"}}>{fmt(projections[i][yrs].contributions)}</td>
                            <td style={{padding:"12px 0",textAlign:"right",fontWeight:900,color:NAVY}}>{fmt(projections[i][yrs].total)}</td>
                            {depletionYears&&<td style={{padding:"12px 0",textAlign:"right",fontWeight:800,color:depletionYears[i]?"#c0392b":"#16a34a"}}>{depletionYears[i]?`${depletionYears[i]} yrs`:"Sustainable"}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{background:"#f0f5fa",borderRadius:12,padding:"16px 20px",textAlign:"center"}}>
                  <p style={{fontSize:12,fontWeight:800,color:NAVY,marginBottom:4}}>Cartesian Wealth Limited</p>
                  <p style={{fontSize:11,color:"#9ca3af"}}>For illustrative purposes only. All projections are in today's money using real (inflation-adjusted) returns. Past performance is not a guide to future returns. Fund erosion projections assume fixed income withdrawals and do not account for variable spending, tax, or charges. This tool does not constitute financial advice.</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* DRAW NOW MODE */}
        {mode==="now"&&(
          <div style={{display:"flex",flexDirection:"column",gap:24}}>
            <div style={{background:"white",borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",border:"1px solid #f3f4f6",padding:24}}>
              <h2 style={{color:NAVY,fontWeight:800,fontSize:18,marginBottom:4}}>Draw from existing fund now</h2>
              <p style={{color:"#9ca3af",fontSize:14,marginBottom:24}}>See how long your current fund will last if you start drawing income today. All figures in <strong>today's money</strong>.</p>
              <div style={s}>
                <Input label="Client / scenario name (optional)" placeholder="e.g. Early retirement scenario" value={nowGoalName} onChange={e=>setNowGoalName(e.target.value)}/>
                <Input label="Assumed inflation rate (%)" type="number" placeholder="2.5" value={inflation} onChange={e=>setInflation(e.target.value)}/>
                <hr style={{border:"none",borderTop:"1px solid #f3f4f6"}}/>
                <Input label="Current fund value (£)" type="number" placeholder="e.g. 250000" value={nowPot} onChange={e=>setNowPot(e.target.value)}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <Input label="Desired annual income (£)" type="number" placeholder="e.g. 20000" value={nowIncome} onChange={e=>setNowIncome(e.target.value)} hint="Leave blank to derive from withdrawal rate."/>
                  <Input label="Withdrawal rate (%)" type="number" placeholder="4" value={nowWithdrawalRate} onChange={e=>setNowWithdrawalRate(e.target.value)} hint="Used if no income entered above."/>
                </div>
                {nowPotVal>0&&nowAnnualWithdrawal>0&&(
                  <div style={{background:"#fff4ee",border:"1px solid #fcd9c4",borderRadius:8,padding:"12px 16px",fontSize:14,fontWeight:700,color:ORANGE}}>
                    Annual withdrawal: {fmt(nowAnnualWithdrawal)} · Effective rate: {pct(impliedWithdrawalPct)}
                  </div>
                )}
                <hr style={{border:"none",borderTop:"1px solid #f3f4f6"}}/>
                <SectionTitle color={NAVY}>Return rate scenarios</SectionTitle>
                <ReturnRateInputs/>
                <hr style={{border:"none",borderTop:"1px solid #f3f4f6"}}/>
                <AdditionalIncomeInputs incomes={nowAdditionalIncomes} update={updateNowIncome}/>
              </div>
            </div>

            {validNow&&nowDrawdownRows&&nowDepletionYears&&(
              <>
                {nowGoalName&&(
                  <div style={{background:NAVY,borderRadius:12,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <p style={{color:"white",fontWeight:800,margin:0}}>{nowGoalName}</p>
                      <p style={{color:SKY,fontSize:12,margin:0}}>Fund: {fmt(nowPotVal)} · Income: {fmt(nowAnnualWithdrawal)}/yr · Inflation: {pct(inflation)}</p>
                    </div>
                    <div style={{width:32,height:32,borderRadius:8,background:ORANGE,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"white"}}>C</div>
                  </div>
                )}
                <DrawdownSection
                  drawdownData={nowDrawdownRows} depYears={nowDepletionYears} depYearsBase={nowDepletionBase}
                  annWithdrawal={nowAnnualWithdrawal} addIncomes={activeNowIncomes}
                  title="How long will the fund last?"
                  subtitle={`Starting fund: ${fmt(nowPotVal)} · Withdrawal: ${fmt(nowAnnualWithdrawal)}/yr (${pct(impliedWithdrawalPct)})${activeNowIncomes.length>0?" · plus additional income sources":""}`}
                />
                <div style={{background:"#f0f5fa",borderRadius:12,padding:"16px 20px",textAlign:"center"}}>
                  <p style={{fontSize:12,fontWeight:800,color:NAVY,marginBottom:4}}>Cartesian Wealth Limited</p>
                  <p style={{fontSize:11,color:"#9ca3af"}}>For illustrative purposes only. All projections are in today's money using real (inflation-adjusted) returns. Past performance is not a guide to future returns. Projections assume fixed income withdrawals and do not account for variable spending, tax, or charges. This tool does not constitute financial advice.</p>
                </div>
              </>
            )}
            {!validNow&&(
              <div style={{background:"white",borderRadius:16,border:"1px dashed #e5e7eb",padding:48,textAlign:"center"}}>
                <p style={{fontSize:24,marginBottom:8}}>💰</p>
                <p style={{fontSize:14,fontWeight:800,color:NAVY}}>Enter your fund details above</p>
                <p style={{fontSize:12,color:"#9ca3af",marginTop:4}}>Results will appear here automatically.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
