/* Default website content + a sanitiser shared by the public site and admin panel.
   Published settings are stored in Supabase. Nothing in this file is secret. */
(function () {
  'use strict';

  var DEFAULTS = {
    version: 1,
    business: {
      name: 'D.S. Electrical',
      phone: '+44 7517 269949',
      email: '',
      hours: '',
      openingHours: [
        { day: 'Monday–Friday', hours: '' },
        { day: 'Saturday', hours: '' },
        { day: 'Sunday', hours: '' }
      ],
      address: ''
    },
    content: {
      showDemoBanner: false,
      showSampleReviews: false,
      kicker: 'Electrical services',
      headline: 'Electrical installation, testing and repairs.',
      intro: 'EV chargers, fuse box upgrades, inspection and testing, rewires, fault finding and more. Send an enquiry or call to talk through your job.',
      primaryButton: 'Send an Enquiry',
      secondaryButton: 'View Services',
      trust: []
    },
    /* Kept under the key "appliances" so any saved Supabase settings and the admin panel keep working.
       These are the service choices shown in step 1 of the enquiry form. */
    appliances: [
      { id: 'ev-charger', label: 'EV Charger Installation', enabled: true },
      { id: 'fuse-box', label: 'Fuse Box Upgrades', enabled: true },
      { id: 'inspection', label: 'Inspection & Testing', enabled: true },
      { id: 'pat', label: 'PAT Testing', enabled: true },
      { id: 'rewires', label: 'Rewires', enabled: true },
      { id: 'fault-finding', label: 'Fault Finding', enabled: true },
      { id: 'equipment-repairs', label: 'Electrical Equipment Repairs', enabled: true },
      { id: 'lights-sockets', label: 'New Lights and Sockets', enabled: true },
      { id: 'alarms', label: 'Smoke and Heat Alarm Work', enabled: true },
      { id: 'other', label: 'Other / not sure', enabled: true }
    ],
    pricing: {
      fee: '',
      policy: ''
    },
    areas: [],
    photos: { heroUrl: '', heroAlt: '', gallery: [] }   /* gallery: [{url, caption}] genuine photos only */
  };

  /* Step 2 of the enquiry form. Stored in the existing "brand" field so the API and database are unchanged. */
  var BRANDS = ['Home / domestic', 'Landlord / rental property', 'Business / commercial', 'Other / not sure'];

  var NOT_SURE = 'Not sure what I need';
  var GENERIC_SYMPTOMS = ['I need a quote', 'Something is not working', NOT_SURE];
  var SYMPTOMS = {
    'ev-charger': ['New charger installation', 'Charger not working', 'Replace or upgrade a charger', NOT_SURE],
    'fuse-box': ['Replace an old fuse box', 'Breaker or RCD keeps tripping', 'Add or change circuits', NOT_SURE],
    inspection: ['Landlord or rental inspection', 'Buying or selling a property', 'Periodic inspection', NOT_SURE],
    pat: ['Office or workplace equipment', 'Rental property appliances', 'Tools and equipment', NOT_SURE],
    rewires: ['Full rewire', 'Partial rewire', 'Old or damaged wiring', NOT_SURE],
    'fault-finding': ['Power lost to part of the property', 'Breaker or RCD keeps tripping', 'Flickering lights', 'Burning smell or heat', NOT_SURE],
    'equipment-repairs': ['Equipment will not power on', 'Intermittent fault', 'Damaged cable or plug', NOT_SURE],
    'lights-sockets': ['New lights', 'New sockets', 'Move or add points', NOT_SURE],
    alarms: ['Smoke alarms', 'Heat alarms', 'Replace or upgrade alarms', NOT_SURE]
  };

  function str(v, max, fallback) {
    if (typeof v !== 'string') return fallback;
    v = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    return v.slice(0, max);
  }
  function httpsUrl(v) {
    v = str(v, 500, '');
    return /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : '';
  }
  function slug(label) {
    return (String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item').slice(0, 30);
  }

  /* Accepts anything (e.g. data read back from storage) and returns a safe, complete config. */
  function normalize(raw) {
    var d = DEFAULTS, r = (raw && typeof raw === 'object') ? raw : {};
    var b = r.business || {}, c = r.content || {}, p = r.pricing || {}, ph = r.photos || {};
    var out = {
      version: 1,
      business: {
        name: str(b.name, 80, d.business.name) || d.business.name,
        phone: str(b.phone, 30, d.business.phone),
        email: str(b.email, 254, d.business.email),
        hours: str(b.hours, 200, d.business.hours),
        openingHours: [0, 1, 2].map(function (i) {
          var incoming = Array.isArray(b.openingHours) ? b.openingHours[i] : null;
          var fallback = d.business.openingHours[i];
          return { day: fallback.day, hours: str(incoming && incoming.hours, 60, fallback.hours) };
        }),
        address: str(b.address, 200, '')
      },
      content: {
        showDemoBanner: typeof c.showDemoBanner === 'boolean' ? c.showDemoBanner : d.content.showDemoBanner,
        showSampleReviews: typeof c.showSampleReviews === 'boolean' ? c.showSampleReviews : d.content.showSampleReviews,
        kicker: str(c.kicker, 80, d.content.kicker),
        headline: str(c.headline, 140, d.content.headline) || d.content.headline,
        intro: str(c.intro, 400, d.content.intro),
        primaryButton: str(c.primaryButton, 40, d.content.primaryButton) || d.content.primaryButton,
        secondaryButton: str(c.secondaryButton, 40, d.content.secondaryButton) || d.content.secondaryButton,
        trust: Array.isArray(c.trust) ? c.trust.slice(0, 6).map(function (t) {
          t = t || {};
          return { num: str(t.num, 12, ''), title: str(t.title, 60, ''), text: str(t.text, 200, '') };
        }).filter(function (t) { return t.title || t.text; }) : d.content.trust
      },
      appliances: [],
      pricing: {
        fee: str(p.fee, 10, d.pricing.fee).replace(/[^0-9.,]/g, '') || d.pricing.fee,
        policy: str(p.policy, 300, d.pricing.policy)
      },
      areas: [],
      photos: {
        heroUrl: httpsUrl(ph.heroUrl),
        heroAlt: str(ph.heroAlt, 160, ''),
        gallery: []
      }
    };
    var seen = {};
    (Array.isArray(r.appliances) ? r.appliances : d.appliances).slice(0, 40).forEach(function (a) {
      a = a || {};
      var label = str(a.label, 60, '');
      if (!label) return;
      var id = str(a.id, 40, '').replace(/[^a-z0-9_-]/gi, '') || slug(label);
      while (seen[id]) id += '-x';
      seen[id] = 1;
      out.appliances.push({ id: id, label: label, enabled: a.enabled !== false });
    });
    (Array.isArray(r.areas) ? r.areas : d.areas).slice(0, 60).forEach(function (a) {
      a = a || {};
      var name = str(a.name, 80, '');
      if (name) out.areas.push({ name: name, zip: str(a.zip, 12, '') });
    });
    (Array.isArray(ph.gallery) ? ph.gallery : []).slice(0, 12).forEach(function (g) {
      g = g || {};
      var url = httpsUrl(g.url);
      if (url) out.photos.gallery.push({ url: url, caption: str(g.caption, 140, '') });
    });
    return out;
  }

  window.SiteCfg = {
    defaults: DEFAULTS,
    brands: BRANDS,
    normalize: normalize,
    slug: slug,
    symptomsFor: function (id) { return SYMPTOMS[id] || GENERIC_SYMPTOMS; }
  };
})();
