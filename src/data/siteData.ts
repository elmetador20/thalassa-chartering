// ============================================================================
// INCWORX Intelligence Group — central site content & data.
// Copy below is the final approved text from the company profile master brief.
// ============================================================================

export const brand = {
  name: 'INCWORX',
  tagline: 'Market Intelligence • Chartering • Dry Bulk • Tectonics • Datamatics • Digitronics',
};

export const nav = {
  // Primary bar — deliberately short. The full index lives in the overlay menu.
  links: [
    { label: 'About', href: '#about' },
    { label: 'Capabilities', href: '#capabilities' },
    { label: 'Chartering', href: '#chartering' },
    { label: 'Projects', href: '#projects' },
    { label: 'Global Presence', href: '#global' },
  ],
  cta: { label: 'Contact', href: '#contact' },
  // Full-screen overlay menu — every section, grouped.
  menuGroups: [
    {
      heading: 'Group',
      links: [
        { label: 'Who we are', href: '#about' },
        { label: 'The INCWORX model', href: '#model' },
        { label: '2030 ambition', href: '#ambition' },
        { label: 'Global presence', href: '#global' },
        { label: 'Sustainability', href: '#sustainability' },
        { label: 'Leadership', href: '#leadership' },
      ],
    },
    {
      heading: 'Capabilities',
      links: [
        { label: 'Intelligence', href: '#intelligence' },
        { label: 'Datamatics', href: '#datamatics' },
        { label: 'Tectonics', href: '#tectonics' },
        { label: 'Digitronics', href: '#digitronics' },
        { label: 'Chartering', href: '#chartering' },
        { label: 'Projects', href: '#projects' },
      ],
    },
  ],
};

export const hero = {
  // Rendered as a technical strip, one term per cell.
  eyebrowItems: [
    'Market intelligence',
    'Chartering',
    'Dry bulk',
    'Tectonics',
    'Datamatics',
    'Digitronics',
  ],
  titleLine1: 'Intelligence that moves markets.',
  titleLine2: 'Execution that moves business.',
  body:
    'INCWORX Intelligence Group is a market intelligence, analytics, infrastructure and technology platform. Better intelligence leads to better decisions. Better decisions create better execution.',
  primaryCta: { label: 'Explore our capabilities', href: '#capabilities' },
  secondaryCta: { label: 'Talk to our team', href: '#contact' },
  trust: 'London • Dubai • Delhi • Singapore • Hong Kong',
  offices: ['London', 'Dubai', 'Delhi', 'Singapore', 'Hong Kong'],
  scrollLabel: 'Scroll to explore',
};

// Hero background source.
//   'pin'   — the Pinterest embed (client-supplied pin)
//   'video' — the locally hosted maritime encodes in /public/assets
// Switching between them is a one-word change; see HeroBackdrop.tsx.
export const heroMedia = {
  source: 'video' as 'pin' | 'video',
  pinId: '735916395430287283',
};

// Cinematic transition out of the hero. Uses the company's own stated
// principle rather than invented positioning copy.
export const statement = {
  label: 'The principle',
  lines: [
    'Better intelligence leads',
    'to better decisions.',
    'Better decisions create',
    'better execution.',
  ],
  support:
    'Our foundation lies in global commodity and ocean-freight markets, with particular expertise across iron ore, coal, steel, minerals and dry bulk shipping.',
};

export const about = {
  eyebrow: 'Who We Are',
  heading: 'Intelligence. Infrastructure. Technology.',
  body:
    'INCWORX Intelligence Group is a market intelligence, analytics, infrastructure and technology platform built around one core principle: better intelligence leads to better decisions, and better decisions create better execution. Our foundation lies in global commodity and ocean-freight markets, with particular expertise across iron ore, coal, steel, minerals and dry bulk shipping.',
  principle:
    'Better intelligence leads to better decisions. Better decisions create better execution.',
  foundation:
    'Our foundation lies in global commodity and ocean-freight markets, with particular expertise across iron ore, coal, steel, minerals and dry bulk shipping.',
  image: '/images/img1.jpeg',
  blocks: [
    {
      key: 'intelligence',
      title: 'Intelligence',
      text: 'Market intelligence, commodity research, trade-flow analysis, pricing, freight and commercial insights.',
    },
    {
      key: 'datamatics',
      title: 'Datamatics',
      text: 'Data engineering, analytics, market statistics, predictive modelling, MIS and operational intelligence.',
    },
    {
      key: 'tectonics',
      title: 'Tectonics',
      text: 'Port infrastructure, marine construction, engineering, project management, feasibility and advisory.',
    },
    {
      key: 'digitronics',
      title: 'Digitronics',
      text: 'Digital transformation, software engineering, AI, automation, cloud infrastructure and business technology.',
    },
  ],
};

export const services = {
  eyebrow: 'What We Do',
  heading: 'One Group. Four Capabilities.',
  subtitle: 'One integrated approach.',
  items: [
    {
      key: 'intelligence',
      icon: 'intelligence',
      title: 'Intelligence',
      text: 'Market intelligence, commodity research and trade-flow analysis across iron ore, coal, steel and dry bulk freight.',
      image: '/images/service-shipping.jpg',
      href: '#intelligence',
    },
    {
      key: 'datamatics',
      icon: 'datamatics',
      title: 'Datamatics',
      text: 'Data engineering, analytics, predictive modelling and operational intelligence for commercial decisions.',
      image: '/images/service-trading.jpeg',
      href: '#datamatics',
    },
    {
      key: 'tectonics',
      icon: 'tectonics',
      title: 'Tectonics',
      text: 'Port infrastructure, marine construction, engineering and project execution.',
      image: '/images/about-port.jpeg',
      href: '#tectonics',
    },
    {
      key: 'digitronics',
      icon: 'digitronics',
      title: 'Digitronics',
      text: 'Digital transformation, software engineering, AI, automation and cloud infrastructure.',
      image: '/images/service-mobility.jpeg',
      href: '#digitronics',
    },
  ],
};

export const model = {
  eyebrow: 'The INCWORX Model',
  heading: 'From Intelligence to Execution',
  intro: 'INCWORX is designed around an integrated commercial ecosystem.',
  flow: 'INTELLIGENCE → DATA → INFRASTRUCTURE → TECHNOLOGY',
  items: [
    {
      no: '01',
      title: 'Intelligence',
      q: 'What is happening in the market?',
      text: 'Commodity flows, pricing, demand-supply, trade movements, freight markets and commercial developments.',
    },
    {
      no: '02',
      title: 'Datamatics',
      q: 'What does the data tell us?',
      text: 'Structured data, analytics, reporting, predictive models and decision-support systems.',
    },
    {
      no: '03',
      title: 'Tectonics',
      q: 'What needs to be built?',
      text: 'Ports, terminals, marine infrastructure, industrial assets and supporting infrastructure.',
    },
    {
      no: '04',
      title: 'Digitronics',
      q: 'How can it operate smarter?',
      text: 'Software, automation, AI, cloud, digital systems and technology infrastructure.',
    },
  ],
  closing: 'One group. Four capabilities. One integrated approach.',
};

export const ambition = {
  eyebrow: 'Building Toward 2030',
  heading: '2030 Business Ambition.',
  figure: 'USD 1 BILLION',
  figureValue: 1,
  figureUnit: 'Billion',
  figureLabel: '2030 Business Ambition',
  lede: "INCWORX's 2030 ambition is to build a USD 1 billion business platform driven by intelligence, infrastructure, data and technology.",
  aimsHeading: 'By 2030, INCWORX aims to',
  aims: [
    'Expand global market intelligence and commodity research.',
    'Build deeper relationships across commodity and maritime markets.',
    'Develop scalable data and analytics platforms.',
    'Expand infrastructure consulting and project execution.',
    'Build technology solutions for enterprises and industrial businesses.',
    'Develop AI, automation and private technology infrastructure.',
    'Strengthen international operating capabilities.',
    'Create long-term partnerships across commodities, maritime, infrastructure and technology.',
  ],
  mission: {
    eyebrow: 'Our Mission',
    heading: 'The intelligence and execution partner behind smarter global trade',
    body: 'INCWORX transforms information into commercial advantage.',
    formula: 'Commodity Research + Market Statistics + Data Analytics + Predictive Modelling + Chartering + Infrastructure + Technology',
    flow: 'Insight → Decision → Transaction → Execution',
  },
};

export const intelligence = {
  eyebrow: 'Intelligence',
  heading: 'Understanding markets before they move',
  body: 'INCWORX Intelligence is the foundation of the Group. We provide market intelligence and commercial insights across commodity and ocean-freight markets, combining research, statistics, industry inputs and market connectivity.',
  areasHeading: 'Core Areas',
  areas: ['Commodity market intelligence', 'Iron ore research', 'Pellet market research', 'Coal market intelligence', 'Steel market analysis', 'Commodity pricing', 'Import & export analysis', 'Trade-flow intelligence', 'Demand-supply analysis', 'Ocean freight intelligence', 'Dry bulk market intelligence', 'Market statistics', 'Commercial research', 'Consulting & market studies'],
};

export const chartering = {
  eyebrow: 'Chartering',
  heading: 'Connecting Cargo With Capacity',
  body: 'INCWORX provides dry bulk chartering services across major commodity and maritime markets.',
  structuresHeading: 'Chartering Structures',
  structures: ['Voyage Charter', 'Trip Charter', 'Time Charter', 'Period Charter', 'Spot Charter', 'Bareboat Charter', 'Forward Contracts'],
  cargoHeading: 'Cargo Segments',
  cargo: ['Cementitious products', 'Fertilizers', 'Iron ore', 'Coal', 'Minerals', 'Steel products', 'Grain & agricultural commodities'],
  coverageHeading: 'Geographic Coverage',
  coverage: 'Far East • Southeast Asia • Indian Ocean • Middle East / Persian Gulf • Mediterranean • West Africa • East Africa • Atlantic',
  voyage: {
    heading: 'From Fixture to Discharge',
    body: 'INCWORX supports the operational side of maritime transactions beyond the fixture.',
    capabilities: ['Voyage coordination', 'Port-call coordination', 'Demurrage follow-up', 'Documentation', 'Local authority coordination', 'Service coordination', 'Crew welfare coordination', 'Operational follow-up', 'Discharge coordination', 'Post-fixture support'],
    flow: 'FIXTURE → VOYAGE → PORT CALL → OPERATIONS → DISCHARGE → POST-FIXTURE',
  },
};

export const divisions = {
  datamatics: {
    eyebrow: 'Datamatics',
    heading: 'Data. Market. Operations.',
    body: 'Datamatics is INCWORX’s Data, Market & Operations Intelligence division. It applies the discipline of commodity research to structured data analysis, operational intelligence and commercial decision-making.',
    integratesHeading: 'Datamatics Integrates',
    integrates: ['Commodity analysis', 'Data engineering', 'Market intelligence', 'Market statistics', 'Predictive modelling', 'Operations intelligence', 'MIS', 'Business reporting', 'Management dashboards'],
    capabilitiesHeading: 'Turning Data Into Decisions',
    capabilities: [
      { title: 'Commodity Analysis', text: 'Pricing, demand-supply and trade-flow analysis across iron ore, coal, steel, minerals, fertilizers and grains.' },
      { title: 'Operations Intelligence', text: 'Workflow tracking, KPI monitoring, exception reporting and process-efficiency analysis across chartering, trading, logistics and commercial operations.' },
      { title: 'Data Engineering', text: 'Data pipelines, structured databases, analytics infrastructure, integration and a single source of truth.' },
      { title: 'Market Reporting', text: 'Daily, weekly and periodic reporting covering pricing, trade volumes, freight rates and market indicators.' },
      { title: 'Predictive Modelling', text: 'Trade-flow patterns, pricing trends and demand-supply shifts.' },
      { title: 'Client Dashboards', text: 'Centralized decision-support environments replacing fragmented spreadsheets and manual reporting.' },
    ],
    reportingHeading: 'Structured Reporting',
    reporting: [
      { title: 'Daily Reports', text: 'Immediate market developments.' },
      { title: 'Weekly Reports', text: 'Trend analysis and market direction.' },
      { title: 'Monthly Reports', text: 'Structured market review.' },
      { title: 'Management Reports', text: 'Decision-oriented intelligence for management teams.' },
    ],
    flow: 'DATA → ANALYSIS → VISUALIZATION → INSIGHT → DECISION',
    closing: 'Making data a working commercial tool — not a static report.',
  },
  tectonics: {
    eyebrow: 'Tectonics',
    heading: 'Engineering infrastructure with intelligence',
    body: 'Tectonics is INCWORX’s infrastructure and marine-construction division. It combines engineering rigor with market intelligence to support the development of ports, terminals, jetties, marine, industrial and cargo-handling infrastructure.',
    developsHeading: 'Development Focus',
    develops: ['Ports', 'Terminals', 'Jetties', 'Marine infrastructure', 'Industrial infrastructure', 'Cargo-handling facilities', 'Supporting infrastructure'],
    capabilitiesHeading: 'Core Capabilities',
    capabilities: ['Port Construction', 'Port Consulting', 'Design & Engineering', 'Project Management', 'Feasibility & Advisory', 'Environmental & Regulatory', 'Asset Management'],
    philosophy: 'Infrastructure decisions grounded in trade flows, cargo volumes, vessel characteristics, market dynamics and commercial fundamentals.',
    consultingHeading: 'Port Consulting & Project Execution',
    consulting: ['Throughput modelling', 'Cargo-volume analysis', 'Capacity assessment', 'Tariff & commercial structuring', 'Benchmarking', 'Regulatory assessment', 'Master planning', 'EPC coordination', 'Schedule & cost monitoring', 'Quality assurance', 'Stakeholder management', 'Commissioning support'],
    lifecycle: 'Strategy → Planning → Engineering → Construction → Commissioning',
    assetHeading: 'Feasibility & Asset Management',
    asset: ['Technical & commercial feasibility', 'Environmental & Social Impact Assessment support', 'Permitting & regulatory mapping', 'Investment & implementation advisory', 'Maintenance planning', 'Dredging management', 'Condition assessment', 'Long-term maintenance planning'],
    assetFlow: 'Build → Operate → Maintain → Optimize',
  },
  digitronics: {
    eyebrow: 'Digitronics',
    heading: 'Technology that transforms the way organizations operate',
    body: 'Digitronics is INCWORX’s technology and digital transformation division. It helps organizations modernize technology ecosystems, automate operations, build scalable digital products and adopt AI securely and effectively.',
    capabilitiesHeading: 'Core Capabilities',
    capabilities: ['Digital Transformation', 'Software Engineering', 'Web & Digital Platforms', 'UI/UX & Product Design', 'AI & Automation', 'Data & Cloud Infrastructure', 'Technology Consulting', 'Business Intelligence', 'Private AI Infrastructure', 'Edge AI Infrastructure', 'Digital Communication'],
    chainHeading: 'Transformation Journey',
    chain: 'BRAND → WEBSITE → CRM → ERP → AUTOMATION → AI → ANALYTICS',
    principlesHeading: 'Engineering Principles',
    principles: ['Security', 'Scalability', 'Maintainability', 'Performance', 'Production Readiness'],
    aiHeading: 'AI, Automation & Business Intelligence',
    ai: ['AI chatbots & internal assistants', 'Private AI & document intelligence', 'RAG & LLM applications', 'Workflow automation', 'AI agents', 'Dashboards, MIS & automated reporting'],
    cloudHeading: 'Cloud, Private AI & Edge',
    cloud: ['Cloud infrastructure & compute', 'Data pipelines & engineering', 'Private AI cloud & model serving', 'GPU workloads', 'Edge AI & computer vision', 'DevOps, backup & security'],
    frontiersHeading: 'Future Frontiers',
    frontiers: [
      { title: 'Robotics', text: 'Industrial automation and intelligent machines.' },
      { title: 'Avionics', text: 'Advanced aviation systems and technology.' },
      { title: 'Data Centres', text: 'Infrastructure for high-performance computing, cloud and AI workloads.' },
      { title: 'Spatial Technology', text: 'Geospatial intelligence, mapping and spatial data systems.' },
      { title: 'Artificial Intelligence', text: 'Enterprise AI, automation and intelligent systems.' },
    ],
  },
};

export const globalPresence = {
  eyebrow: 'Global Presence',
  heading: 'Connected to Global Markets.',
  body: 'A network built to support businesses wherever they operate.',
  networkLabel: 'Global Office Network',
  networkNote: 'London • Dubai • Delhi • Singapore • Hong Kong',
  // Approximate marker positions on the stylized map (percentages).
  markers: [
    { x: 47, y: 28 }, { x: 58, y: 42 }, { x: 66, y: 42 },
    { x: 74, y: 56 }, { x: 80, y: 44 },
  ],
};

export const projects = {
  eyebrow: 'Representative Project Experience',
  heading: 'Manki & Pavinakurve.',
  figure: '$1.32 Billion',
  figureValue: 1.32,
  figureUnit: 'Billion',
  // Two decimals: the combined figure is the only one that carries them.
  figureDecimals: 2,
  figureLabel: 'Combined Project Portfolio',
  items: [
    {
      id: 'manki',
      no: '01',
      title: 'Manki Port Project',
      titleLines: ['Manki', 'Port Project'],
      category: 'Port Infrastructure · DBFOT',
      location: 'Manki, Karnataka, India',
      description: 'All-weather deepwater port development by Bederwal Consortium on Design-Build-Finance-Operate-Transfer basis — total investment outlay of $794 Million.',
      // Figure restated from the description above — no new numbers introduced.
      value: 794,
      valueUnit: 'Million',
      valueLabel: 'Total investment outlay',
      developer: 'Bederwal Consortium',
      basis: 'Design–Build–Finance–Operate–Transfer',
      asset: 'All-weather deepwater port',
      image: '/images/manki-port.jpg',
      alt: 'Aerial view of a deepwater container berth with quay cranes working a vessel',
      href: '#contact',
    },
    {
      id: 'pavinakurve',
      no: '02',
      title: 'Pavinakurve Port Project',
      titleLines: ['Pavinakurve', 'Port Project'],
      category: 'Port Infrastructure · DBFOT',
      location: 'Pavinakurve, Karnataka, India',
      description: 'All-weather deepwater port development by Bederwal Consortium on Design-Build-Finance-Operate-Transfer basis — investment outlay of $529 Million.',
      value: 529,
      valueUnit: 'Million',
      valueLabel: 'Investment outlay',
      developer: 'Bederwal Consortium',
      basis: 'Design–Build–Finance–Operate–Transfer',
      asset: 'All-weather deepwater port',
      image: '/images/pavinakurve-port.jpg',
      alt: 'Top-down aerial of a port channel with vessels under way beside container terminals',
      href: '#contact',
    },
  ],
  closing: 'Two projects. One integrated infrastructure capability.',
  experienceHeading: 'Project Experience Includes',
  experience: ['Port infrastructure', 'Marine construction', 'Cargo-handling infrastructure', 'Project planning', 'Engineering coordination', 'Commercial assessment', 'Project management', 'Stakeholder coordination', 'Regulatory interface'],
};

export const leadership = {
  eyebrow: 'Leadership',
  heading: 'Leadership',
  body: 'Profiles will be published as team information becomes available.',
  // Placeholder profiles — no fabricated names or biographies.
  members: [
    { name: '[Name]', role: '[Designation]', bio: '[Short biography placeholder]' },
    { name: '[Name]', role: '[Designation]', bio: '[Short biography placeholder]' },
    { name: '[Name]', role: '[Designation]', bio: '[Short biography placeholder]' },
    { name: '[Name]', role: '[Designation]', bio: '[Short biography placeholder]' },
  ],
};

export const sustainability = {
  eyebrow: 'Sustainability',
  heading: 'Moving Toward a More Responsible Future.',
  body: 'A considered approach to how we operate, the people we work with and our impact.',
  image: '/images/sustainability-ocean.jpg',
  areas: [
    { title: 'Responsible Operations', text: 'A commitment to dependable, responsible ways of working.' },
    { title: 'People & Communities', text: 'Supporting the people and communities connected to our work.' },
    { title: 'Environmental Progress', text: 'Working toward a lower-impact, more sustainable future.' },
  ],
};

export const contactCta = {
  heading: 'Intelligence that moves markets. Execution that moves business.',
  body: 'From commodities to shipping. From data to decisions. From infrastructure to technology. From intelligence to execution.',
  primaryCta: { label: 'Start a Conversation', href: '#contact' },
  secondaryCta: { label: 'Explore Verticals', href: '#services' },
};

export const contact = {
  eyebrow: 'Contact',
  heading: "Let's talk.",
  body: 'Talk to INCWORX about your requirements across intelligence, maritime, infrastructure, data and technology.',
  info: [
    { label: 'Email', value: 'incorp@incworx.in' },
    { label: 'Mobile', value: '+91 9319521056' },
    { label: 'Office', value: '10A, BPTP Park Centra, Sector 30, Gurgaon – 122001, India' },
    { label: 'Website', value: 'incworx.in' },
  ],
};

export const footer = {
  blurb: 'INCWORX — Intelligence • Datamatics • Tectonics • Digitronics',
  columns: [
    {
      heading: 'Navigation',
      links: ['About', 'Verticals', 'Model', 'Chartering', 'Projects', 'Contact'],
    },
    {
      heading: 'Divisions',
      links: ['Intelligence', 'Datamatics', 'Tectonics', 'Digitronics'],
    },
    {
      heading: 'Company',
      links: ['Global Presence', 'Leadership', 'Sustainability', 'Contact'],
    },
  ],
  contact: [
    { label: 'Email', value: 'incorp@incworx.in' },
    { label: 'Mobile', value: '+91 9319521056' },
    { label: 'Office', value: '10A, BPTP Park Centra, Sector 30, Gurgaon – 122001, India' },
  ],
  social: [] as string[],
  copyright: '© 2026 INCWORX. All rights reserved.',
  legal: ['Privacy Policy', 'Terms & Conditions'],
};
