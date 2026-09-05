export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  keywords: string;
  category: string;
  date: string; // ISO date
  updated?: string; // ISO date
  readTime: string;
  author: string;
  excerpt: string;
  contentHtml: string;
}

const CONTACT_CTA = `
  <p>Want to see this working inside your own clinic? Call or WhatsApp <a href="tel:+918989496800">+91 89894 96800</a>, or <a href="/signup">start a free 7 day trial of BariQ</a> — full platform access, no credit card required.</p>
`;

export const blogPosts: BlogPost[] = [
  {
    slug: "clinic-queue-management-system-guide",
    title: "Clinic Queue Management System: The Complete Guide to Cutting Patient Wait Time",
    description:
      "How a digital clinic queue management system works, why paper token systems fail busy OPDs, and what to look for before you buy one. A practical guide for Indian clinics.",
    keywords:
      "clinic queue management system, digital patient queue, OPD queue system, token management software, hospital queue management India",
    category: "Queue Management",
    date: "2026-01-12",
    readTime: "7 min read",
    author: "BariQ Team",
    excerpt:
      "Paper tokens and shouted names don't scale past a handful of patients a day. Here's how a digital queue system actually cuts wait time, and what to check before you buy one.",
    contentHtml: `
      <p>Walk into most Indian clinics on a busy morning and you'll see the same scene: a stack of paper tokens, a receptionist juggling phone calls and walk-ins, and a waiting room full of patients who have no idea how long they'll be sitting there. A <strong>clinic queue management system</strong> exists to fix exactly this problem, and it does it with a much smaller change than most clinic owners expect.</p>

      <h2>Why paper and verbal token systems break down</h2>
      <p>A handwritten token system works fine for ten patients a day. It falls apart at thirty. The core issues are always the same:</p>
      <ul>
        <li><strong>No visibility.</strong> A patient who steps out for tea, a phone call, or to move their car has no way to know if they've been called.</li>
        <li><strong>No fairness signal.</strong> When multiple doctors or departments share one waiting area, patients can't tell whose queue is moving and whose isn't.</li>
        <li><strong>Receptionist bottleneck.</strong> Every status update — "how many people are ahead of me?" — interrupts the front desk, which is already busy registering new patients.</li>
        <li><strong>No data.</strong> There's no record of average wait time, no-show rate, or peak hours, so the clinic can't plan staffing around real demand.</li>
      </ul>

      <h2>What a digital queue management system actually changes</h2>
      <p>A digital <strong>OPD queue system</strong> replaces the paper token with a live number that updates on its own, pushed to a waiting room screen and to each patient's phone. The mechanics are simple, but the effect compounds:</p>
      <ul>
        <li><strong>Live position updates.</strong> Patients see their number and the number currently being served, refreshed instantly the moment the doctor calls the next patient — no manual refresh, no polling the receptionist.</li>
        <li><strong>Self check-in.</strong> A QR code at the entrance lets a walk-in patient join the queue by entering just their phone number, taking that task off the receptionist entirely during rush hours.</li>
        <li><strong>Multi-doctor separation.</strong> Each doctor runs their own independent queue, so a multi-specialty clinic doesn't collapse into one confusing shared line.</li>
        <li><strong>WhatsApp and SMS nudges.</strong> Patients get a message when they're a few positions away, so they can step out and come back instead of occupying a chair for an hour.</li>
      </ul>

      <h2>The real-world impact: wait time and no-shows</h2>
      <p>Clinics that switch from paper tokens to a live digital queue consistently report two changes: average perceived wait time drops sharply because patients aren't anxiously watching the door, and no-show rates fall because patients trust the system enough to step away and return. One BariQ clinic in Pune brought reported wait time down from 45 minutes to under 15 simply by giving patients a number they could trust and check from their own phone.</p>

      <h2>What to look for before buying a queue system</h2>
      <p>Not all "queue management" tools are equal. Before you commit, check for:</p>
      <ul>
        <li><strong>Real-time updates</strong>, not a screen that refreshes every 30 seconds. Push-based updates (via SSE or WebSockets) feel instant; polling doesn't.</li>
        <li><strong>Self check-in via QR code</strong>, so the front desk isn't the only way to join the queue.</li>
        <li><strong>WhatsApp support</strong> that doesn't require an expensive WhatsApp Business API contract to get started.</li>
        <li><strong>One queue per doctor</strong>, if you run more than one practitioner, so queues never mix.</li>
        <li><strong>It should connect to your patient records</strong>, not sit as a separate app, so the receptionist isn't maintaining two systems.</li>
      </ul>

      <p>This last point matters more than it sounds. A queue system that's disconnected from patient records, prescriptions, and billing just moves the chaos from the waiting room into the back office. That's why BariQ builds queue management as one module inside a single clinic platform, alongside patient records, a smart pharmacy, and billing — not as a bolt-on token board.</p>

      ${CONTACT_CTA}
      <p>Related reading: <a href="/blog/opd-queue-management-hospitals">OPD queue management for hospitals with multiple departments</a> and <a href="/blog/how-to-choose-clinic-management-software-india">how to choose clinic management software in India</a>.</p>
    `,
  },
  {
    slug: "fefo-pharmacy-inventory-management",
    title: "FEFO Inventory Management for Pharmacies: A Practical Guide",
    description:
      "What FEFO (First Expiry, First Out) means for a clinic pharmacy, why FIFO isn't enough, and how automated batch selection prevents expired stock from ever reaching a patient.",
    keywords:
      "FEFO inventory, pharmacy management software India, pharmacy expiry management, batch tracking software, clinic pharmacy POS",
    category: "Pharmacy",
    date: "2026-01-19",
    readTime: "6 min read",
    author: "BariQ Team",
    excerpt:
      "FIFO isn't enough for medicines — expiry dates don't follow arrival order. Here's why FEFO matters and how to enforce it without slowing down billing.",
    contentHtml: `
      <p>Most inventory systems are built around FIFO — First In, First Out. That works for goods that don't expire on a fixed date. Medicines don't follow that rule. A pharmacy can receive a new batch of a drug with an <em>earlier</em> expiry date than stock it already has on the shelf, because manufacturers, suppliers, and batch sizes vary. That's exactly why pharmacy inventory needs <strong>FEFO — First Expiry, First Out</strong> — instead.</p>

      <h2>What FEFO actually means in practice</h2>
      <p>FEFO means the batch closest to its expiry date is always sold first, regardless of when it arrived in stock. In a manual pharmacy, this requires a staff member to check expiry dates on every strip or bottle before billing — something that gets skipped constantly during a busy dispensing counter, especially when multiple batches of the same medicine sit on the same shelf.</p>

      <h2>Why manual FEFO fails under pressure</h2>
      <ul>
        <li><strong>Time pressure.</strong> A pharmacist billing the fifteenth patient of the hour isn't going to open three strips to compare expiry dates.</li>
        <li><strong>No visibility.</strong> Without a system tracking batch-level expiry, staff genuinely don't know which batch is closest to expiring unless they physically check.</li>
        <li><strong>Compliance risk.</strong> Dispensing an expired or near-expired medicine isn't just a financial loss — it's a patient safety and regulatory issue.</li>
      </ul>

      <h2>How automated FEFO batch selection works</h2>
      <p>A pharmacy management system that enforces FEFO automatically picks the batch nearest to expiry the moment a medicine is added to a bill — the pharmacist doesn't need to think about it at all. This works by tracking every incoming batch separately, with its own expiry date and quantity, instead of treating a medicine as one undifferentiated stock count.</p>

      <h2>Alerts matter as much as batch selection</h2>
      <p>FEFO handles what gets sold. But preventing waste altogether means catching stock <em>before</em> it's close to unsellable:</p>
      <ul>
        <li><strong>Expired stock alerts</strong> — flagged immediately so it's pulled off the shelf.</li>
        <li><strong>Near-expiry alerts</strong> at 7, 30, and 90 day windows, giving enough runway to push slower-moving stock or return it to the supplier.</li>
        <li><strong>Low stock alerts</strong> tied to a minimum threshold per medicine, so a pharmacy doesn't run out of fast-moving essentials.</li>
      </ul>
      <p>Together, these alerts turn pharmacy management from reactive ("we just found three expired boxes") to proactive (a daily glance at a dashboard that shows exactly what needs attention).</p>

      <h2>One-tap reorder closes the loop</h2>
      <p>Once low stock is flagged, the next bottleneck is usually manually drafting a purchase order — checking supplier details, minimum order quantities, and typing it all into a message or spreadsheet. A pharmacy system that generates a ready-to-print or ready-to-share purchase order directly from the low-stock list, using saved supplier details and lead times, removes this step almost entirely.</p>

      <h2>What this looks like end to end in BariQ</h2>
      <p>BariQ's pharmacy module applies FEFO automatically at billing, tracks batches individually, and raises expiry and low-stock alerts with a live count badge so nothing sits unnoticed. Suppliers, payment terms, and lead times live in the same system, so a reorder is one tap away from the alert that triggered it — and a returns and wastage log keeps a clean record of anything written off, with reason and cost, for audits and supplier conversations.</p>

      ${CONTACT_CTA}
      <p>Related reading: <a href="/blog/how-to-choose-clinic-management-software-india">how to choose clinic management software in India</a>.</p>
    `,
  },
  {
    slug: "patient-crm-for-clinics",
    title: "Patient CRM for Clinics: Why Follow-Ups Make or Break Retention",
    description:
      "Most clinics lose patients to silence, not to competitors. A look at what a patient CRM actually does for a clinic, and why follow-ups and campaigns matter as much as the visit itself.",
    keywords:
      "clinic CRM, patient management system, patient follow up software, clinic marketing software, WhatsApp campaigns for clinics",
    category: "Patient CRM",
    date: "2026-01-26",
    readTime: "6 min read",
    author: "BariQ Team",
    excerpt:
      "A patient who isn't followed up with doesn't switch clinics out of dissatisfaction — they simply forget to come back. That's a CRM problem, not a care problem.",
    contentHtml: `
      <p>Ask most clinic owners why a patient didn't return for a follow-up visit, and the honest answer is usually: nobody knows. Not because the patient was unhappy, but because nobody reminded them, tracked them, or reached out. That gap — between a good visit and a patient who simply drifts away — is exactly what a <strong>patient CRM</strong> is built to close.</p>

      <h2>A clinic is not a one-visit business</h2>
      <p>Chronic condition management, dental treatment plans, physiotherapy courses, vaccination schedules, annual check-ups — the vast majority of clinical relationships depend on the patient coming back. Without a system tracking who's due for a follow-up, that responsibility sits entirely on the patient's memory, which is an unreliable place to leave it.</p>

      <h2>What a patient CRM actually tracks</h2>
      <ul>
        <li><strong>Full patient profiles</strong> — demographics, visit history, and how they first found the clinic.</li>
        <li><strong>Follow-up reminders</strong> tied to a treatment plan or a doctor's note, not a generic "call everyone every month" list.</li>
        <li><strong>Funnel tracking</strong> — where a patient is in their journey: new lead, first visit, active patient, lapsed.</li>
        <li><strong>Bulk communication</strong> — the ability to message a specific segment (say, everyone due for a six-month dental cleanup) in one campaign instead of one call at a time.</li>
      </ul>

      <h2>Why WhatsApp beats SMS and email for Indian clinics</h2>
      <p>Open rates tell the story: WhatsApp messages get read within minutes in a way SMS and email rarely do in India. A patient CRM built for the Indian market needs WhatsApp as a first-class channel — not an afterthought bolted on through a paid API that most small clinics can't justify. That's why BariQ supports connecting WhatsApp Web directly by scanning a QR code from the clinic's own phone, alongside official Business API or Twilio integration for clinics that already have one.</p>

      <h2>Follow-ups are a safety issue too, not just a growth one</h2>
      <p>It's tempting to think of CRM and campaigns as a marketing feature. In a clinical setting, they're also a safety net: a diabetic patient who misses a scheduled review, a post-surgical patient who skips a wound check, a child who's due for the next vaccination dose. A tracked follow-up list catches these before they become missed care, not just missed revenue.</p>

      <h2>What good CRM data unlocks</h2>
      <p>Once patient data lives in one connected system rather than a notebook or a disconnected spreadsheet, a clinic can answer questions it usually couldn't: How many patients came from referrals versus walk-ins this quarter? What percentage of new patients returned for a second visit? Which campaign actually brought people back in? These aren't vanity metrics — they directly inform where a clinic should spend its limited marketing effort.</p>

      <h2>Retention math is simple and often ignored</h2>
      <p>Bringing back an existing patient is dramatically cheaper than acquiring a new one, and existing patients tend to trust treatment recommendations faster. A CRM that makes follow-up effortless is, in a very literal sense, a revenue tool disguised as an admin tool.</p>

      ${CONTACT_CTA}
      <p>Related reading: <a href="/blog/digital-prescriptions-vs-paper-records">why digital prescriptions and records matter for continuity of care</a>.</p>
    `,
  },
  {
    slug: "digital-prescriptions-vs-paper-records",
    title: "Digital Prescriptions vs Paper Records: Why Indian Clinics Are Switching",
    description:
      "Illegible handwriting, lost prescriptions, and no allergy history at the point of care — paper records fail in ways digital patient records simply don't. Here's the practical case for switching.",
    keywords:
      "digital prescriptions, patient records software, electronic health records clinic, allergy alert system, printable medical summary",
    category: "Patient Records",
    date: "2026-02-02",
    readTime: "6 min read",
    author: "BariQ Team",
    excerpt:
      "A prescription only helps if someone can read it, find it again, and see it before deciding what to prescribe next. Paper fails at all three.",
    contentHtml: `
      <p>The joke about doctors' handwriting exists for a reason, but the real cost of paper prescriptions isn't legibility jokes — it's what happens when a pharmacist misreads a dose, or a patient loses the only copy of a prescription they need for insurance, or a doctor prescribes something a patient is allergic to because that history wasn't in front of them. <strong>Digital prescriptions</strong> and patient records fix all three, and they do it without adding real time to a consultation.</p>

      <h2>The allergy problem paper can't solve</h2>
      <p>A patient's allergy history is only useful if it's visible at the exact moment a doctor is deciding what to prescribe. In a paper file, that means physically flipping to a note that may or may not be there, may or may not be recent, and is easy to miss during a busy OPD day. A digital record that shows a red allergy banner on every visit — before a single field is filled in — removes the "I didn't see it" failure mode entirely.</p>

      <h2>What a complete digital patient record actually holds</h2>
      <ul>
        <li><strong>Vitals per visit</strong> — BP, pulse, SpO₂, temperature, weight, height — captured inline instead of on a separate vitals sheet that may never make it into the main file.</li>
        <li><strong>Diagnosis and prescription</strong>, tied to that specific visit, not a loose note.</li>
        <li><strong>Full visit history</strong>, so a doctor can open any past prescription, expand it, reprint it, or reference it in seconds.</li>
        <li><strong>Blood group, age, and gender</strong> always visible at a glance, without hunting through a file.</li>
      </ul>

      <h2>Prescriptions patients can actually keep</h2>
      <p>A digital prescription can be printed cleanly at the counter, and — because it lives in the system — reprinted any time a patient loses their copy, needs it for insurance, or wants to show it to another doctor. That alone eliminates a recurring, low-value interruption for reception staff: "can you print my prescription from last month again?"</p>

      <h2>Continuity of care across visits</h2>
      <p>The real value of digital records isn't any single visit — it's what a doctor can see across visits. A patient's blood pressure trend, medication history, and past diagnoses sitting in one place lets a doctor make better decisions faster, especially for chronic conditions where treatment needs to adjust based on what's already been tried.</p>

      <h2>A one-tap printable summary for referrals</h2>
      <p>When a patient needs to see a specialist, a printable medical summary — demographics, visit history, diagnoses, and past prescriptions in one document — saves the referring clinic from manually compiling records, and gives the specialist a complete picture on the first visit instead of starting from zero.</p>

      <h2>Specialty charting without cluttering the general record</h2>
      <p>Dental and orthopaedic or physiotherapy practices need more than a generic visit note — a tooth-by-tooth chart, or a region-by-region body chart with a treatment history over time. The right approach is to make these opt-in modules on top of the same patient record, so specialty clinics get what they need without cluttering the interface for clinics that don't.</p>

      ${CONTACT_CTA}
      <p>Related reading: <a href="/blog/patient-crm-for-clinics">why follow-ups matter as much as the visit itself</a>.</p>
    `,
  },
  {
    slug: "how-to-choose-clinic-management-software-india",
    title: "How to Choose Clinic Management Software in India: A 2026 Guide",
    description:
      "A practical checklist for Indian clinic owners evaluating clinic management software — from queue and pharmacy to GST billing and WhatsApp, and the questions worth asking before you sign up.",
    keywords:
      "clinic management software India, clinic software comparison, hospital management system, best clinic software, pharmacy POS software",
    category: "Buying Guide",
    date: "2026-02-09",
    readTime: "8 min read",
    author: "BariQ Team",
    excerpt:
      "Most clinic software comparisons focus on feature lists. The better question is whether the features actually work together, or just sit in the same login screen.",
    contentHtml: `
      <p>There's no shortage of <strong>clinic management software</strong> options in India today, and most feature lists look similar on the surface: queue management, patient records, billing, pharmacy. The real differences show up once a clinic is actually using the software during a busy Monday morning — in how connected the modules are, how well it fits Indian clinic operations specifically, and what happens when something goes wrong. Here's what's actually worth checking before you commit.</p>

      <h2>1. Is it actually one system, or five bolted together?</h2>
      <p>Ask directly: does the queue module share data with patient records? Does a pharmacy sale automatically reflect in billing and revenue reports? A lot of "all-in-one" platforms are really several separate tools sharing a login page, which means staff end up re-entering the same patient information two or three times a day. A genuinely unified platform means a patient checked into the queue is already the same patient record a doctor opens, prescribes against, and bills.</p>

      <h2>2. Is it actually built for how Indian clinics operate?</h2>
      <p>Specific things to check:</p>
      <ul>
        <li><strong>GST-ready billing</strong> out of the box, not as a manual workaround.</li>
        <li><strong>Cash, UPI, and card reconciliation</strong> in one daily close, since most Indian clinics take payment across all three.</li>
        <li><strong>WhatsApp-first communication</strong>, ideally without requiring an expensive Business API contract just to send a queue link.</li>
        <li><strong>IST-aware scheduling</strong> for queue windows and appointment slots — a small detail that matters more than it sounds when a platform is built primarily for another market.</li>
      </ul>

      <h2>3. Does the pharmacy module handle FEFO, not just stock counts?</h2>
      <p>A pharmacy add-on that only tracks quantity in and quantity out isn't solving the problem that actually costs clinics money: expired stock. Look specifically for FEFO (First Expiry, First Out) batch selection at billing, expiry and low-stock alerts, and one-tap reorder generation. See our <a href="/blog/fefo-pharmacy-inventory-management">deep dive on FEFO inventory management</a> for what to check in detail.</p>

      <h2>4. Does patient safety live inside the workflow, not a separate report?</h2>
      <p>Allergy alerts and vitals tracking only help if a doctor sees them at the point of prescribing — not buried in a report nobody opens mid-consultation. A red allergy banner directly on the patient's visit screen is a meaningfully different design decision than an allergy field sitting quietly in a demographics tab.</p>

      <h2>5. Can multiple doctors and roles work without stepping on each other?</h2>
      <p>For any clinic with more than one practitioner, check that each doctor gets an independent queue and console, and that receptionists, pharmacists, and admins each get role-based access limited to what they actually need. This isn't just convenience — it's what keeps sensitive patient data away from staff who don't need to see it.</p>

      <h2>6. What does the trial and pricing actually look like?</h2>
      <p>A real trial means full platform access, not a crippled demo with three fake patients. Be wary of software that requires a credit card up front just to "try" it, or that locks core features like the pharmacy module behind a separate add-on fee discovered only after signup. Pricing built around your clinic's actual size tends to be fairer than a rigid per-seat rate card that punishes growth.</p>

      <h2>7. What happens when you need help?</h2>
      <p>Ask how support actually works before you sign up: is there a real phone number, a WhatsApp line that gets answered same-day, or only a ticket form that takes 48 hours? For a system running your daily patient flow, response time during a live issue matters more than a glossy feature page.</p>

      <h2>Where BariQ fits</h2>
      <p>BariQ was built specifically around these gaps: one connected platform for queue, patient records, prescriptions, a FEFO-aware pharmacy, billing, and CRM, built for GST, UPI, and WhatsApp-first Indian clinic operations, with a real 7 day free trial and no credit card required to start.</p>

      ${CONTACT_CTA}
    `,
  },
  {
    slug: "opd-queue-management-hospitals",
    title: "OPD Queue Management: Reducing Waiting Room Chaos in Multi-Doctor Clinics and Hospitals",
    description:
      "Managing an OPD queue gets exponentially harder with multiple doctors and departments. Here's how digital queue separation and self check-in kiosks keep waiting rooms sane.",
    keywords:
      "OPD queue management, hospital queue system, multi doctor clinic software, kiosk self check in, digital token system hospital",
    category: "Queue Management",
    date: "2026-02-16",
    readTime: "6 min read",
    author: "BariQ Team",
    excerpt:
      "One doctor and one queue is simple. Five doctors sharing a waiting room without a system to separate them is where OPD queues genuinely fall apart.",
    contentHtml: `
      <p>A single-doctor clinic can survive on a simple numbered token system. A multi-doctor OPD or a small hospital cannot — the moment multiple queues share one physical waiting room, patients lose track of whose line is moving, receptionists get flooded with "is it my turn yet" questions, and the whole system starts to feel unfair even when it isn't. <strong>OPD queue management</strong> at this scale needs more structure than a paper token roll can provide.</p>

      <h2>Why shared waiting rooms multiply confusion</h2>
      <p>With one doctor, a token number is unambiguous. With five doctors across different specialties, a single shared numbering sequence tells a patient nothing useful — being "number 12" means very different things depending on which doctor they're waiting for. The fix isn't a bigger display board; it's separating the queues at the data level so each doctor has their own independent, live-updating sequence.</p>

      <h2>What independent per-doctor queues solve</h2>
      <ul>
        <li>A patient waiting for Dr. Sharma only ever sees Dr. Sharma's queue position — no noise from other doctors' patients being called.</li>
        <li>Each doctor's console shows only their own list, so a doctor moving faster than expected isn't blocked by an unrelated backlog.</li>
        <li>Reception can register a walk-in against the correct doctor in one step, instead of managing a single master list and manually sorting by specialty.</li>
      </ul>

      <h2>Self check-in kiosks take pressure off reception during peak hours</h2>
      <p>The single biggest bottleneck in a busy OPD is usually not the doctor — it's the front desk trying to register walk-ins, answer phones, and manage payments simultaneously. A QR code kiosk lets a patient join the correct doctor's queue themselves by entering just their phone number, which matters most exactly when reception is most overloaded: the first hour of opening and right after lunch.</p>

      <h2>Live waiting room displays reduce "how much longer" interruptions</h2>
      <p>A screen showing the current token being served per doctor, updated instantly, answers the single most common question in any waiting room without a single staff interruption. Combined with a WhatsApp or SMS nudge a few positions before a patient's turn, patients feel comfortable stepping out — which also means fewer people physically crowding a small waiting area at once.</p>

      <h2>Data that helps hospitals plan staffing</h2>
      <p>Once queue data is centralized rather than living on paper, a hospital administrator can finally see real patterns: which doctor's OPD consistently backs up after 11am, which day of the week sees the highest walk-in volume, and where average wait time is highest. That data turns staffing decisions from guesswork into evidence.</p>

      <h2>Getting doctor consoles right matters as much as the queue itself</h2>
      <p>A queue system is only as good as the console the doctor uses to call the next patient. It needs to be fast — one tap to call the next patient, one tap to mark a visit complete — because any friction here directly slows down the entire line behind it.</p>

      <p>BariQ gives every doctor their own live queue and console inside the same platform used for patient records, prescriptions, and billing, so a multi-doctor clinic or small hospital OPD runs as several clean, independent lines instead of one chaotic shared room.</p>

      ${CONTACT_CTA}
      <p>Related reading: <a href="/blog/clinic-queue-management-system-guide">the complete guide to clinic queue management systems</a>.</p>
    `,
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
