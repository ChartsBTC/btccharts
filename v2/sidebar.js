/* v2-only chart sidebar. Not loaded on Classic or Advanced. */
(function(){
  if(typeof isV2Page!=='function'||!isV2Page()) return;
  if(typeof FIELDS==='undefined'||typeof buildHash!=='function'||typeof parseHash!=='function') return;

  const CHECKBOX=new Set(['c','x','v','cv','l','p','da','cy','ch','cl','hv','ll','pl','ep','rpl','rcl','pbp','blp','ott','rme','el','ss','sf']);
  const RESET={t:'S',m1:'10',m2:'25',ca:'low',cp:'usd',pma:'200d',pmm:'panel',rm:'cagr',rn:'4',pb:'1, 5, 20, 50, 80, 95, 99',blw:'50',ym:'raw',rb:'decade',sh:'current'};

  // Meaningful overrides only. Unspecified fields fall back to parseHash's
  // reset (combinedUSD, overlays off, empty range/interval/type) plus RESET.
  // Each link is later serialized with buildHash's rules so it is a complete
  // permalink and parseHash replaces prior state instead of merging.
  const GROUPS=[
    {name:'Price', items:[
      {id:'price', label:'Price', set:{r:'60',i:'',t:'S',v:true,rcl:true}},
      {id:'price-log', label:'Price, all data (log)', set:{r:'',i:'Daily',t:'C',l:true,v:true}},
      {id:'loglog', label:'Log-log', set:{r:'',i:'Daily',t:'C',ll:true}},
      {id:'yearly', label:'Yearly candles', set:{r:'',i:'Yearly',t:'S',l:true,v:true}},
      {id:'current-cycle', label:'Current cycle', set:{r:'ccurrent',i:'Daily',t:'S',l:true,v:true}}
    ]},
    {name:'Cycles', items:[
      {id:'cycles', label:'Cycles', set:{cy:true,ca:'low',cp:'usd',r:'',i:'Daily'}},
      {id:'cycles-low', label:'Scaled to cycle low', set:{cy:true,ca:'low',cp:'low',r:'',i:'Daily'}},
      {id:'cycles-high', label:'Scaled to cycle high', set:{cy:true,ca:'low',cp:'high',r:'',i:'Daily'}},
      {id:'cycles-day0', label:'Scaled to day 0', set:{cy:true,ca:'low',cp:'day0',r:'',i:'Daily'}},
      {id:'cycles-align-high', label:'Aligned by cycle high', set:{cy:true,ca:'high',cp:'usd',r:'',i:'Daily'}},
      {id:'cycles-halving', label:'Aligned by halving', set:{cy:true,ca:'halving',cp:'usd',r:'',i:'Daily'}},
      {id:'cycles-calendar', label:'4-year calendar', set:{cy:true,ca:'calendar',cp:'usd',r:'',i:'Daily'}},
      {id:'hcycles', label:'Halving cycles', set:{vt:'hcycles',r:'',i:'Daily'}},
      {id:'spiral', label:'Bitcoin Spiral', set:{vt:'spiral',r:'',i:'Daily'}},
      {id:'spiral-2011', label:'Spiral from 2011', set:{vt:'spiral',sf:true,r:'',i:'Daily'}}
    ]},
    {name:'Valuation / models', items:[
      {id:'powerlaw', label:'Power Law', set:{vt:'powerlaw',r:'',i:'Daily'}},
      {id:'powerlaw-blend', label:'Power Law, blended', set:{vt:'powerlaw',blp:true,r:'',i:'Daily'}},
      {id:'mayer', label:'Mayer Multiple', set:{rp:'mayer',r:'',i:'Daily',t:'C',l:true}},
      {id:'price-pl', label:'Price / Power Law', set:{rp:'pl',pl:true,r:'',i:'Daily',t:'C',l:true}},
      {id:'mayer-bands', label:'Percentile bands', set:{rp:'mayer',pbp:true,r:'',i:'Daily',t:'C',l:true}}
    ]},
    {name:'Returns', items:[
      {id:'drawdown', label:'Drawdown from ATH', set:{vt:'drawdown',r:'',i:'Daily'}},
      {id:'ath', label:'ATHs', set:{vt:'ath',r:'',i:'Daily'}},
      {id:'annualreturns', label:'Annual Returns', set:{vt:'annualreturns',r:'',i:'Daily'}},
      {id:'returns-cagr', label:'Rolling 4-year CAGR', set:{vt:'returns',rm:'cagr',rn:'4',r:'',i:'Daily'}},
      {id:'returns-mult', label:'Rolling 1-year multiple', set:{vt:'returns',rm:'mult',r:'',i:'Daily'}},
      {id:'calyear', label:'Calendar years', set:{vt:'calyear',ym:'raw',r:'',i:'Daily'}},
      {id:'calyear-idx', label:'Calendar years, indexed', set:{vt:'calyear',ym:'idx',r:'',i:'Daily'}},
      {id:'onthisday', label:'On this day', set:{vt:'onthisday',r:'',i:'Daily'}},
      {id:'ranges', label:'Days in price ranges', set:{vt:'ranges',rb:'decade',r:'',i:'Daily'}},
      {id:'epoch', label:'Epoch candles', set:{vt:'epoch',r:'',i:'Daily'}}
    ]},
    {name:'Averages', items:[
      {id:'sma-200d', label:'200-day SMA', set:{vt:'pricema',pma:'200d',pmm:'panel',r:'',i:'Daily'}},
      {id:'sma-100w', label:'100-week SMA', set:{vt:'pricema',pma:'100w',pmm:'panel',r:'',i:'Daily'}},
      {id:'sma-200w', label:'200-week SMA', set:{vt:'pricema',pma:'200w',pmm:'panel',r:'',i:'Daily'}},
      {id:'sma-osc', label:'Percentile oscillator', set:{vt:'pricema',pma:'200d',pmm:'osc',r:'',i:'Daily'}},
      {id:'neverdown', label:'200w average never down', set:{vt:'200wnevrdown',r:'',i:'Daily'}}
    ]},
    {name:'Macro comparisons', items:[
      {id:'spxgold', label:'S&P 500 vs Gold', set:{sp:'spxgold'}},
      {id:'btc-gold', label:'Bitcoin / Gold', set:{cm:'goldUSD',r:'',i:'Daily',t:'C',l:true}},
      {id:'btc-cpi', label:'Bitcoin / CPI', set:{cm:'cpiAUCSL',r:'',i:'Daily',t:'C',l:true}},
      {id:'btc-spx', label:'Bitcoin vs S&P 500', set:{cm:'spx',r:'',i:'Daily',t:'C',l:true}},
      {id:'gold', label:'Gold', set:{m:'goldUSD',r:'',i:'Daily',t:'C',l:true}},
      {id:'spx', label:'S&P 500', set:{m:'spx',r:'',i:'Daily',t:'C',l:true}}
    ]},
    {name:'Units', items:[
      {id:'sats', label:'Sats per dollar', set:{vt:'sats',r:'',i:'Daily'}}
    ]}
  ];

  function isBox(id){
    const e=document.getElementById(id);
    if(e) return e.type==='checkbox';
    return CHECKBOX.has(id);
  }
  function expandSet(set){
    const out={m:'combinedUSD'};
    if(set&&set.sp&&typeof SCOUT_PRESETS==='object'&&SCOUT_PRESETS[set.sp]){
      Object.assign(out, SCOUT_PRESETS[set.sp]);
    }
    Object.assign(out, set||{});
    return out;
  }
  function stateFrom(set){
    const state={}, over=expandSet(set);
    for(const id of FIELDS){
      if(isBox(id)) state[id]=false;
      else state[id]=RESET[id]||'';
    }
    state.m='combinedUSD';
    for(const [k,val] of Object.entries(over)){
      if(!FIELDS.includes(k)) continue;
      state[k]=isBox(k)?!!val:(val==null?'':String(val));
    }
    return state;
  }
  function hashFromSet(set){
    const state=stateFrom(set);
    const h=[];
    for(const id of FIELDS){
      const e=document.getElementById(id);
      if(!e) continue;
      const val=state[id];
      if(isBox(id)){ if(val) h.push(id); }
      else if(val) h.push(id+'g'+escape(val));
      else if(id==='i') h.push('igauto');
      else if(id==='t') h.push('tgnone');
    }
    return h.join('z');
  }
  function stripDk(hash){
    return String(hash||'').replace(/^#/,'').split('z').filter(p=>p&&p!=='dk').join('z');
  }
  // "On this day" writes today's MM-DD into the hash after render. Treat that
  // default as equivalent to an omitted otd so the sidebar link stays "today".
  function todayOtd(){
    const n=new Date();
    return String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
  }
  function canonHash(hash){
    const today='otdg'+todayOtd();
    return stripDk(hash).split('z').filter(p=>p&&p!==today).join('z');
  }
  function currentCanon(){
    try{return canonHash(buildHash())}catch(e){return canonHash(location.hash)}
  }

  let applying=false;
  function applyHash(hash, push){
    const h=stripDk(hash);
    const dark=typeof isDark==='function'&&isDark();
    applying=true;
    try{
      parseHash(h);
      if($('sp')&&typeof SCOUT_PRESETS==='object'&&SCOUT_PRESETS[$('sp').value]){
        if(typeof applyScoutPreset==='function') applyScoutPreset($('sp').value);
      }
      if(typeof syncCustom==='function') syncCustom();
      if(typeof syncViewToggle==='function') syncViewToggle();
      if(typeof applyV2PermalinkDefaults==='function') applyV2PermalinkDefaults();
      if(dark&&typeof applyTheme==='function') applyTheme(true,{skipSave:true});
      if(typeof draw==='function') draw(push===false?0:1);
    }finally{
      applying=false;
      syncActive();
    }
  }

  function itemByHash(hash){
    const want=stripDk(hash);
    for(const g of GROUPS){
      for(const it of g.items){
        if(canonHash(it.hash)===canonHash(want)) return it;
      }
    }
    return null;
  }

  function syncActive(){
    const nav=document.getElementById('v2Nav');
    if(!nav) return;
    const cur=currentCanon();
    nav.querySelectorAll('a[data-chart]').forEach(a=>{
      const on=canonHash(a.getAttribute('href'))===cur;
      a.classList.toggle('on', on);
      if(on) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
  }

  function isMobile(){return window.matchMedia&&window.matchMedia('(max-width:960px)').matches}
  function setOpen(open){
    const sb=document.getElementById('v2Sidebar');
    const btn=document.getElementById('v2SidebarToggle');
    if(!sb) return;
    sb.classList.toggle('open', !!open);
    document.body.classList.toggle('v2-sidebar-open', !!open);
    if(btn){
      btn.setAttribute('aria-expanded', open?'true':'false');
      btn.textContent=open?'Charts ▴':'Charts ▾';
    }
  }

  function render(){
    for(const g of GROUPS){
      for(const it of g.items) it.hash=hashFromSet(it.set);
    }
    const shell=document.createElement('div');
    shell.className='v2-shell';
    const aside=document.createElement('aside');
    aside.id='v2Sidebar';
    aside.innerHTML='<button type="button" id="v2SidebarToggle" aria-controls="v2Nav" aria-expanded="false">Charts ▾</button><nav id="v2Nav" aria-label="Charts"></nav>';
    const nav=aside.querySelector('#v2Nav');
    GROUPS.forEach(g=>{
      const h=document.createElement('h6');
      h.textContent=g.name;
      nav.appendChild(h);
      const ul=document.createElement('ul');
      g.items.forEach(it=>{
        const li=document.createElement('li');
        const a=document.createElement('a');
        a.href='#'+it.hash;
        a.dataset.chart=it.id;
        a.textContent=it.label;
        li.appendChild(a);
        ul.appendChild(li);
      });
      nav.appendChild(ul);
    });
    const main=document.createElement('div');
    main.className='v2-main';
    const form=document.getElementById('chartoptions');
    const content=document.getElementById('content_chart');
    const sub=document.querySelector('.submenu');
    const parent=form.parentNode;
    parent.insertBefore(shell, form);
    shell.appendChild(aside);
    shell.appendChild(main);
    main.appendChild(form);
    if(content) main.appendChild(content);
    form.classList.remove('wrap');
    if(content) content.classList.remove('wrap');

    aside.querySelector('#v2SidebarToggle').addEventListener('click',()=>{
      setOpen(!aside.classList.contains('open'));
    });
    nav.addEventListener('click',e=>{
      const a=e.target.closest('a[data-chart]');
      if(!a) return;
      e.preventDefault();
      applyHash(a.getAttribute('href'), true);
      if(isMobile()) setOpen(false);
    });

    // Keep the active highlight in sync when Draw / back / replaceState update the hash.
    const wrap=fn=>{
      return function(){
        const ret=fn.apply(this, arguments);
        if(!applying) syncActive();
        return ret;
      };
    };
    history.pushState=wrap(history.pushState.bind(history));
    history.replaceState=wrap(history.replaceState.bind(history));
    window.addEventListener('popstate', syncActive);

    setOpen(false);
    syncActive();
    window.V2_SIDEBAR_GROUPS=GROUPS;
    window.applyV2ChartHash=applyHash;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
