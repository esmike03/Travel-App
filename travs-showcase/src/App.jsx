import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Compass,
  Heart,
  Map,
  MapPinned,
  Menu,
  Navigation,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  WifiOff,
} from 'lucide-react';

const heroImage =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Chocolate_Hills_Bohol_Philippines.jpg/960px-Chocolate_Hills_Bohol_Philippines.jpg';

const destinations = [
  { name: 'Chocolate Hills', area: 'Carmen', tag: 'Nature', time: '1h 35m', rating: '4.9' },
  { name: 'Alona Beach', area: 'Panglao', tag: 'Beach', time: '28m', rating: '4.8' },
  { name: 'Loboc River', area: 'Loboc', tag: 'River cruise', time: '52m', rating: '4.7' },
];

const features = [
  {
    icon: Search,
    title: 'Discover Bohol faster',
    text: 'Search destinations by municipality, category, amenities, entrance fees, hours, and travel style.',
  },
  {
    icon: MapPinned,
    title: 'Maps that stay useful',
    text: 'Plan around routes, nearby attractions, geofenced reminders, and cached place data for weak-signal areas.',
  },
  {
    icon: CalendarDays,
    title: 'Itineraries with context',
    text: 'Save favorites, build day plans, compare travel times, and keep must-see stops in one clean flow.',
  },
  {
    icon: ShieldCheck,
    title: 'Curated destination data',
    text: 'Admin review tools and import workflows help keep destination details fresh before publishing.',
  },
];

const workflow = [
  'Find places by mood, location, or activity',
  'Open rich destination pages with photos and map context',
  'Save favorites and build a practical route',
  'Use offline-ready data while exploring Bohol',
];

function Header() {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
      <a href="#top" className="flex items-center gap-3" aria-label="Travs home">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white shadow-soft">
          <Compass size={21} strokeWidth={2.4} />
        </span>
        <span className="text-lg font-extrabold tracking-normal">Travs</span>
      </a>
      <nav className="hidden items-center gap-8 text-sm font-semibold text-ink/68 md:flex">
        <a href="#features" className="transition hover:text-ink">Features</a>
        <a href="#experience" className="transition hover:text-ink">Experience</a>
        <a href="#admin" className="transition hover:text-ink">Admin</a>
      </nav>
      <a
        href="#experience"
        className="hidden rounded-full border border-white/70 bg-white/60 px-5 py-2.5 text-sm font-bold text-ink shadow-glass backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white md:inline-flex"
      >
        View app
      </a>
      <button className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-white/70 shadow-glass backdrop-blur-md md:hidden" aria-label="Open menu">
        <Menu size={20} />
      </button>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-10 lg:pb-28 lg:pt-14">
      <div className="max-w-3xl">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-4 py-2 text-sm font-bold text-lagoon shadow-glass backdrop-blur-md">
          <Sparkles size={16} />
          Bohol discovery, maps, and itinerary planning
        </div>
        <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-normal text-ink sm:text-6xl lg:text-7xl">
          Explore Bohol with a guide that works like a local.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/68">
          Travs helps visitors discover destinations, save favorites, plan routes, read reviews, and keep travel details available even when the signal fades.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href="#features" className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-extrabold text-white shadow-soft transition hover:-translate-y-0.5">
            <Navigation size={18} />
            Explore features
          </a>
          <a href="#admin" className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/10 bg-white/65 px-6 py-3.5 text-sm font-extrabold text-ink shadow-glass backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white">
            <Map size={18} />
            See platform flow
          </a>
        </div>
        <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
          {[
            ['SQLite-first', 'Offline cache'],
            ['OpenStreetMap', 'Route-ready'],
            ['Admin review', 'Curated data'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/70 bg-white/50 p-4 shadow-glass backdrop-blur-md">
              <p className="text-sm font-extrabold text-ink">{label}</p>
              <p className="mt-1 text-xs font-semibold text-ink/54">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[560px]">
        <div className="absolute -left-8 top-10 h-44 w-44 rounded-full bg-sun/25 blur-3xl" />
        <div className="absolute -right-6 bottom-20 h-52 w-52 rounded-full bg-lagoon/18 blur-3xl" />
        <div className="relative rounded-[2.1rem] border border-white/75 bg-white/45 p-3 shadow-soft backdrop-blur-xl">
          <div className="relative overflow-hidden rounded-[1.7rem] bg-white">
            <img src={heroImage} alt="Chocolate Hills in Bohol, Philippines" className="h-[350px] w-full object-cover sm:h-[430px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/78 via-ink/18 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">Featured route</span>
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">
                  <Star size={13} fill="currentColor" />
                  4.9
                </span>
              </div>
              <h2 className="text-3xl font-extrabold tracking-normal">Chocolate Hills</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-white/82">Plan the countryside stop with nearby attractions, travel estimates, and saved notes.</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs font-medium text-ink/45">
          Photo: Philip Nalangan, Wikimedia Commons, CC BY-SA 4.0
        </p>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
      <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-end">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-lagoon">Travel companion</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-normal sm:text-4xl">Everything a Bohol trip needs, without the clutter.</h2>
        </div>
        <p className="text-base leading-8 text-ink/62">
          Travs keeps the experience calm and practical: discovery, maps, reviews, favorites, itinerary planning, and offline access are all treated as one connected journey.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="rounded-3xl border border-white/70 bg-white/60 p-6 shadow-glass backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/85">
              <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-lagoon to-palm text-white shadow-glass">
                <Icon size={22} />
              </div>
              <h3 className="text-lg font-extrabold tracking-normal">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink/60">{feature.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PhonePreview() {
  return (
    <div className="rounded-[2rem] border border-white/70 bg-white/56 p-5 shadow-soft backdrop-blur-xl sm:p-7">
      <div className="mx-auto w-full max-w-[330px] rounded-[2.2rem] border-[10px] border-ink bg-ink shadow-soft">
        <div className="overflow-hidden rounded-[1.45rem] bg-[#f8fbf8]">
          <div className="bg-gradient-to-br from-lagoon via-palm to-[#70b15e] p-5 text-white">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/66">Good morning</p>
                <p className="text-xl font-extrabold">Where to next?</p>
              </div>
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/18 backdrop-blur-md" aria-label="Notifications">
                <Bell size={18} />
              </button>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/17 px-4 py-3 text-sm font-semibold text-white/88 backdrop-blur-md">
              <Search size={18} />
              Search beaches, caves, cafes
            </div>
          </div>
          <div className="space-y-3 p-4">
            {destinations.map((place, index) => (
              <div key={place.name} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_10px_30px_rgba(16,32,26,0.08)]">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-ink ${index === 0 ? 'bg-sun/60' : index === 1 ? 'bg-coral/55' : 'bg-lagoon/20'}`}>
                  {index === 0 ? <MapPinned size={22} /> : index === 1 ? <Heart size={22} /> : <Navigation size={22} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-extrabold">{place.name}</p>
                    <span className="flex items-center gap-1 text-xs font-bold text-lagoon">
                      <Star size={12} fill="currentColor" /> {place.rating}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-ink/50">{place.area} - {place.tag}</p>
                  <p className="mt-2 text-xs font-bold text-ink/70">{place.time} from Panglao</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Experience() {
  return (
    <section id="experience" className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
      <PhonePreview />
      <div className="flex flex-col justify-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-coral">App experience</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-normal sm:text-4xl">A quiet interface for real travel decisions.</h2>
        <p className="mt-5 max-w-2xl text-base leading-8 text-ink/62">
          The app is designed for tourists who need answers quickly: what is nearby, how long it takes, whether it is worth saving, and what to do when mobile data gets unreliable.
        </p>
        <div className="mt-8 grid gap-3">
          {workflow.map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/55 p-4 shadow-glass backdrop-blur-md">
              <CheckCircle2 className="shrink-0 text-lagoon" size={20} />
              <span className="text-sm font-bold text-ink/76">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AdminPlatform() {
  return (
    <section id="admin" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
      <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-ink text-white shadow-soft">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.88fr_1.12fr] lg:p-10">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-sun">Admin platform</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-normal sm:text-4xl">Destination content stays curated behind the scenes.</h2>
            <p className="mt-5 text-base leading-8 text-white/66">
              Travs includes a Laravel, React, and Inertia admin portal for reviewing imports, approving destination records, and keeping tourist-facing data consistent.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm font-extrabold">Import review queue</p>
                <p className="mt-1 text-xs font-semibold text-white/46">AI-assisted destination data</p>
              </div>
              <span className="rounded-full bg-sun px-3 py-1 text-xs font-extrabold text-ink">12 ready</span>
            </div>
            <div className="grid gap-3">
              {['Baclayon heritage stop', 'Panglao dive shop', 'Anda cave pool'].map((row, index) => (
                <div key={row} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-white/8 p-4">
                  <div>
                    <p className="text-sm font-bold">{row}</p>
                    <p className="mt-1 text-xs font-semibold text-white/44">{index === 0 ? 'Needs category review' : index === 1 ? 'Duplicate check passed' : 'Photo source pending'}</p>
                  </div>
                  <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-extrabold text-white/76">Review</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 pb-20 pt-10 sm:px-8 lg:px-10">
      <div className="rounded-[2rem] border border-white/70 bg-white/65 p-7 text-center shadow-glass backdrop-blur-xl sm:p-10">
        <WifiOff className="mx-auto text-lagoon" size={34} />
        <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-normal sm:text-4xl">Built for island days, weak signal, and spontaneous detours.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-ink/62">
          Travs gives Bohol visitors a calmer way to choose where to go next while giving local operators a cleaner way to maintain trusted destination data.
        </p>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <main className="min-h-screen overflow-hidden bg-shell text-ink">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_10%,rgba(248,195,93,0.26),transparent_30%),radial-gradient(circle_at_85%_4%,rgba(15,118,110,0.18),transparent_36%),linear-gradient(135deg,#f7fbf8_0%,#eff9f3_48%,#fff8ee_100%)]" />
      <Header />
      <Hero />
      <Features />
      <Experience />
      <AdminPlatform />
      <ClosingCta />
      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 pb-10 text-sm font-semibold text-ink/48 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <p>Travs - Bohol Travel Companion</p>
        <p>Minimal showcase concept for the mobile app and admin platform.</p>
      </footer>
    </main>
  );
}
