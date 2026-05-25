import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Mail, Phone, ShieldCheck, TicketCheck, Wrench } from 'lucide-react';

const supportHighlights = [
  'Submit and track ICT support requests',
  'Coordinate maintenance and asset issues',
  'Keep campus support communication visible',
];

const services = [
  {
    title: 'Ticket Support',
    description: 'Create requests for accounts, hardware, networks, printers, classrooms, and software support.',
    icon: TicketCheck,
  },
  {
    title: 'ICTD Operations',
    description: 'Route work to the right technical staff and keep progress easy to follow.',
    icon: Wrench,
  },
  {
    title: 'Trusted Service',
    description: 'Support designed for the daily needs of Woldia University staff and students.',
    icon: ShieldCheck,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/woldia-university-logo.jpg"
              alt="Woldia University Logo"
              width={84}
              height={58}
              className="h-11 w-auto shrink-0 object-contain"
              priority
            />
            <span className="hidden truncate text-base font-black tracking-tight text-slate-950 dark:text-white sm:block lg:text-lg">
              Woldia University ICTD Support
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#about" className="text-sm font-bold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">
              About Us
            </Link>
            <Link href="#support" className="text-sm font-bold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">
              Support
            </Link>
            <Link href="#contact" className="text-sm font-bold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">
              Contact
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="hidden rounded-xl px-4 py-2 text-sm font-black text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:inline-flex">
              Login
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700">
              Get Support
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-200">
            <ShieldCheck size={18} />
            Your Technical Partner
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-[1.04] tracking-normal text-slate-950 dark:text-white md:text-7xl">
            ICTD Support System
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            A dedicated support portal for the Woldia University community, built to make technical help, maintenance, and service follow-up easier to manage.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700">
              Login to Support Portal
              <ArrowRight size={18} />
            </Link>
            <Link href="#about" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
              Learn More
            </Link>
          </div>

          <div className="mt-10 grid gap-3">
            {supportHighlights.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
            <div className="flex min-h-[360px] items-center justify-center bg-slate-100 p-8 dark:bg-slate-900/70 sm:min-h-[430px] sm:p-10">
              <Image
                src="/woldia-university-logo.jpg"
                alt="Woldia University Logo"
                width={520}
                height={360}
                className="h-auto w-full max-w-[430px] object-contain"
                priority
              />
            </div>
            <div className="border-t border-slate-200 p-6 dark:border-slate-800">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-200">
                  <TicketCheck size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">Reliable Service</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    A clear path from request submission to technical resolution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="border-y border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">About Us</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 dark:text-white md:text-4xl">
              Campus support shaped around ICTD work.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 dark:text-slate-300">
              The system gives Woldia University a central place for technical requests, staff assignment, maintenance coordination, and service updates.
            </p>
          </div>

          <div id="support" className="mt-12 grid gap-5 md:grid-cols-3">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950/65">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-200">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">{service.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{service.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-slate-100 py-16 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-10 px-5 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/woldia-university-logo.jpg" alt="Woldia University Logo" width={64} height={44} className="h-9 w-auto object-contain grayscale" />
              <span className="text-lg font-black text-slate-950 dark:text-white">Woldia University ICTD Support</span>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">(c) 2026 Woldia University ICTD. All rights reserved.</p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="#contact" className="text-sm font-bold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">Privacy</Link>
            <Link href="#contact" className="text-sm font-bold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">Terms</Link>
            <Link href="#support" className="text-sm font-bold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">Support</Link>
            <Link href="mailto:ictsupport@wldu.edu.et" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">
              <Mail size={16} />
              Contact
            </Link>
            <Link href="tel:+251000000000" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300">
              <Phone size={16} />
              Call
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
