/* v2-only chart sidebar. Not loaded on Classic or Advanced. */
(function(){
  if(typeof isV2Page!=='function'||!isV2Page()) return;
  if(typeof FIELDS==='undefined'||typeof buildHash!=='function'||typeof parseHash!=='function') return;

  const CHECKBOX=new Set(['c','x','v','cv','l','p','da','cy','ch','cl','hv','ll','pl','ep','rpl','rcl','pbp','blp','ott','rme','el','ss','sf']);
  const RESET={t:'S',m1:'10',m2:'25',ca:'low',cp:'usd',pma:'200d',pmm:'panel',rm:'cagr',rn:'4',pb:'1, 5, 20, 50, 80, 95, 99',blw:'50',ym:'raw',rb:'decade',sh:'current'};
  const STACK_MQ='(max-width:1100px)';

  // Same set objects / ids as v2.3-sidebar. Labels and grouping changed only.
  const GROUPS=[
    {name:'Price', items:[
      {id:'price', label:'Price', set:{r:'60',i:'',t:'S',v:true,rcl:true}},
      {id:'price-log', label:'Price (log, all data)', set:{r:'',i:'Daily',t:'C',l:true,v:true}},
      {id:'loglog', label:'Log-log', set:{r:'',i:'Daily',t:'C',ll:true}},
      {id:'yearly', label:'Yearly candles', set:{r:'',i:'Yearly',t:'S',l:true,v:true}},
      {id:'current-cycle', label:'Current cycle', set:{r:'ccurrent',i:'Daily',t:'S',l:true,v:true}},
      {id:'sats', label:'Sats per dollar', set:{vt:'sats',r:'',i:'Daily'}}
    ]},
    {name:'Cycles', more:'Cycle layouts', items:[
      {id:'cycles', label:'Cycles', set:{cy:true,ca:'low',cp:'usd',r:'',i:'Daily'}},
      {id:'hcycles', label:'Halving cycles', set:{vt:'hcycles',r:'',i:'Daily'}},
      {id:'spiral', label:'Bitcoin Spiral', set:{vt:'spiral',r:'',i:'Daily'}},
      {id:'epoch', label:'Epoch candles', set:{vt:'epoch',r:'',i:'Daily'}}
    ], extra:[
      {id:'cycles-low', label:'Scaled to cycle low', set:{cy:true,ca:'low',cp:'low',r:'',i:'Daily'}},
      {id:'cycles-high', label:'Scaled to cycle high', set:{cy:true,ca:'low',cp:'high',r:'',i:'Daily'}},
      {id:'cycles-day0', label:'Scaled to day 0', set:{cy:true,ca:'low',cp:'day0',r:'',i:'Daily'}},
      {id:'cycles-align-high', label:'Aligned by cycle high', set:{cy:true,ca:'high',cp:'usd',r:'',i:'Daily'}},
      {id:'cycles-halving', label:'Aligned by halving', set:{cy:true,ca:'halving',cp:'usd',r:'',i:'Daily'}},
      {id:'cycles-calendar', label:'Aligned to 4-year calendar', set:{cy:true,ca:'calendar',cp:'usd',r:'',i:'Daily'}},
      {id:'spiral-2011', label:'Spiral from 2011', set:{vt:'spiral',sf:true,r:'',i:'Daily'}}
    ]},
    {name:'Valuation', more:'More valuation', items:[
      {id:'powerlaw', label:'Power Law', set:{vt:'powerlaw',r:'',i:'Daily'}},
      {id:'mayer', label:'Mayer Multiple', set:{rp:'mayer',r:'',i:'Daily',t:'C',l:true}},
      {id:'price-pl', label:'Price / Power Law', set:{rp:'pl',pl:true,r:'',i:'Daily',t:'C',l:true}}
    ], extra:[
      {id:'powerlaw-blend', label:'Power Law, blended', set:{vt:'powerlaw',blp:true,r:'',i:'Daily'}},
      {id:'mayer-bands', label:'Mayer percentile bands', set:{rp:'mayer',pbp:true,r:'',i:'Daily',t:'C',l:true}}
    ]},
    {name:'Returns', more:'More returns', items:[
      {id:'drawdown', label:'Drawdown from ATH', set:{vt:'drawdown',r:'',i:'Daily'}},
      {id:'ath', label:'All-time highs', set:{vt:'ath',r:'',i:'Daily'}},
      {id:'annualreturns', label:'Annual Returns', set:{vt:'annualreturns',r:'',i:'Daily'}},
      {id:'returns-cagr', label:'Rolling 4-year CAGR', set:{vt:'returns',rm:'cagr',rn:'4',r:'',i:'Daily'}},
      {id:'returns-mult', label:'Rolling 1-year multiple', set:{vt:'returns',rm:'mult',r:'',i:'Daily'}},
      {id:'calyear', label:'Calendar years', set:{vt:'calyear',ym:'raw',r:'',i:'Daily'}}
    ], extra:[
      {id:'calyear-idx', label:'Calendar years, indexed', set:{vt:'calyear',ym:'idx',r:'',i:'Daily'}}
    ]},
    {name:'History', items:[
      {id:'onthisday', label:'On this day', set:{vt:'onthisday',r:'',i:'Daily'}},
      {id:'ranges', label:'Days in price ranges', set:{vt:'ranges',rb:'decade',r:'',i:'Daily'}}
    ]},
    {name:'Averages', more:'More averages', items:[
      {id:'sma-200d', label:'200-day SMA', set:{vt:'pricema',pma:'200d',pmm:'panel',r:'',i:'Daily'}},
      {id:'sma-200w', label:'200-week SMA', set:{vt:'pricema',pma:'200w',pmm:'panel',r:'',i:'Daily'}},
      {id:'neverdown', label:'200-week average (never down)', set:{vt:'200wnevrdown',r:'',i:'Daily'}}
    ], extra:[
      {id:'sma-100w', label:'100-week SMA', set:{vt:'pricema',pma:'100w',pmm:'panel',r:'',i:'Daily'}},
      {id:'sma-osc', label:'MA percentile oscillator', set:{vt:'pricema',pma:'200d',pmm:'osc',r:'',i:'Daily'}}
    ]},
    {name:'Macro', items:[
      {id:'btc-gold', label:'Bitcoin / Gold', set:{cm:'goldUSD',r:'',i:'Daily',t:'C',l:true}},
      {id:'btc-spx', label:'Bitcoin / S&P 500', set:{cm:'spx',r:'',i:'Daily',t:'C',l:true}},
      {id:'btc-cpi', label:'Bitcoin / CPI', set:{cm:'cpiAUCSL',r:'',i:'Daily',t:'C',l:true}},
      {id:'gold', label:'Gold', set:{m:'goldUSD',r:'',i:'Daily',t:'C',l:true}},
      {id:'spx', label:'S&P 500', set:{m:'spx',r:'',i:'Daily',t:'C',l:true}},
      {id:'spxgold', label:'S&P 500 vs Gold', set:{sp:'spxgold'}}
    ]}
  ];

  function allItems(g){return (g.items||[]).concat(g.extra||[])}
  function everyItem(){
    const out=[];
    GROUPS.forEach(g=>allItems(g).forEach(it=>out.push(it)));
    return out;
  }

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
  function formState(){
    const state={};
    for(const id of FIELDS){
      const e=document.getElementById(id);
      if(!e) continue;
      state[id]=isBox(id)?!!e.checked:e.value;
    }
    return state;
  }

  function stripDk(hash){
    return String(hash||'').replace(/^#/,'').split('z').filter(p=>p&&p!=='dk').join('z');
  }
  function todayOtd(){
    const n=new Date();
    return String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
  }
  function canonHash(hash){
    const today='otdg'+todayOtd();
    return stripDk(hash).split('z').filter(p=>p&&p!==today).join('z');
  }

  // Identity for the *chart*, not the exact permalink. Secondary controls
  // (interval, volume, markers, a different window on a compare/scout view)
  // do not change which row is lit.
  function chartKey(st){
    st=st||{};
    const vt=st.vt||'';
    const cy=!!st.cy;
    const ll=!!st.ll;
    const rp=st.rp||'';
    const cm=st.cm||'';
    const m=st.m||'combinedUSD';
    const sp=st.sp||'';
    if(cy) return 'cy:'+(st.ca||'low')+':'+(st.cp||'usd');
    if(vt==='spiral') return 'vt:spiral:'+(st.sf?'sf':'');
    if(vt==='powerlaw') return 'vt:powerlaw:'+(st.blp?'blp':'');
    if(vt==='pricema') return 'vt:pricema:'+(st.pma||'200d')+':'+(st.pmm||'panel');
    if(vt==='returns') return 'vt:returns:'+(st.rm||'cagr')+':'+(st.rn||'4');
    if(vt==='calyear') return 'vt:calyear:'+(st.ym||'raw');
    if(vt==='ranges') return 'vt:ranges:'+(st.rb||'decade');
    if(vt) return 'vt:'+vt;
    if(ll) return 'll';
    if(rp==='mayer') return 'rp:mayer:'+(st.pbp?'pbp':'');
    if(rp==='pl') return 'rp:pl';
    if(rp) return 'rp:'+rp;
    if(sp==='spxgold'||(m==='spxShiller'&&cm==='goldLBMA')) return 'preset:spxgold';
    if(cm||m!=='combinedUSD') return 'cmp:'+m+':'+(cm||'');
    if((st.i||'')==='Yearly') return 'price:yearly';
    if((st.r||'')==='ccurrent') return 'price:current-cycle';
    if(!(st.r||'')&&st.l) return 'price:log';
    if((st.r||'')==='60') return 'price:default';
    return '';
  }
  function itemKey(it){return chartKey(stateFrom(it.set))}

  function activeItem(){
    const key=chartKey(formState());
    if(!key) return null;
    return everyItem().find(it=>itemKey(it)===key)||null;
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

  function setExtraOpen(groupEl, open){
    const btn=groupEl.querySelector('.v2-nav-more');
    const extra=groupEl.querySelector('.v2-nav-extra');
    if(!btn||!extra) return;
    extra.hidden=!open;
    extra.setAttribute('aria-hidden', open?'false':'true');
    btn.setAttribute('aria-expanded', open?'true':'false');
    const label=btn.dataset.label||'More';
    btn.textContent=open?label+' ▴':label+' ▾';
    extra.querySelectorAll('a').forEach(a=>{
      if(open) a.removeAttribute('tabindex');
      else a.setAttribute('tabindex','-1');
    });
  }

  function syncActive(){
    const nav=document.getElementById('v2Nav');
    if(!nav) return;
    const active=activeItem();
    const id=active&&active.id;
    nav.querySelectorAll('a[data-chart]').forEach(a=>{
      const on=a.dataset.chart===id;
      a.classList.toggle('on', on);
      if(on) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
    if(active){
      const extra=nav.querySelector('a[data-chart="'+active.id+'"]');
      const group=extra&&extra.closest('.v2-nav-group');
      if(group&&extra.closest('.v2-nav-extra')) setExtraOpen(group, true);
    }
  }

  function isStacked(){return window.matchMedia&&window.matchMedia(STACK_MQ).matches}
  function setOpen(open, opts){
    opts=opts||{};
    const sb=document.getElementById('v2Sidebar');
    const btn=document.getElementById('v2SidebarToggle');
    if(!sb) return;
    const was=sb.classList.contains('open');
    sb.classList.toggle('open', !!open);
    document.body.classList.toggle('v2-sidebar-open', !!open);
    if(btn){
      btn.setAttribute('aria-expanded', open?'true':'false');
      btn.textContent=open?'All charts ▴':'All charts ▾';
    }
    if(!open&&was&&isStacked()&&opts.focusToggle!==false&&btn){
      const ae=document.activeElement;
      if(!ae||sb.contains(ae)||ae===document.body) btn.focus();
    }
  }

  function render(){
    GROUPS.forEach(g=>allItems(g).forEach(it=>{it.hash=hashFromSet(it.set)}));

    const shell=document.createElement('div');
    shell.className='v2-shell';
    const aside=document.createElement('aside');
    aside.id='v2Sidebar';
    aside.innerHTML=
      '<a class="v2-skip" href="#chartoptions">Skip to chart controls</a>'+
      '<button type="button" id="v2SidebarToggle" aria-controls="v2Nav" aria-expanded="false">All charts ▾</button>'+
      '<nav id="v2Nav" aria-label="All charts"></nav>';
    const nav=aside.querySelector('#v2Nav');

    function addLink(ul, it){
      const li=document.createElement('li');
      const a=document.createElement('a');
      a.href='#'+it.hash;
      a.dataset.chart=it.id;
      a.textContent=it.label;
      li.appendChild(a);
      ul.appendChild(li);
    }

    GROUPS.forEach((g,gi)=>{
      const wrap=document.createElement('div');
      wrap.className='v2-nav-group';
      wrap.dataset.group=g.name;
      const h=document.createElement('div');
      h.className='v2-nav-h';
      h.textContent=g.name;
      wrap.appendChild(h);
      const ul=document.createElement('ul');
      g.items.forEach(it=>addLink(ul,it));
      wrap.appendChild(ul);
      if(g.extra&&g.extra.length){
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='v2-nav-more';
        btn.dataset.label=g.more||'More';
        btn.setAttribute('aria-expanded','false');
        btn.id='v2NavMore'+gi;
        const extra=document.createElement('ul');
        extra.className='v2-nav-extra';
        extra.id='v2NavExtra'+gi;
        extra.hidden=true;
        extra.setAttribute('aria-hidden','true');
        btn.setAttribute('aria-controls', extra.id);
        g.extra.forEach(it=>addLink(extra,it));
        wrap.appendChild(btn);
        wrap.appendChild(extra);
        setExtraOpen(wrap, false);
        btn.addEventListener('click',()=>{
          setExtraOpen(wrap, extra.hidden);
        });
      }
      nav.appendChild(wrap);
    });

    const main=document.createElement('div');
    main.className='v2-main';
    const form=document.getElementById('chartoptions');
    const content=document.getElementById('content_chart');
    const parent=form.parentNode;
    parent.insertBefore(shell, form);
    shell.appendChild(aside);
    shell.appendChild(main);
    main.appendChild(form);
    if(content) main.appendChild(content);
    form.classList.remove('wrap');
    if(content) content.classList.remove('wrap');
    if(!form.hasAttribute('tabindex')) form.setAttribute('tabindex','-1');

    aside.querySelector('#v2SidebarToggle').addEventListener('click',()=>{
      setOpen(!aside.classList.contains('open'));
    });
    nav.addEventListener('click',e=>{
      const a=e.target.closest('a[data-chart]');
      if(!a) return;
      e.preventDefault();
      applyHash(a.getAttribute('href'), true);
      if(isStacked()) setOpen(false);
    });
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape') return;
      if(!isStacked()) return;
      if(!aside.classList.contains('open')) return;
      e.preventDefault();
      setOpen(false);
    });

    const wrapHist=fn=>{
      return function(){
        const ret=fn.apply(this, arguments);
        if(!applying) syncActive();
        return ret;
      };
    };
    history.pushState=wrapHist(history.pushState.bind(history));
    history.replaceState=wrapHist(history.replaceState.bind(history));
    window.addEventListener('popstate', syncActive);

    setOpen(false, {focusToggle:false});
    syncActive();
    window.V2_SIDEBAR_GROUPS=GROUPS;
    window.applyV2ChartHash=applyHash;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
